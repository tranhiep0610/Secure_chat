import { generateDESKey } from '../../key-manager.js';
import { encryptMessage, decryptMessage } from './des.js';

async function runTests() {
  console.log("--- Bắt đầu kiểm tra Mã hóa DES ---");

  // 1. Kiểm tra Round-trip
  // Hàm generateDESKey() trả về { key, keyId } hoàn toàn tương đồng với AES
  const { key, keyId } = await generateDESKey();
  const originalText = "Xin chào! Đây là tin nhắn bảo mật DES 🔐";

  const envelopeJson = await encryptMessage(originalText, key, keyId);
  const decryptedText = await decryptMessage(envelopeJson, key);

  console.assert(
    originalText === decryptedText, 
    "❌ Test 1 Thất bại: Round-trip không thành công"
  );
  if (originalText === decryptedText) {
    console.log("✅ Test 1 Đạt: Round-trip thành công.");
  }
  // 2. Cùng tin nhắn, cùng khóa: kiểm tra IV và bản mã khác nhau
const envelopeJson2 = await encryptDESMessage(originalText, desKeyHex, macKeyHex, keyId);

// Chuyển chuỗi JSON thành object để lấy từng trường
const envelope1 = JSON.parse(envelopeJson);
const envelope2 = JSON.parse(envelopeJson2);

// Hàm so sánh linh hoạt (hỗ trợ cả Array kiểu AES và String Hex kiểu DES)
function areValuesDifferent(val1, val2) {
  if (Array.isArray(val1) && Array.isArray(val2)) {
    if (val1.length !== val2.length) return true;
    return val1.some((val, idx) => val !== val2[idx]);
  }
  return val1 !== val2; // So sánh trực tiếp chuỗi Hex nếu là DES
}

const ivDifferent = areValuesDifferent(envelope1.iv, envelope2.iv);
const ciphertextDifferent = areValuesDifferent(envelope1.ciphertext, envelope2.ciphertext);

console.assert(
  ivDifferent,
  "❌ Test 2 Thất bại: IV của hai lần mã hóa giống nhau"
);

console.assert(
  ciphertextDifferent,
  "❌ Test 2 Thất bại: Bản mã của hai lần mã hóa giống nhau"
);

if (ivDifferent && ciphertextDifferent) {
  console.log(
    "✅ Test 2 Đạt: Cùng tin nhắn, cùng khóa nhưng IV và bản mã khác nhau"
  );
}
  // 3. Kiểm tra từ chối khi sửa Ciphertext/MAC (KD02)
  const tamperedEnvelope = JSON.parse(envelopeJson);
  tamperedEnvelope.ciphertext = tamperedEnvelope.ciphertext.slice(0, -2) + "00"; // Sửa 1 byte ciphertext

  try {
    await decryptDESMessage(JSON.stringify(tamperedEnvelope), desKeyHex, macKeyHex);
    console.error("❌ Test 3 Thất bại: Không phát hiện dữ liệu bị sửa!");
  } catch (e) {
    console.log("✅ Test 3 Đạt: Đã từ chối bản mã bị chỉnh sửa.");
  }
}

runDESTests();