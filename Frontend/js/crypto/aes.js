const cryptoApi = globalThis.crypto;

if (!cryptoApi?.subtle || !cryptoApi?.getRandomValues) {
  throw new Error('Web Crypto API không khả dụng trong môi trường hiện tại.');
}

/**
 * Mã hóa UTF-8 bằng AES-GCM.
 */
export async function encryptMessage(text, cryptoKey, keyId) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('Dữ liệu đầu vào không hợp lệ.');
  }

  if (!cryptoKey) {
    throw new Error('Khóa AES không hợp lệ.');
  }

  if (typeof keyId !== 'string' || keyId.length === 0) {
    throw new Error('keyId không hợp lệ.');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  // AES-GCM khuyến nghị IV 12 byte (96 bit).
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );

  const envelope = {
    keyId,
    algorithm: 'AES-GCM',
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(ciphertextBuffer)),
    timestamp: Date.now()
  };

  return JSON.stringify(envelope);
}

/**
 * Giải mã Envelope AES-GCM.
 * Web Crypto tự kiểm tra authentication tag; nếu bản mã bị sửa sẽ reject.
 */
export async function decryptMessage(envelopeJson, cryptoKey) {
  if (!cryptoKey) {
    throw new Error('Khóa AES không hợp lệ.');
  }

  let envelope;

  try {
    envelope =
      typeof envelopeJson === 'string'
        ? JSON.parse(envelopeJson)
        : envelopeJson;
  } catch {
    throw new Error('Định dạng Envelope không hợp lệ.');
  }

  if (
    !envelope ||
    envelope.algorithm !== 'AES-GCM' ||
    !Array.isArray(envelope.iv) ||
    envelope.iv.length !== 12 ||
    !Array.isArray(envelope.ciphertext) ||
    envelope.ciphertext.length === 0
  ) {
    throw new Error('Envelope AES không hợp lệ.');
  }

  try {
    const iv = new Uint8Array(envelope.iv);
    const ciphertext = new Uint8Array(envelope.ciphertext);

    const plaintextBuffer = await cryptoApi.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );

    return new TextDecoder().decode(plaintextBuffer);
  } catch {
    throw new Error(
      'Giải mã AES thất bại: dữ liệu bị can thiệp hoặc sai khóa.'
    );
  }
}
