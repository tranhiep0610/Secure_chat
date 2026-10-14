// js/crypto/des.js
// DES-CBC + HMAC-SHA256 cho SecureChat.
// CHỈ DÙNG ĐỂ HỌC / SO SÁNH HIỆU NĂNG. DES đã lỗi thời, không an toàn cho dữ liệu thật.
//
// Cấu trúc file:
//   1. Bảng hằng số của DES
//   2. Tiện ích (BigInt, base64, hex)
//   3. Lõi DES: sinh khóa con, hàm Feistel, mã hóa/giải mã 1 khối 8 byte
//   4. Chế độ CBC + đệm PKCS#7 (xử lý tin nhắn dài)
//   5. Dẫn xuất khóa + HMAC (chống sửa dữ liệu)
//   6. Hàm công khai: encryptDESMessage / decryptDESMessage / desSelfTest
 
// =====================================================================
// 1. BẢNG HẰNG SỐ
// =====================================================================
 
// Hoán vị đầu (Initial Permutation) và hoán vị cuối (Final Permutation)
const IP = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
const FP = [40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
 
// Mở rộng nửa phải từ 32 bit lên 48 bit
const E = [32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
 
// Hoán vị sau S-box
const P = [16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
 
// Chọn và hoán vị khóa: 64 bit -> 56 bit (PC1), 56 bit -> 48 bit (PC2)
const PC1 = [57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
const PC2 = [14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
 
// Số bit xoay trái ở mỗi vòng trong 16 vòng
const SHIFTS = [1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
 
// 8 hộp S-box, mỗi hộp 4 hàng x 16 cột
const S_BOXES = [
  [[14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7],[0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8],[4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0],[15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13]],
  [[15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10],[3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5],[0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15],[13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9]],
  [[10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8],[13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1],[13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7],[1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12]],
  [[7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15],[13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9],[10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4],[3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14]],
  [[2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9],[14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6],[4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14],[11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3]],
  [[12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11],[10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8],[9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6],[4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13]],
  [[4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1],[13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6],[1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2],[6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12]],
  [[13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7],[1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2],[7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8],[2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]]
];
 
const MASK28 = (1n << 28n) - 1n;
const MASK32 = (1n << 32n) - 1n;
 
const DES_BLOCK_SIZE = 8;          // DES xử lý từng khối 8 byte
const PBKDF2_ITERATIONS = 250000;
const DES_ALGORITHM = 'DES-CBC-HMAC-SHA256';
const DES_VERSION = 1;
 
// =====================================================================
// 2. TIỆN ÍCH
// =====================================================================
 
const encoder = new TextEncoder();
const decoder = new TextDecoder();
 
// Luôn ép về chuỗi để ObjectId / số / chuỗi cho cùng một kết quả
const str = v => String(v ?? '');
 
function toBase64(bytes) {
  const a = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < a.length; i += 0x8000) {
    binary += String.fromCharCode(...a.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
 
function fromBase64(value, fieldName) {
  if (value == null || value === '') throw new Error(`Gói DES thiếu trường ${fieldName}.`);
  if (Array.isArray(value)) return Uint8Array.from(value);
  if (value.type === 'Buffer' && Array.isArray(value.data)) return Uint8Array.from(value.data);
  try {
    return Uint8Array.from(atob(value), c => c.charCodeAt(0));
  } catch {
    throw new Error(`Trường ${fieldName} không phải base64 hợp lệ.`);
  }
}
 
const toHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const fromHex = text => Uint8Array.from(text.match(/.{2}/g) || [], x => parseInt(x, 16));
 
// Mảng byte <-> số nguyên lớn (BigInt), big-endian
function bytesToBigInt(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n;
}
 
function bigIntToBytes(n, length) {
  const out = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    out[i] = Number(n & 255n);
    n >>= 8n;
  }
  return out;
}
 
// Hoán vị bit: với mỗi số trong `table` (đánh số từ 1, tính từ bit trái nhất),
// lấy bit tương ứng của `value` rồi ghép lại thành kết quả mới.
function permute(value, table, inputBits) {
  let out = 0n;
  for (const position of table) {
    const bit = (value >> BigInt(inputBits - position)) & 1n;
    out = (out << 1n) | bit;
  }
  return out;
}
 
const rotateLeft28 = (value, n) =>
  ((value << BigInt(n)) | (value >> BigInt(28 - n))) & MASK28;
 
function xorBlocks(a, b) {
  const out = new Uint8Array(DES_BLOCK_SIZE);
  for (let i = 0; i < DES_BLOCK_SIZE; i++) out[i] = a[i] ^ b[i];
  return out;
}
 
// So sánh hai mảng byte, thời gian không phụ thuộc vị trí khác nhau
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
 
// =====================================================================
// 3. LÕI DES
// =====================================================================
 
// Từ khóa 8 byte sinh ra 16 khóa con (mỗi khóa 48 bit)
function generateSubkeys(keyBytes) {
  if (keyBytes.length !== 8) throw new Error('Khóa DES phải dài đúng 8 byte.');
 
  const key56 = permute(bytesToBigInt(keyBytes), PC1, 64);
  let c = (key56 >> 28n) & MASK28;   // nửa trái 28 bit
  let d = key56 & MASK28;            // nửa phải 28 bit
 
  const subkeys = [];
  for (const shift of SHIFTS) {
    c = rotateLeft28(c, shift);
    d = rotateLeft28(d, shift);
    subkeys.push(permute((c << 28n) | d, PC2, 56));
  }
  return subkeys;
}
 
// Hàm Feistel f(R, K): mở rộng R -> XOR khóa con -> 8 S-box -> hoán vị P
function feistel(right, subkey) {
  const mixed = permute(right, E, 32) ^ subkey;   // 48 bit
 
  let sboxOutput = 0n;
  for (let i = 0; i < 8; i++) {
    const sixBits = Number((mixed >> BigInt((7 - i) * 6)) & 63n);
    const row = ((sixBits & 0b100000) >> 4) | (sixBits & 1);  // bit đầu + bit cuối
    const col = (sixBits >> 1) & 0b1111;                      // 4 bit giữa
    sboxOutput = (sboxOutput << 4n) | BigInt(S_BOXES[i][row][col]);
  }
  return permute(sboxOutput, P, 32);
}
 
// Mã hóa hoặc giải mã 1 khối 8 byte với danh sách khóa con cho trước
function cryptBlock(blockBytes, subkeys) {
  const afterIP = permute(bytesToBigInt(blockBytes), IP, 64);
  let left = afterIP >> 32n;
  let right = afterIP & MASK32;
 
  for (const subkey of subkeys) {   // 16 vòng Feistel
    const newRight = left ^ feistel(right, subkey);
    left = right;
    right = newRight;
  }
 
  // Sau vòng cuối hai nửa được đổi chỗ, rồi qua hoán vị cuối
  const preOutput = (right << 32n) | left;
  return bigIntToBytes(permute(preOutput, FP, 64), 8);
}
 
// Giải mã dùng đúng các khóa con đó nhưng theo thứ tự ngược
function getSubkeys(keyBytes, decrypt) {
  const subkeys = generateSubkeys(keyBytes);
  return decrypt ? subkeys.reverse() : subkeys;
}
 
// Xử lý đúng 1 khối (dùng cho kiểm tra known-answer)
export function desBlock(inputBytes, keyBytes, decrypt = false) {
  if (inputBytes.length !== DES_BLOCK_SIZE) throw new Error('DES xử lý từng khối 8 byte.');
  return cryptBlock(inputBytes, getSubkeys(keyBytes, decrypt));
}
 
// =====================================================================
// 4. CHẾ ĐỘ CBC + ĐỆM PKCS#7
// =====================================================================
 
// Thêm 1 đến 8 byte, mỗi byte có giá trị bằng số byte được thêm
function pkcs7Pad(data) {
  const padLength = DES_BLOCK_SIZE - (data.length % DES_BLOCK_SIZE);
  const padded = new Uint8Array(data.length + padLength);
  padded.set(data);
  padded.fill(padLength, data.length);
  return padded;
}
 
function pkcs7Unpad(data) {
  const padLength = data[data.length - 1];
  if (padLength < 1 || padLength > DES_BLOCK_SIZE) throw new Error('Padding DES không hợp lệ.');
  for (let i = data.length - padLength; i < data.length; i++) {
    if (data[i] !== padLength) throw new Error('Padding DES không hợp lệ.');
  }
  return data.slice(0, data.length - padLength);
}
 
// CBC: mỗi khối rõ được XOR với khối mã hóa liền trước (khối đầu dùng IV)
function cbcEncrypt(plainBytes, keyBytes, iv) {
  const subkeys = getSubkeys(keyBytes, false);   // tính 1 lần cho cả tin nhắn
  const padded = pkcs7Pad(plainBytes);
  const out = new Uint8Array(padded.length);
 
  let previous = iv;
  for (let offset = 0; offset < padded.length; offset += DES_BLOCK_SIZE) {
    const plainBlock = padded.slice(offset, offset + DES_BLOCK_SIZE);
    const cipherBlock = cryptBlock(xorBlocks(plainBlock, previous), subkeys);
    out.set(cipherBlock, offset);
    previous = cipherBlock;
  }
  return out;
}
 
function cbcDecrypt(cipherBytes, keyBytes, iv) {
  if (!cipherBytes.length || cipherBytes.length % DES_BLOCK_SIZE) {
    throw new Error('Ciphertext DES không hợp lệ.');
  }
  const subkeys = getSubkeys(keyBytes, true);
  const out = new Uint8Array(cipherBytes.length);
 
  let previous = iv;
  for (let offset = 0; offset < cipherBytes.length; offset += DES_BLOCK_SIZE) {
    const cipherBlock = cipherBytes.slice(offset, offset + DES_BLOCK_SIZE);
    out.set(xorBlocks(cryptBlock(cipherBlock, subkeys), previous), offset);
    previous = cipherBlock;
  }
  return pkcs7Unpad(out);
}
 
// =====================================================================
// 5. DẪN XUẤT KHÓA + HMAC
// =====================================================================
 
const keyCache = new Map();
 
export function clearDesKeyCache() {
  keyCache.clear();
}
 
// Từ cụm mật khẩu dẫn xuất 40 byte: 8 byte khóa DES + 32 byte khóa HMAC.
// Có cache để không chạy PBKDF2 cho từng tin nhắn.
function deriveDesKeys(passphrase, conversationId) {
  if (!str(passphrase).trim()) {
    return Promise.reject(new Error('Hãy nhập khóa hội thoại trước khi mã hóa.'));
  }
  const cid = str(conversationId);
  const cacheKey = `${cid}\u0000${passphrase}`;
 
  if (!keyCache.has(cacheKey)) {
    const promise = (async () => {
      const material = await crypto.subtle.importKey(
        'raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveBits']
      );
      const salt = encoder.encode(`SecureChat-v1|${cid}|DES-CBC-HMAC-SHA256`);
      const bits = new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        material,
        320   // 40 byte
      ));
      return { desKey: bits.slice(0, 8), macKey: bits.slice(8, 40) };
    })();
    promise.catch(() => keyCache.delete(cacheKey));
    keyCache.set(cacheKey, promise);
  }
  return keyCache.get(cacheKey);
}
 
async function computeHmac(macKey, data) {
  const key = await crypto.subtle.importKey(
    'raw', macKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}
 
// Chuỗi dữ liệu được ký bằng HMAC. Thứ tự và giá trị các trường PHẢI giống nhau
// ở cả bước mã hóa và giải mã (và giữ nguyên để đọc được tin nhắn cũ).
function macPayload({ conversationId, senderId, algorithm, keyId, iv, ciphertext, timestamp }) {
  return JSON.stringify([
    DES_VERSION, str(conversationId), str(senderId), algorithm, keyId, iv, ciphertext, timestamp
  ]);
}
 
// =====================================================================
// 6. HÀM CÔNG KHAI
// =====================================================================
 
export async function encryptDESMessage(plaintext, passphrase, conversationId, senderId) {
  const cid = str(conversationId);
  const sid = str(senderId);
  const { desKey, macKey } = await deriveDesKeys(passphrase, cid);
  const iv = crypto.getRandomValues(new Uint8Array(DES_BLOCK_SIZE));
  const now = Date.now();
 
  const keyDigest = new Uint8Array(await crypto.subtle.digest(
    'SHA-256', encoder.encode(`${cid}|${passphrase}|des`)
  ));
 
  const envelope = {
    version: DES_VERSION,
    algorithm: DES_ALGORITHM,
    conversationId: cid,
    senderId: sid,
    keyId: `des_${toHex(keyDigest).slice(0, 16)}`,
    iv: toBase64(iv),
    timestamp: now,
    cryptoTimestamp: now   // backend lưu trường này
  };
 
  envelope.ciphertext = toBase64(cbcEncrypt(encoder.encode(String(plaintext)), desKey, iv));
 
  const mac = toBase64(await computeHmac(macKey, macPayload(envelope)));
  envelope.mac = mac;
  envelope.hmac = mac;     // backend lưu trường tên "hmac"
  return envelope;
}
 
export async function decryptDESMessage(envelope, passphrase, expectedConversationId) {
  if (!envelope || envelope.algorithm !== DES_ALGORITHM) {
    throw new Error('Gói DES không hợp lệ.');
  }
  // Backend có thể làm mất `version`; mặc định là 1
  const version = envelope.version ?? DES_VERSION;
  if (Number(version) !== DES_VERSION) {
    throw new Error(`Phiên bản mã hóa không được hỗ trợ: ${version}`);
  }
 
  const cid = str(expectedConversationId);
  if (str(envelope.conversationId) !== cid) {
    throw new Error('Tin nhắn thuộc cuộc trò chuyện khác.');
  }
 
  const { desKey, macKey } = await deriveDesKeys(passphrase, cid);
 
  // Bước 1: kiểm tra HMAC trước, sai thì dừng ngay (không giải mã dữ liệu bị sửa)
  const expectedMac = await computeHmac(macKey, macPayload({
    ...envelope,
    timestamp: envelope.timestamp ?? envelope.cryptoTimestamp
  }));
  const actualMac = fromBase64(envelope.mac ?? envelope.hmac, 'mac');
  if (!constantTimeEqual(expectedMac, actualMac)) {
    throw new Error('HMAC không hợp lệ: dữ liệu DES có thể đã bị sửa hoặc khóa sai.');
  }
 
  // Bước 2: giải mã
  const plainBytes = cbcDecrypt(
    fromBase64(envelope.ciphertext, 'ciphertext'),
    desKey,
    fromBase64(envelope.iv, 'iv')
  );
  return decoder.decode(plainBytes);
}
 
// =====================================================================
// TỰ KIỂM TRA
// =====================================================================
 
export async function desSelfTest() {
  // 1. Known-answer test: vector chuẩn của DES
  const key = fromHex('133457799BBCDFF1');
  const plain = fromHex('0123456789ABCDEF');
  const cipher = toHex(desBlock(plain, key));
  if (cipher !== '85e813540f0ab405') throw new Error(`DES known-answer test thất bại: ${cipher}`);
  if (toHex(desBlock(fromHex(cipher), key, true)) !== '0123456789abcdef') {
    throw new Error('DES giải mã khối thất bại.');
  }
 
  // 2. Mã hóa rồi giải mã một tin nhắn
  const passphrase = 'self-test-passphrase';
  const text = 'Kiểm tra DES 🔐';
  const envelope = await encryptDESMessage(text, passphrase, 'test-conversation', 'test-sender');
  if ((await decryptDESMessage(envelope, passphrase, 'test-conversation')) !== text) {
    throw new Error('DES message round-trip thất bại.');
  }
 
  // 3. Backend làm mất `version` và `mac` (chỉ còn `hmac`) vẫn phải giải mã được
  const { version, mac, ...stripped } = envelope;
  if ((await decryptDESMessage(stripped, passphrase, 'test-conversation')) !== text) {
    throw new Error('DES không chịu được envelope thiếu version/mac.');
  }
 
  // 4. Sửa ciphertext phải bị HMAC từ chối
  const tampered = { ...envelope, ciphertext: envelope.ciphertext.slice(0, -4) + 'AAAA' };
  let rejected = false;
  try {
    await decryptDESMessage(tampered, passphrase, 'test-conversation');
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error('DES không từ chối HMAC sai.');
 
  return { knownAnswer: true, roundTrip: true, missingFieldsOk: true, tamperRejected: true };
}
 