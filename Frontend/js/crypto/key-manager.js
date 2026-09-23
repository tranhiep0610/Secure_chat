import CryptoJS from 'crypto-js';

// Lưu khóa tạm thời trong RAM.
// Khi logout/reload trang, khóa trong Map sẽ bị mất.
const keyStore = new Map();

const cryptoApi = globalThis.crypto;

if (!cryptoApi?.subtle || !cryptoApi?.getRandomValues) {
  throw new Error('Web Crypto API không khả dụng trong môi trường hiện tại.');
}

function createKeyId(prefix) {
  if (typeof cryptoApi.randomUUID === 'function') {
    return `${prefix}_${cryptoApi.randomUUID()}`;
  }

  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  const suffix = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${suffix}`;
}

// ==========================================
// 1. QUẢN LÝ KHÓA AES
// ==========================================

/**
 * Tạo khóa AES-GCM.
 * @param {128|192|256} length
 * @returns {Promise<{key: CryptoKey, keyId: string}>}
 */
export async function generateAESKey(length = 256) {
  const validLengths = [128, 192, 256];

  if (!validLengths.includes(length)) {
    throw new Error('Độ dài khóa AES chỉ được là 128, 192 hoặc 256 bit.');
  }

  const key = await cryptoApi.subtle.generateKey(
    { name: 'AES-GCM', length },
    true,
    ['encrypt', 'decrypt']
  );

  const keyId = createKeyId('key_aes');
  keyStore.set(keyId, key);

  return { key, keyId };
}

// ==========================================
// 2. QUẢN LÝ KHÓA DES + HMAC
// ==========================================

/**
 * Tạo khóa DES 8 byte và khóa HMAC-SHA256 độc lập 32 byte.
 *
 * DES chỉ được giữ trong dự án để học tập/benchmark vì DES đã lỗi thời
 * và không còn đủ an toàn cho hệ thống thực tế.
 *
 * @returns {{
 *   key: {
 *     type: string,
 *     desKeyHex: string,
 *     macKeyHex: string
 *   },
 *   keyId: string
 * }}
 */
export function generateDESKey() {
  // DES nhận 8 byte khóa (64 bit; độ mạnh hiệu dụng thấp hơn do bit parity).
  const desKeyHex = CryptoJS.lib.WordArray.random(8)
    .toString(CryptoJS.enc.Hex);

  // Khóa HMAC độc lập, 32 byte = 256 bit.
  const macKeyHex = CryptoJS.lib.WordArray.random(32)
    .toString(CryptoJS.enc.Hex);

  const keyId = createKeyId('key_des');

  const keyBundle = {
    type: 'DES-CBC-HMAC-SHA256',
    desKeyHex,
    macKeyHex
  };

  keyStore.set(keyId, keyBundle);

  return { key: keyBundle, keyId };
}

// ==========================================
// 3. TRUY XUẤT / XÓA KHÓA
// ==========================================

/**
 * Lấy khóa đã lưu theo keyId.
 */
export function getKey(keyId) {
  if (!keyStore.has(keyId)) {
    throw new Error(`Không tìm thấy khóa tương ứng với keyId: ${keyId}`);
  }

  return keyStore.get(keyId);
}

/**
 * Xóa một khóa.
 */
export function deleteKey(keyId) {
  return keyStore.delete(keyId);
}

/**
 * Xóa toàn bộ khóa trong RAM.
 */
export function clearKeyStore() {
  keyStore.clear();
}
