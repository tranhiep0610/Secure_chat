const bcrypt = require("bcryptjs");
const User = require("../models/User");

const normalizeUsername = (username) =>
    typeof username === "string" ? username.trim().toLowerCase() : "";

const normalizeEmail = (email) =>
    typeof email === "string" ? email.trim().toLowerCase() : "";

const isValidEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// =========================
// ĐĂNG KÝ
// =========================
const register = async (req, res) => {
    try {
        const username = normalizeUsername(req.body.username);
        const email = normalizeEmail(req.body.email);
        const password = typeof req.body.password === "string" ? req.body.password : "";

        if (!username || !email || !password) {
            return res.status(400).json({
                message: "Vui lòng nhập đầy đủ username, email và password"
            });
        }

        if (username.length < 3) {
            return res.status(400).json({
                message: "Username phải có ít nhất 3 ký tự"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password phải có ít nhất 6 ký tự"
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                message: "Email không hợp lệ"
            });
        }

        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(409).json({
                message: "Username đã tồn tại"
            });
        }

        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(409).json({
                message: "Email đã tồn tại"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await User.create({
            username,
            email,
            passwordHash
        });

        return res.status(201).json({
            message: "Đăng ký thành công",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Register error:", error);

        if (error?.code === 11000) {
            const duplicateField = Object.keys(error.keyPattern || error.keyValue || {})[0];
            const message = duplicateField === "email"
                ? "Email đã tồn tại"
                : duplicateField === "username"
                    ? "Username đã tồn tại"
                    : "Username hoặc email đã tồn tại";

            return res.status(409).json({ message });
        }

        return res.status(500).json({
            message: "Lỗi máy chủ"
        });
    }
};

// =========================
// ĐĂNG NHẬP
// =========================
const login = async (req, res) => {
    try {
        const username = normalizeUsername(req.body.username);
        const password = typeof req.body.password === "string" ? req.body.password : "";

        if (!username || !password) {
            return res.status(400).json({
                message: "Vui lòng nhập username và password"
            });
        }

        if (username.length < 3) {
            return res.status(400).json({
                message: "Username phải có ít nhất 3 ký tự"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password phải có ít nhất 6 ký tự"
            });
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({
                message: "Username hoặc password không đúng"
            });
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Username hoặc password không đúng"
            });
        }

        req.session.userId = user._id.toString();

        return res.status(200).json({
            message: "Đăng nhập thành công",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            message: "Lỗi máy chủ"
        });
    }
};

// =========================
// ĐĂNG XUẤT
// =========================
const logout = (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error("Logout error:", error);

            return res.status(500).json({
                message: "Không thể đăng xuất"
            });
        }

        res.clearCookie("connect.sid");

        return res.status(200).json({
            message: "Đăng xuất thành công"
        });
    });
};

// =========================
// LẤY NGƯỜI DÙNG HIỆN TẠI
// =========================
const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId)
            .select("-passwordHash");

        if (!user) {
            return res.status(404).json({
                message: "Không tìm thấy người dùng"
            });
        }

        return res.status(200).json({ user });
    } catch (error) {
        console.error("Get current user error:", error);

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
