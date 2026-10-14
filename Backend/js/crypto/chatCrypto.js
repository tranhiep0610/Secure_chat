// js/crypto/chatCrypto.js
// Điểm vào duy nhất cho mã hóa tin nhắn: chọn AES hoặc DES theo tên thuật toán.
// Web chỉ cần import file này, không cần gọi trực tiếp aes.js / des.js.
 
import { encryptAESMessage, decryptAESMessage } from './aes.js';
import { encryptDESMessage, decryptDESMessage } from './des.js';
 
export const ALGORITHM_AES = 'AES-GCM';
export const ALGORITHM_DES = 'DES-CBC-HMAC-SHA256';
 
// Backend / giao diện có thể dùng tên rút gọn, quy hết về tên đầy đủ
export function normalizeAlgorithm(name) {
  const value = String(name ?? '').trim().toUpperCase();
  if (value === 'AES' || value === 'AES-GCM') return ALGORITHM_AES;
  if (value === 'DES' || value === 'DES-CBC' || value === 'DES-CBC-HMAC-SHA256') return ALGORITHM_DES;
  throw new Error(`Thuật toán không được hỗ trợ: ${name}`);
}
 
// Mã hóa: trả về envelope (object) để gửi lên server
export function encryptMessage(algorithm, plaintext, passphrase, conversationId, senderId) {
  switch (normalizeAlgorithm(algorithm)) {
    case ALGORITHM_AES: return encryptAESMessage(plaintext, passphrase, conversationId, senderId);
    case ALGORITHM_DES: return encryptDESMessage(plaintext, passphrase, conversationId, senderId);
  }
}
 
// Giải mã: tự nhận thuật toán từ envelope.algorithm
export function decryptMessage(envelope, passphrase, conversationId) {
  if (!envelope) throw new Error('Không có gói mã hóa để giải mã.');
  const algorithm = normalizeAlgorithm(envelope.algorithm);
  const normalized = { ...envelope, algorithm };
  switch (algorithm) {
    case ALGORITHM_AES: return decryptAESMessage(normalized, passphrase, conversationId);
    case ALGORITHM_DES: return decryptDESMessage(normalized, passphrase, conversationId);
  }
}
 
// Giải mã nhưng không ném lỗi: dùng khi hiển thị danh sách tin nhắn
export async function tryDecryptMessage(envelope, passphrase, conversationId, fallback = 'Không giải mã được') {
  try {
    return await decryptMessage(envelope, passphrase, conversationId);
  } catch (err) {
    console.warn('Giải mã lỗi:', err.message, envelope);
    return fallback;
  }
}
 