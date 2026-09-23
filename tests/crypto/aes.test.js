import { generateAESKey } from '../../Frontend/js/crypto/key-manager.js';
import {
  encryptMessage,
  decryptMessage
} from '../../Frontend/js/crypto/aes.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function arraysEqual(a, b) {
  return (
    a.length === b.length &&
    a.every((value, index) => value === b[index])
  );
}

async function expectReject(action, message) {
  let rejected = false;

  try {
    await action();
  } catch {
    rejected = true;
  }

  assert(rejected, message);
}

async function runAESTests() {
  console.log('--- Bắt đầu kiểm tra AES-GCM ---');

  const { key, keyId } = await generateAESKey(256);
  const originalText =
    'Xin chào! Đây là tin nhắn bảo mật AES 🔐';

  // Test 1: round-trip.
  const envelopeJson = await encryptMessage(
    originalText,
    key,
    keyId
  );

  const decryptedText = await decryptMessage(
    envelopeJson,
    key
  );

  assert(
    decryptedText === originalText,
    'Test 1 thất bại: plaintext sau giải mã không khớp.'
  );

  console.log('✅ Test 1: Round-trip thành công.');

  // Test 2: cùng plaintext + cùng khóa nhưng IV/ciphertext phải khác.
  const envelopeJson2 = await encryptMessage(
    originalText,
    key,
    keyId
  );

  const envelope1 = JSON.parse(envelopeJson);
  const envelope2 = JSON.parse(envelopeJson2);

  assert(
    !arraysEqual(envelope1.iv, envelope2.iv),
    'Test 2 thất bại: IV bị trùng.'
  );

  assert(
    !arraysEqual(
      envelope1.ciphertext,
      envelope2.ciphertext
    ),
    'Test 2 thất bại: ciphertext giống nhau.'
  );

  console.log(
    '✅ Test 2: Cùng dữ liệu nhưng IV và ciphertext khác nhau.'
  );

  // Test 3: AES-GCM phải từ chối ciphertext bị sửa.
  const tamperedEnvelope = JSON.parse(envelopeJson);
  tamperedEnvelope.ciphertext[0] ^= 1;

  await expectReject(
    () =>
      decryptMessage(
        JSON.stringify(tamperedEnvelope),
        key
      ),
    'Test 3 thất bại: ciphertext AES bị sửa nhưng vẫn được chấp nhận.'
  );

  console.log(
    '✅ Test 3: AES-GCM từ chối ciphertext bị chỉnh sửa.'
  );

  console.log('🎉 Tất cả test AES đều PASSED.');
}

runAESTests().catch(error => {
  console.error('❌ AES TEST FAILED:', error);

  if (typeof process !== 'undefined') {
    process.exitCode = 1;
  }
});
