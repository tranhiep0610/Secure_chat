/**
 * Mã hóa dữ liệu UTF-8 với AES-GCM và tạo Envelope
 */
export async function encryptMessage(text, cryptoKey, keyId) {
    if (!text || typeof text !== 'string') {
        throw new Error('Dữ liệu đầu vào không hợp lệ');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // IV ngẫu nhiên 12-byte (96-bit) cho AES-GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        cryptoKey,
        data
    );

    // Cấu trúc Envelope tuân thủ quy ước dự án
    const envelope = {
        keyId: keyId,
        algorithm: "AES-GCM",
        iv: Array.from(iv),
        ciphertext: Array.from(new Uint8Array(ciphertextBuffer)),
        timestamp: Date.now()
    };

    return JSON.stringify(envelope);
}

/**
 * Giải mã Envelope và kiểm tra tính toàn vẹn
 */
export async function decryptMessage(envelopeJson, cryptoKey) {
    let envelope;
    try {
        envelope = typeof envelopeJson === 'string' ? JSON.parse(envelopeJson) : envelopeJson;
    } catch (e) {
        throw new Error('Định dạng Envelope không hợp lệ');
    }

    const iv = new Uint8Array(envelope.iv);
    const ciphertext = new Uint8Array(envelope.ciphertext);

    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            cryptoKey,
            ciphertext
        );

        const decoder = new TextDecoder();
        return decoder.decode(decryptedBuffer);
    } catch (error) {
        // Tự động từ chối nếu ciphertext hoặc auth tag bị can thiệp
        throw new Error('Giải mã thất bại: Dữ liệu bị chỉnh sửa hoặc sai khóa!');
    }
}