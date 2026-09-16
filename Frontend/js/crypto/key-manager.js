// Lưu trữ khóa tạm thời trong RAM (Key Storage)
const keyStore = new Map();

/**
 * Tạo khóa AES-GCM (128, 192, 256 bit)
 */
export async function generateAESKey(length = 256) {
    const key = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: length },
        true, // extractable
        ["encrypt", "decrypt"]
    );
    
    // Tạo keyId ngẫu nhiên không mang thông tin khóa bí mật
    const keyId = `key_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    keyStore.set(keyId, key);
    return { key, keyId };
}

/**
 * Lấy khóa theo keyId
 */
export function getKey(keyId) {
    if (!keyStore.has(keyId)) {
        throw new Error(`Không tìm thấy khóa tương ứng với keyId: ${keyId}`);
    }
    return keyStore.get(keyId);
}