const argon2 = require("argon2");
const User = require("../models/User");

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const normalizeUsername = (username) =>
    typeof username === "string" ? username.trim().toLowerCase() : "";

const cleanUsername = (username) =>
    typeof username === "string" ? username.trim() : "";

const cleanDisplayName = (displayName) =>
    typeof displayName === "string" ? displayName.trim() : "";

const publicUser = (user) => ({
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    createdAt: user.createdAt
});

const regenerateSession = (req) =>
    new Promise((resolve, reject) => {
        req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });

const saveSession = (req) =>
    new Promise((resolve, reject) => {
        req.session.save((error) => (error ? reject(error) : resolve()));
    });

const destroySession = (req) =>
    new Promise((resolve, reject) => {
        req.session.destroy((error) => (error ? reject(error) : resolve()));
    });

const clearSessionCookie = (res) => {
    res.clearCookie(process.env.SESSION_COOKIE_NAME || "secure_chat.sid", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/"
    });
};

const disconnectUserSockets = (req, userId) => {
    // Đức chỉ cần app.set("io", io) và cho socket của user join room user:<userId>.
    // Nếu Socket.IO chưa được ghép thì hàm này tự bỏ qua.
    const io = req.app.get("io");
    if (io && userId) {
        io.in(`user:${userId}`).disconnectSockets(true);
    }
};

// =========================
// ĐĂNG KÝ
// POST /api/auth/register
// body: { username, displayName, password }
// =========================
const register = async (req, res) => {
    try {
        const username = cleanUsername(req.body?.username);
        const usernameNormalized = normalizeUsername(username);
        const displayName = cleanDisplayName(req.body?.displayName);
        const password = typeof req.body?.password === "string" ? req.body.password : "";

        if (!username || !displayName || !password) {
            return res.status(400).json({
                message: "Vui lòng nhập đầy đủ username, displayName và password"
            });
        }

        if (!USERNAME_REGEX.test(username)) {
            return res.status(400).json({
                message: "Username phải dài 3-32 ký tự và chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang"
            });
        }

        if (displayName.length > 50) {
            return res.status(400).json({
                message: "Tên hiển thị tối đa 50 ký tự"
            });
        }

        if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
            return res.status(400).json({
                message: `Password phải dài ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} ký tự`
            });
        }

        const existingUser = await User.exists({ usernameNormalized });
        if (existingUser) {
            return res.status(409).json({
                message: "Username đã tồn tại"
            });
        }

        const passwordHash = await argon2.hash(password, {
            type: argon2.argon2id
        });

        const user = await User.create({
            username,
            usernameNormalized,
            displayName,
            passwordHash
        });

        return res.status(201).json({
            message: "Đăng ký thành công",
            user: publicUser(user)
        });
    } catch (error) {
        console.error("Register error:", error.message);

        // Chống race condition khi hai request cùng đăng ký một username.
        if (error?.code === 11000) {
            return res.status(409).json({
                message: "Username đã tồn tại"
            });
        }

        return res.status(500).json({
            message: "Lỗi máy chủ"
        });
    }
};

// =========================
// ĐĂNG NHẬP
// POST /api/auth/login
// body: { username, password }
// =========================
const login = async (req, res) => {
    try {
        const usernameNormalized = normalizeUsername(req.body?.username);
        const password = typeof req.body?.password === "string" ? req.body.password : "";

        if (!usernameNormalized || !password) {
            return res.status(400).json({
                message: "Vui lòng nhập username và password"
            });
        }

        const user = await User.findOne({ usernameNormalized }).select("+passwordHash");

        if (!user) {
            return res.status(401).json({
                message: "Username hoặc password không đúng"
            });
        }

        const passwordMatch = await argon2.verify(user.passwordHash, password);

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Username hoặc password không đúng"
            });
        }

        // Tạo session ID mới sau đăng nhập để tránh session fixation.
        await regenerateSession(req);
        req.session.userId = user._id.toString();
        await saveSession(req);

        return res.status(200).json({
            message: "Đăng nhập thành công",
            user: publicUser(user)
        });
    } catch (error) {
        console.error("Login error:", error.message);
        return res.status(500).json({
            message: "Lỗi máy chủ"
        });
    }
};

// =========================
// ĐĂNG XUẤT
// POST /api/auth/logout
// =========================
const logout = async (req, res) => {
    const userId = req.session?.userId;

    try {
        disconnectUserSockets(req, userId);
        await destroySession(req);
        clearSessionCookie(res);

        return res.status(200).json({
            message: "Đăng xuất thành công"
        });
    } catch (error) {
        console.error("Logout error:", error.message);
        return res.status(500).json({
            message: "Không thể đăng xuất"
        });
    }
};

// =========================
// LẤY NGƯỜI DÙNG HIỆN TẠI
// GET /api/auth/me
// =========================
const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId)
            .select("_id username displayName createdAt");

        if (!user) {
            // Session còn nhưng user không còn tồn tại -> coi như chưa đăng nhập.
            try {
                await destroySession(req);
            } catch (_error) {
                // Không làm lộ lỗi nội bộ cho client.
            }
            clearSessionCookie(res);

            return res.status(401).json({
                message: "Phiên đăng nhập không còn hợp lệ"
            });
        }

        return res.status(200).json({
            user: publicUser(user)
        });
    } catch (error) {
        console.error("Get current user error:", error.message);
        return res.status(500).json({
            message: "Lỗi máy chủ"
        });
    }
};

module.exports = {
    register,
    login,
    logout,
    getCurrentUser
};
