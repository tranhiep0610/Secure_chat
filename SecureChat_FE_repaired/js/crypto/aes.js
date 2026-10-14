const encoder = new TextEncoder();
const decoder = new TextDecoder();
const subtle = globalThis.crypto?.subtle;
if (!subtle) throw new Error('Trình duyệt không hỗ trợ Web Crypto. Hãy mở SecureChat qua http://localhost, không dùng file://.');

const toBase64 = bytes => { const a = new Uint8Array(bytes); let binary = ''; for (let i = 0; i < a.length; i += 0x8000) binary += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(binary); };
const fromBase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const aadFor = envelope => encoder.encode(`${envelope.version}|${envelope.conversationId}|${envelope.senderId}|${envelope.algorithm}`);

async function deriveAesKey(passphrase, conversationId) {
  if (!String(passphrase).trim()) throw new Error('Hãy nhập khóa hội thoại trước khi mã hóa.');
  const material = await subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey', 'deriveBits']);
  const salt = encoder.encode(`SecureChat-v1|${conversationId}|AES-GCM`);
  return subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptAESMessage(plaintext, passphrase, conversationId, senderId) {
  const key = await deriveAesKey(passphrase, conversationId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const envelope = { version: 1, algorithm: 'AES-GCM', conversationId, senderId, keyId: `aes_${hex(await subtle.digest('SHA-256', encoder.encode(`${conversationId}|${passphrase}|aes`))).slice(0, 16)}`, iv: toBase64(iv), timestamp: Date.now() };
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aadFor(envelope), tagLength: 128 }, key, encoder.encode(plaintext));
  envelope.ciphertext = toBase64(ciphertext);
  return envelope;
}

export async function decryptAESMessage(envelope, passphrase, expectedConversationId) {
  if (!envelope || envelope.algorithm !== 'AES-GCM' || envelope.version !== 1) throw new Error('Gói AES-GCM không hợp lệ.');
  if (envelope.conversationId !== expectedConversationId) throw new Error('Tin nhắn thuộc cuộc trò chuyện khác.');
  const key = await deriveAesKey(passphrase, expectedConversationId);
  const plaintext = await subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv), additionalData: aadFor(envelope), tagLength: 128 }, key, fromBase64(envelope.ciphertext));
  return decoder.decode(plaintext);
}

export async function aesSelfTest() {
  const passphrase = 'self-test-passphrase';
  const envelope = await encryptAESMessage('Xin chào SecureChat 🔐', passphrase, 'test-conversation', 'test-sender');
  const roundTrip = await decryptAESMessage(envelope, passphrase, 'test-conversation');
  if (roundTrip !== 'Xin chào SecureChat 🔐') throw new Error('AES-GCM round-trip thất bại.');
  const altered = { ...envelope, ciphertext: envelope.ciphertext.slice(0, -4) + 'AAAA' };
  let rejected = false;
  try { await decryptAESMessage(altered, passphrase, 'test-conversation'); } catch { rejected = true; }
  if (!rejected) throw new Error('AES-GCM không từ chối dữ liệu bị sửa.');
  return { roundTrip: true, tamperRejected: true };
}
