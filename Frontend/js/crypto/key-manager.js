import CryptoJS from 'crypto-js';

// Lưu trữ khóa tạm thời trong RAM (Key Storage) - Đáp ứng TD01, TD03
const keyStore = new Map();

// ==========================================
// 1. QUẢN LÝ KHÓA AES (AES-GCM 128/192/256 bit)
// ==========================================

/**
 * Tạo khóa AES-GCM mới
 * @param {number} length - Độ dài khóa (128, 192, hoặc 256 bit)
 * @returns {Promise<{key: CryptoKey, keyId: string}>}
 */
export async function generateAESKey(length = 256) {
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: length },
    true, // Extractable
    ["encrypt", "decrypt"]
  );

  // Tạo keyId ngẫu nhiên không mang giá trị khóa bí mật
  const keyId = `key_aes_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Lưu vào Map bộ nhớ tạm
  keyStore.set(keyId, key);

  return { key, keyId };
}

// ==========================================
// 2. QUẢN LÝ KHÓA DES (DES-CBC + HMAC-SHA256)
// ==========================================

/**
 * Tạo bộ khóa DES và MAC độc lập (Đáp ứng KD02)
 * @returns {Promise<{key: {desKeyHex: string, macKey: CryptoKey, type: string}, keyId: string}>}
 */
export async function generateDESKey() {
  // 1. Tạo 8 bytes (64-bit) ngẫu nhiên cho khóa DES
  const desKeyWordArray = CryptoJS.lib.WordArray.random(8);
  const desKeyHex = desKeyWordArray.toString(CryptoJS.enc.Hex);

  // 2. Tạo khóa MAC độc lập (HMAC-SHA256) bằng Web Crypto API
  const macKey = await window.crypto.subtle.generateKey(
    {
      name: "HMAC",
      hash: { name: "SHA-256" }
    },
    true, // Extractable
    ["sign", "verify"]
  );

  // 3. Định danh keyId duy nhất
  const keyId = `key_des_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 4. Gói bộ khóa DES + MAC thành 1 Object chung interface
  const keyBundle = {
    type: "DES-CBC",
    desKeyHex: desKeyHex, // Khóa dùng cho mã hóa DES
    macKey: macKey        // Khóa dùng cho xác thực HMAC độc lập
  };

  // Lưu vào bộ nhớ RAM
  keyStore.set(keyId, keyBundle);

  return { key: keyBundle, keyId };
}

// ==========================================
// 3. TRUY XUẤT KHÓA DÙNG CHUNG
// ==========================================

/**
 * Lấy khóa theo keyId từ bộ nhớ tạm RAM
 * @param {string} keyId 
 * @returns {CryptoKey | Object} Key Object tương ứng
 */
export function getKey(keyId) {
  if (!keyStore.has(keyId)) {
    throw new Error(`Không tìm thấy khóa tương ứng với keyId: ${keyId}`);
  }
  return keyStore.get(keyId);
}

/**
 * Xóa toàn bộ khóa trong RAM (Dùng khi đăng xuất hoặc clear bộ nhớ)
 */
export function clearKeyStore() {
  keyStore.clear();
}