import { generateDESKey } from '../../Frontend/js/crypto/key-manager.js';
import {
  encryptDESMessage,
  decryptDESMessage
} from '../../Frontend/js/crypto/des.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function mutateLastHexByte(hex) {
  const lastByte = hex.slice(-2).toLowerCase();
  const replacement = lastByte === '00' ? '01' : '00';
  return hex.slice(0, -2) + replacement;
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

async function runDESTests() {
  console.log('--- Bắt đầu kiểm tra DES-CBC + HMAC-SHA256 ---');

  const {
    key: { desKeyHex, macKeyHex },
    keyId
  } = generateDESKey();

  const originalText =
    'Xin chào! Đây là tin nhắn bảo mật DES 🔐';

  // Test 1: round-trip.
  const envelopeJson = await encryptDESMessage(
    originalText,
    desKeyHex,
    macKeyHex,
    keyId
  );

  const decryptedText = await decryptDESMessage(
    envelopeJson,
    desKeyHex,
    macKeyHex
  );

  assert(
    decryptedText === originalText,
    'Test 1 thất bại: plaintext sau giải mã không khớp.'
  );

  console.log('✅ Test 1: Round-trip thành công.');

  // Test 2: cùng plaintext + cùng khóa nhưng IV/ciphertext phải khác.
  const envelopeJson2 = await encryptDESMessage(
    originalText,
    desKeyHex,
    macKeyHex,
    keyId
  );

  const envelope1 = JSON.parse(envelopeJson);
  const envelope2 = JSON.parse(envelopeJson2);

  assert(
    envelope1.iv !== envelope2.iv,
    'Test 2 thất bại: IV của hai lần mã hóa bị trùng.'
  );

  assert(
    envelope1.ciphertext !== envelope2.ciphertext,
    'Test 2 thất bại: ciphertext của hai lần mã hóa giống nhau.'
  );

  console.log(
    '✅ Test 2: Cùng dữ liệu nhưng IV và ciphertext khác nhau.'
  );

  // Test 3: sửa ciphertext phải bị HMAC từ chối.
  const tamperedCiphertext = {
    ...envelope1,
    ciphertext: mutateLastHexByte(envelope1.ciphertext)
  };

  await expectReject(
    () =>
      decryptDESMessage(
        JSON.stringify(tamperedCiphertext),
        desKeyHex,
        macKeyHex
      ),
    'Test 3 thất bại: ciphertext bị sửa nhưng vẫn được chấp nhận.'
  );

  console.log('✅ Test 3: Phát hiện ciphertext bị chỉnh sửa.');

  // Test 4: sửa MAC phải bị từ chối.
  const tamperedMac = {
    ...envelope1,
    mac: mutateLastHexByte(envelope1.mac)
  };

  await expectReject(
    () =>
      decryptDESMessage(
        JSON.stringify(tamperedMac),
        desKeyHex,
        macKeyHex
      ),
    'Test 4 thất bại: MAC bị sửa nhưng vẫn được chấp nhận.'
  );

  console.log('✅ Test 4: Phát hiện MAC bị chỉnh sửa.');

  // Test 5: dùng sai khóa phải thất bại.
  const {
    key: {
      desKeyHex: wrongDesKeyHex,
      macKeyHex: wrongMacKeyHex
    }
  } = generateDESKey();

  await expectReject(
    () =>
      decryptDESMessage(
        envelopeJson,
        wrongDesKeyHex,
        wrongMacKeyHex
      ),
    'Test 5 thất bại: dùng sai khóa nhưng vẫn giải mã được.'
  );

  console.log('✅ Test 5: Từ chối khóa sai.');

  console.log('🎉 Tất cả test DES đều PASSED.');
}

runDESTests().catch(error => {
  console.error('❌ DES TEST FAILED:', error);

  if (typeof process !== 'undefined') {
    process.exitCode = 1;
  }
});
