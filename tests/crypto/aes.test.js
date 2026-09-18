import { generateAESKey } from '../../Frontend/js/crypto/key-manager.js';
import { encryptMessage, decryptMessage } from '../../Frontend/js/crypto/aes.js';

export async function runAESTests() {
    console.log("=== BẮT ĐẦU KIỂM TRA AES-GCM ===");

    try {
        // 1. Kiểm tra Round-trip
        const { key, keyId } = await generateAESKey(256);
        const originalText = "Xin chào! Mã hóa bảo mật AES-GCM 🔒";
        
        const envelopeJson = await encryptMessage(originalText, key, keyId);
        const decryptedText = await decryptMessage(envelopeJson, key);

        if (originalText === decryptedText) {
            console.log("✅ [PASSED] Test 1: Round-trip mã hóa -> giải mã thành công.");
        } else {
            console.error("❌ [FAILED] Test 1: Văn bản giải mã không khớp dữ liệu ban đầu!");
        }

       // 2. Cùng tin nhắn, cùng khóa: IV và bản mã phải khác nhau
const envelopeJson2 = await encryptMessage(originalText, key, keyId);

// Chuyển JSON thành đối tượng để lấy riêng IV và ciphertext
const envelope1 = JSON.parse(envelopeJson);
const envelope2 = JSON.parse(envelopeJson2);

// So sánh từng giá trị trong hai mảng
const arraysEqual = (a, b) =>
  a.length === b.length &&
  a.every((value, index) => value === b[index]);

const ivDifferent = !arraysEqual(envelope1.iv, envelope2.iv);
const ciphertextDifferent = !arraysEqual(
  envelope1.ciphertext,
  envelope2.ciphertext
);

if (ivDifferent && ciphertextDifferent) {
  console.log(
    "✅ [PASSED] Test 2: Hai lần mã hóa có IV và ciphertext khác nhau."
  );
} else {
  console.error(
    "❌ [FAILED] Test 2:",
    {
      ivDifferent,
      ciphertextDifferent
    }
  );
}
        // 3. Kiểm tra tính toàn vẹn (Chỉnh sửa ciphertext/tag phải bị từ chối)
        const tamperedEnvelope = JSON.parse(envelopeJson);
        tamperedEnvelope.ciphertext[0] ^= 1; // Sửa đổi 1 bit trong bản mã

        try {
            await decryptMessage(JSON.stringify(tamperedEnvelope), key);
            console.error("❌ [FAILED] Test 3: Không phát hiện bản mã bị can thiệp!");
        } catch (e) {
            console.log("✅ [PASSED] Test 3: Đã từ chối bản mã bị chỉnh sửa.");
        }

    } catch (err) {
        console.error("Lỗi trong quá trình chạy test:", err);
    }
}

// Chạy test
runAESTests();