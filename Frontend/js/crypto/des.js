import CryptoJS from 'crypto-js';

console.warn("CẢNH BÁO: Thuật toán DES đã cũ và không an toàn. Chỉ sử dụng cho mục đích học tập/so sánh benchmark!");

/**
 * Mã hóa DES-CBC và tính HMAC-SHA256 trên metadata/IV/ciphertext (Encrypt-then-MAC)
 */
export async function encryptDESMessage(text, desKeyHex, macKeyHex, keyId) {
  if (!text || typeof text !== 'string') {
    throw new Error('Dữ liệu đầu vào không hợp lệ');
  }

  // 1. Tạo IV ngẫu nhiên 8 bytes (64-bit cho DES)
  const ivWordArray = CryptoJS.lib.WordArray.random(8);
  const ivHex = CryptoJS.enc.Hex.stringify(ivWordArray);

  // 2. Mã hóa DES-CBC với PKCS7 Padding
  const keyWordArray = CryptoJS.enc.Hex.parse(desKeyHex);
  const encrypted = CryptoJS.DES.encrypt(text, keyWordArray, {
    iv: ivWordArray,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  const ciphertextHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);

  // 3. Tính HMAC-SHA256 trên Metadata + IV + Ciphertext (KD02)
  const macPayload = `${keyId}:${ivHex}:${ciphertextHex}`;
  const macKeyWordArray = CryptoJS.enc.Hex.parse(macKeyHex);
  const hmacHex = CryptoJS.HmacSHA256(macPayload, macKeyWordArray).toString(CryptoJS.enc.Hex);

  // 4. Đóng gói Envelope
  const envelope = {
    keyId: keyId,
    algorithm: "DES-CBC",
    iv: ivHex,
    ciphertext: ciphertextHex,
    mac: hmacHex,
    timestamp: Date.now()
  };

  return JSON.stringify(envelope);
}

/**
 * Xác thực HMAC và giải mã DES-CBC
 */
export async function decryptDESMessage(envelopeJson, desKeyHex, macKeyHex) {
  let envelope;
  try {
    envelope = typeof envelopeJson === 'string' ? JSON.parse(envelopeJson) : envelopeJson;
  } catch (e) {
    throw new Error('Định dạng Envelope không hợp lệ');
  }

  const { keyId, iv: ivHex, ciphertext: ciphertextHex, mac: macHex } = envelope;

  // 1. Xác thực HMAC-SHA256 trước khi giải mã (KD02)
  const macPayload = `${keyId}:${ivHex}:${ciphertextHex}`;
  const macKeyWordArray = CryptoJS.enc.Hex.parse(macKeyHex);
  const computedMacHex = CryptoJS.HmacSHA256(macPayload, macKeyWordArray).toString(CryptoJS.enc.Hex);

  if (computedMacHex !== macHex) {
    throw new Error('Giải mã thất bại: Dữ liệu bị can thiệp hoặc sai khóa!');
  }

  // 2. Tiến hành giải mã DES-CBC
  try {
    const keyWordArray = CryptoJS.enc.Hex.parse(desKeyHex);
    const ivWordArray = CryptoJS.enc.Hex.parse(ivHex);
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Hex.parse(ciphertextHex)
    });

    const decrypted = CryptoJS.DES.decrypt(cipherParams, keyWordArray, {
      iv: ivWordArray,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decryptedText) throw new Error('Sai khóa giải mã');

    return decryptedText;
  } catch (error) {
    throw new Error('Giải mã thất bại: Dữ liệu bị can thiệp hoặc sai khóa!');
  }
}