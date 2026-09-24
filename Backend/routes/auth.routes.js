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

const loginLimiter = rateLimit({
    windowMs: 30 * 1000, // 30 giây
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 30 giây."
    }
});

router.post("/register", register);
router.post("/login", loginLimiter, login);
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, getCurrentUser);

module.exports = router;
