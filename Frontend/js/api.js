const API_URL = "http://localhost:3000";

// Hàm gọi API chung
async function request(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            headers: {
                "Content-Type": "application/json",
                ...options.headers
            },
            ...options
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Lỗi API");
        }

        return data;

    } catch (error) {
        console.error("API Error:", error);
        throw error;
    }
}

// ==========================
// USER
// ==========================

// Lấy danh sách người dùng
export async function getUsers() {
    return await request("/api/users");
}

// Tìm người dùng
export async function searchUsers(keyword) {
    return await request(
        `/api/users/search?q=${encodeURIComponent(keyword)}`
    );
}

// ==========================
// AUTH
// ==========================

export async function login(username, password) {
    return await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
            username,
            password
        })
    });
}

export async function register(username, password) {
    return await request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
            username,
            password
        })
    });
}

// ==========================
// MESSAGE
// ==========================

// Lấy lịch sử chat
export async function getMessages(userId) {
    return await request(`/api/messages/${userId}`);
}

// Gửi tin nhắn bằng API
export async function sendMessage(receiverId, message) {
    return await request("/api/messages", {
        method: "POST",
        body: JSON.stringify({
            receiverId,
            message
        })
    });
}

export { API_URL };