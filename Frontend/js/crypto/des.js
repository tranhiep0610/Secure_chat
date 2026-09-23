import CryptoJS from 'crypto-js';

console.warn(
  'CẢNH BÁO: DES đã lỗi thời và không an toàn cho hệ thống thực tế. ' +
  'Chỉ dùng trong dự án để học tập/so sánh benchmark.'
);

const DES_KEY_HEX_LENGTH = 16; // 8 byte
const MAC_KEY_HEX_LENGTH = 64; // 32 byte

function isHex(value, expectedLength) {
  return (
    typeof value === 'string' &&
    value.length === expectedLength &&
    /^[0-9a-fA-F]+$/.test(value)
  );
}

function validateKeys(desKeyHex, macKeyHex) {
  if (!isHex(desKeyHex, DES_KEY_HEX_LENGTH)) {
    throw new Error('Khóa DES không hợp lệ: cần đúng 8 byte (16 ký tự hex).');
  }

  if (!isHex(macKeyHex, MAC_KEY_HEX_LENGTH)) {
    throw new Error('Khóa HMAC không hợp lệ: cần đúng 32 byte (64 ký tự hex).');
  }
}

function createMacPayload({ algorithm, keyId, timestamp, iv, ciphertext }) {
  return `${algorithm}:${keyId}:${timestamp}:${iv}:${ciphertext}`;
}

function calculateHmacHex(payload, macKeyHex) {
  const macKeyWordArray = CryptoJS.enc.Hex.parse(macKeyHex);

  return CryptoJS.HmacSHA256(payload, macKeyWordArray)
    .toString(CryptoJS.enc.Hex);
}

// So sánh hai MAC mà không dừng ngay tại byte đầu tiên khác nhau.
function constantTimeEqualHex(a, b) {
  if (
    typeof a !== 'string' ||
    typeof b !== 'string' ||
    a.length !== b.length
  ) {
    return false;
  }

  let diff = 0;

  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

/**
 * Mã hóa DES-CBC + HMAC-SHA256 theo mô hình Encrypt-then-MAC.
 *
 * @returns {Promise<string>} Envelope JSON
 */
export async function encryptDESMessage(
  text,
  desKeyHex,
  macKeyHex,
  keyId
) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('Dữ liệu đầu vào không hợp lệ.');
  }

  if (typeof keyId !== 'string' || keyId.length === 0) {
    throw new Error('keyId không hợp lệ.');
  }

  validateKeys(desKeyHex, macKeyHex);

  // DES-CBC sử dụng IV 8 byte.
  const ivWordArray = CryptoJS.lib.WordArray.random(8);
  const ivHex = ivWordArray.toString(CryptoJS.enc.Hex);

  const desKeyWordArray = CryptoJS.enc.Hex.parse(desKeyHex);

  const encrypted = CryptoJS.DES.encrypt(text, desKeyWordArray, {
    iv: ivWordArray,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  const ciphertextHex = encrypted.ciphertext
    .toString(CryptoJS.enc.Hex);

  const envelope = {
    keyId,
    algorithm: 'DES-CBC',
    iv: ivHex,
    ciphertext: ciphertextHex,
    timestamp: Date.now()
  };

  // HMAC bảo vệ cả metadata quan trọng + IV + ciphertext.
  const macPayload = createMacPayload(envelope);
  envelope.mac = calculateHmacHex(macPayload, macKeyHex);

  return JSON.stringify(envelope);
}

/**
 * Kiểm tra HMAC trước, sau đó mới giải mã DES-CBC.
 *
 * @returns {Promise<string>}
 */
export async function decryptDESMessage(
  envelopeJson,
  desKeyHex,
  macKeyHex
) {
  validateKeys(desKeyHex, macKeyHex);

  let envelope;

  try {
    envelope =
      typeof envelopeJson === 'string'
        ? JSON.parse(envelopeJson)
        : envelopeJson;
  } catch {
    throw new Error('Định dạng Envelope không hợp lệ.');
  }

  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Định dạng Envelope không hợp lệ.');
  }

  const {
    keyId,
    algorithm,
    iv,
    ciphertext,
    mac,
    timestamp
  } = envelope;

  if (
    algorithm !== 'DES-CBC' ||
    typeof keyId !== 'string' ||
    !Number.isFinite(timestamp) ||
    !isHex(iv, 16) ||
    typeof ciphertext !== 'string' ||
    ciphertext.length === 0 ||
    ciphertext.length % 16 !== 0 ||
    !/^[0-9a-fA-F]+$/.test(ciphertext) ||
    !isHex(mac, 64)
  ) {
    throw new Error('Envelope DES không hợp lệ.');
  }

  // Encrypt-then-MAC: luôn xác thực trước khi giải mã.
  const macPayload = createMacPayload({
    algorithm,
    keyId,
    timestamp,
    iv,
    ciphertext
  });

  const computedMac = calculateHmacHex(macPayload, macKeyHex);

  if (!constantTimeEqualHex(computedMac, mac)) {
    throw new Error(
      'Giải mã thất bại: dữ liệu bị can thiệp hoặc sai khóa MAC.'
    );
  }

  try {
    const desKeyWordArray = CryptoJS.enc.Hex.parse(desKeyHex);
    const ivWordArray = CryptoJS.enc.Hex.parse(iv);

    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Hex.parse(ciphertext)
    });

    const decrypted = CryptoJS.DES.decrypt(
      cipherParams,
      desKeyWordArray,
      {
        iv: ivWordArray,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );

    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

    if (!plaintext) {
      throw new Error('Sai khóa DES hoặc dữ liệu không hợp lệ.');
    }

    return plaintext;
  } catch {
    throw new Error(
      'Giải mã thất bại: dữ liệu bị can thiệp hoặc sai khóa DES.'
    );
  }
}
