const express = require("express");
const rateLimit = require("express-rate-limit");

const {
    register,
    login,
    logout,
    getCurrentUser
} = require("../controllers/auth.controller");

const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

// Giới hạn đăng nhập sai:
// tối đa 5 lần trong 15 phút cho mỗi IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút."
    }
});

router.post("/register", register);

// Áp dụng giới hạn cho API đăng nhập
router.post("/login", loginLimiter, login);

router.post("/logout", authMiddleware, logout);

// Phải đăng nhập mới được xem thông tin bản thân
router.get("/me", authMiddleware, getCurrentUser);

module.exports = router;