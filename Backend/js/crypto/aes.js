// js/crypto/aes.js
// AES-GCM + PBKDF2 cho SecureChat (Web Crypto API)

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const AES_VERSION = 1;
const PBKDF2_ITERATIONS = 250000;

function getSubtle() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Trình duyệt không hỗ trợ Web Crypto. Hãy mở SecureChat qua http://localhost, không dùng file://.');
  }
  return subtle;
}

// ---------- Tiện ích ----------

// Luôn ép về chuỗi để ObjectId / số / chuỗi đều cho cùng một kết quả
const str = v => String(v ?? '');

function toBase64(bytes) {
  const a = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < a.length; i += 0x8000) {
    binary += String.fromCharCode(...a.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

// Chấp nhận base64 (chuỗi) hoặc mảng byte / Buffer JSON do backend trả về
function toBytes(value, fieldName) {
  if (value == null) throw new Error(`Gói AES-GCM thiếu trường ${fieldName}.`);
  if (typeof value === 'string') {
    try {
      return Uint8Array.from(atob(value), c => c.charCodeAt(0));
    } catch {
      throw new Error(`Trường ${fieldName} không phải base64 hợp lệ.`);
    }
  }
  if (Array.isArray(value)) return Uint8Array.from(value);
  if (value.type === 'Buffer' && Array.isArray(value.data)) return Uint8Array.from(value.data);
  throw new Error(`Trường ${fieldName} có định dạng không hỗ trợ.`);
}

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

// AAD: dữ liệu xác thực kèm theo. Mã hóa và giải mã PHẢI dựng ra đúng cùng một chuỗi này.
function aadFor({ version, conversationId, senderId, algorithm }) {
  return encoder.encode(`${version}|${str(conversationId)}|${str(senderId)}|${algorithm}`);
}

// ---------- Dẫn xuất khóa (có cache để không chạy PBKDF2 cho từng tin nhắn) ----------

const keyCache = new Map();

export function clearAesKeyCache() {
  keyCache.clear();
}

function deriveAesKey(passphrase, conversationId) {
  if (!str(passphrase).trim()) {
    return Promise.reject(new Error('Hãy nhập khóa hội thoại trước khi mã hóa.'));
  }
  const cid = str(conversationId);
  const cacheKey = `${cid}\u0000${passphrase}`;

  if (!keyCache.has(cacheKey)) {
    const subtle = getSubtle();
    const promise = (async () => {
      const material = await subtle.importKey(
        'raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']
      );
      const salt = encoder.encode(`SecureChat-v1|${cid}|AES-GCM`);
      return subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    })();
    // Nếu lỗi thì bỏ khỏi cache để lần sau thử lại được
    promise.catch(() => keyCache.delete(cacheKey));
    keyCache.set(cacheKey, promise);
  }
  return keyCache.get(cacheKey);
}

// ---------- Mã hóa ----------

export async function encryptAESMessage(plaintext, passphrase, conversationId, senderId) {
  const subtle = getSubtle();
  const cid = str(conversationId);
  const sid = str(senderId);
  const key = await deriveAesKey(passphrase, cid);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const now = Date.now();

  const keyDigest = await subtle.digest('SHA-256', encoder.encode(`${cid}|${passphrase}|aes`));

  const envelope = {
    version: AES_VERSION,
    algorithm: 'AES-GCM',
    conversationId: cid,
    senderId: sid,
    keyId: `aes_${hex(keyDigest).slice(0, 16)}`,
    iv: toBase64(iv),
    timestamp: now,
    cryptoTimestamp: now // backend lưu trường này
  };

  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aadFor(envelope), tagLength: 128 },
    key,
    encoder.encode(String(plaintext))
  );
  envelope.ciphertext = toBase64(ciphertext);
  return envelope;
}

// ---------- Giải mã ----------

export async function decryptAESMessage(envelope, passphrase, expectedConversationId) {
  if (!envelope || envelope.algorithm !== 'AES-GCM') {
    throw new Error('Gói AES-GCM không hợp lệ.');
  }

  // Backend có thể làm mất `version`; mặc định là 1 vì đây là phiên bản duy nhất được tạo ra
  const version = envelope.version ?? AES_VERSION;
  if (Number(version) !== AES_VERSION) {
    throw new Error(`Phiên bản mã hóa không được hỗ trợ: ${version}`);
  }

  const cid = str(expectedConversationId);
  if (str(envelope.conversationId) !== cid) {
    throw new Error('Tin nhắn thuộc cuộc trò chuyện khác.');
  }

  const key = await deriveAesKey(passphrase, cid);
  const iv = toBytes(envelope.iv, 'iv');
  const data = toBytes(envelope.ciphertext, 'ciphertext');

  try {
    const plaintext = await getSubtle().decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: aadFor({
          version: AES_VERSION,
          conversationId: cid,
          senderId: envelope.senderId,
          algorithm: envelope.algorithm
        }),
        tagLength: 128
      },
      key,
      data
    );
    return decoder.decode(plaintext);
  } catch (err) {
    if (err?.name === 'OperationError') {
      throw new Error(
        'Giải mã thất bại: sai khóa hội thoại, hoặc senderId/conversationId trong gói không khớp lúc mã hóa.'
      );
    }
    throw err;
  }
}

// ---------- Tự kiểm tra ----------

export async function aesSelfTest() {
  const passphrase = 'self-test-passphrase';
  const text = 'Xin chào SecureChat 🔐';

  const envelope = await encryptAESMessage(text, passphrase, 'test-conversation', 'test-sender');

  // 1. Round-trip bình thường
  if ((await decryptAESMessage(envelope, passphrase, 'test-conversation')) !== text) {
    throw new Error('AES-GCM round-trip thất bại.');
  }

  // 2. Backend làm mất `version` vẫn phải giải mã được
  const { version, ...noVersion } = envelope;
  if ((await decryptAESMessage(noVersion, passphrase, 'test-conversation')) !== text) {
    throw new Error('AES-GCM không chịu được envelope thiếu version.');
  }

  // 3. Sửa ciphertext phải bị từ chối
  const bytes = toBytes(envelope.ciphertext, 'ciphertext');
  bytes[0] ^= 0xff;
  let tamperRejected = false;
  try {
    await decryptAESMessage({ ...envelope, ciphertext: toBase64(bytes) }, passphrase, 'test-conversation');
  } catch {
    tamperRejected = true;
  }
  if (!tamperRejected) throw new Error('AES-GCM không từ chối dữ liệu bị sửa.');

  // 4. Đổi senderId (AAD) phải bị từ chối
  let aadRejected = false;
  try {
    await decryptAESMessage({ ...envelope, senderId: 'someone-else' }, passphrase, 'test-conversation');
  } catch {
    aadRejected = true;
  }
  if (!aadRejected) throw new Error('AES-GCM không ràng buộc senderId vào AAD.');

  return { roundTrip: true, missingVersionOk: true, tamperRejected: true, aadRejected: true };
}
