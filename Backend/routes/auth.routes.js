const express = require("express");
const rateLimit = require("express-rate-limit");

const {
    startRegister,
    resendRegisterOtp,
    verifyRegisterOtp,
    login,
    forgotPassword,
    resetPassword,
    logout,
    getCurrentUser
} = require("../controllers/auth.controller");

const authMiddleware =
    require("../middlewares/auth.middleware");

const router =
    express.Router();


// ============================================================
// LOGIN LIMITER
// ============================================================

const loginLimiter =
    rateLimit({
        windowMs:
            30 * 1000,

        limit:
            process.env.NODE_ENV ===
            "development"
                ? 20
                : 5,

        skipSuccessfulRequests:
            true,

        standardHeaders:
            true,

        legacyHeaders:
            false,

        message: {
            message:
                "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau."
        }
    });


// ============================================================
// OTP SEND LIMITER
// Dev: 20 lần/phút để test.
// Production: 5 lần/10 phút.
// ============================================================

const otpSendLimiter =
    rateLimit({
        windowMs:
            process.env.NODE_ENV ===
            "development"
                ? 60 * 1000
                : 10 * 60 * 1000,

        limit:
            process.env.NODE_ENV ===
            "development"
                ? 20
                : 5,

        standardHeaders:
            true,

        legacyHeaders:
            false,

        message: {
            message:
                "Bạn gửi mã quá nhiều lần. Vui lòng chờ một lúc rồi thử lại."
        }
    });


// ============================================================
// OTP VERIFY LIMITER
// ============================================================

const otpVerifyLimiter =
    rateLimit({
        windowMs:
            10 * 60 * 1000,

        limit:
            process.env.NODE_ENV ===
            "development"
                ? 50
                : 15,

        standardHeaders:
            true,

        legacyHeaders:
            false,

        message: {
            message:
                "Bạn thử OTP quá nhiều lần. Vui lòng thử lại sau."
        }
    });


// ============================================================
// REGISTER
// ============================================================

router.post(
    "/register/start",
    otpSendLimiter,
    startRegister
);


router.post(
    "/register/resend",
    otpSendLimiter,
    resendRegisterOtp
);


router.post(
    "/register/verify",
    otpVerifyLimiter,
    verifyRegisterOtp
);


// Compatibility nếu frontend cũ vẫn gọi POST /register
router.post(
    "/register",
    otpSendLimiter,
    startRegister
);


// ============================================================
// LOGIN
// ============================================================

router.post(
    "/login",
    loginLimiter,
    login
);


// ============================================================
// PASSWORD RESET
// ============================================================

router.post(
    "/password/forgot",
    otpSendLimiter,
    forgotPassword
);


router.post(
    "/password/reset",
    otpVerifyLimiter,
    resetPassword
);


// ============================================================
// SESSION
// ============================================================

router.post(
    "/logout",
    authMiddleware,
    logout
);


router.get(
    "/me",
    authMiddleware,
    getCurrentUser
);


module.exports =
    router;