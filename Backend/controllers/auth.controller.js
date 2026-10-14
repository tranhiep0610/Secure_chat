const crypto = require("crypto");
const argon2 = require("argon2");

const User = require("../models/User");
const PendingRegistration = require("../models/PendingRegistration");
const PasswordResetOtp = require("../models/PasswordResetOtp");

const {
    sendOtpEmail
} = require("../services/email.service");


const USERNAME_REGEX =
    /^[a-zA-Z0-9._-]{3,32}$/;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const OTP_LIFETIME_MS =
    5 * 60 * 1000;

const MAX_OTP_ATTEMPTS =
    5;


// ============================================================
// NORMALIZE / CLEAN
// ============================================================

const cleanUsername = (username) =>
    typeof username === "string"
        ? username.trim()
        : "";


const normalizeUsername = (username) =>
    typeof username === "string"
        ? username.trim().toLowerCase()
        : "";


const cleanDisplayName = (displayName) =>
    typeof displayName === "string"
        ? displayName.trim()
        : "";


const cleanEmail = (email) =>
    typeof email === "string"
        ? email.trim()
        : "";


const normalizeEmail = (email) =>
    typeof email === "string"
        ? email.trim().toLowerCase()
        : "";


const isValidEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);


const publicUser = (user) => ({
    id:
        user._id.toString(),

    username:
        user.username,

    displayName:
        user.displayName,

    email:
        user.email,

    emailVerified:
        user.emailVerified === true,

    createdAt:
        user.createdAt
});


// ============================================================
// SESSION
// ============================================================

const regenerateSession = (req) =>
    new Promise(
        (resolve, reject) => {

            req.session.regenerate(
                (error) =>
                    error
                        ? reject(error)
                        : resolve()
            );
        }
    );


const saveSession = (req) =>
    new Promise(
        (resolve, reject) => {

            req.session.save(
                (error) =>
                    error
                        ? reject(error)
                        : resolve()
            );
        }
    );


const destroySession = (req) =>
    new Promise(
        (resolve, reject) => {

            req.session.destroy(
                (error) =>
                    error
                        ? reject(error)
                        : resolve()
            );
        }
    );


const clearSessionCookie = (res) => {

    res.clearCookie(
        process.env.SESSION_COOKIE_NAME ||
        "secure_chat.sid",
        {
            httpOnly:
                true,

            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",

            secure:
                process.env.NODE_ENV ===
                "production",

            path:
                "/"
        }
    );
};


const disconnectUserSockets = (
    req,
    userId
) => {

    const io =
        req.app.get("io");


    if (
        io &&
        userId
    ) {

        io
            .in(
                `user:${userId}`
            )
            .disconnectSockets(
                true
            );
    }
};


// ============================================================
// OTP
// ============================================================

const createOtp = () =>
    String(
        crypto.randomInt(
            100000,
            1000000
        )
    );


const hashOtp = (code) => {

    const pepper =
        process.env.EMAIL_OTP_PEPPER;


    if (!pepper) {

        throw new Error(
            "Thiếu EMAIL_OTP_PEPPER trong .env"
        );
    }


    return crypto
        .createHmac(
            "sha256",
            pepper
        )
        .update(
            String(code)
        )
        .digest(
            "hex"
        );
};


const otpMatches = (
    code,
    expectedHash
) => {

    const actual =
        Buffer.from(
            hashOtp(code),
            "hex"
        );


    const expected =
        Buffer.from(
            String(
                expectedHash ||
                ""
            ),
            "hex"
        );


    return (
        actual.length ===
            expected.length &&

        crypto.timingSafeEqual(
            actual,
            expected
        )
    );
};


const otpExpiresAt = () =>
    new Date(
        Date.now() +
        OTP_LIFETIME_MS
    );


// ============================================================
// VALIDATE REGISTER INPUT
// ============================================================

function validateRegisterInput({
    username,
    displayName,
    email,
    password
}) {

    if (
        !username ||
        !displayName ||
        !email ||
        !password
    ) {

        return "Vui lòng nhập đầy đủ username, tên hiển thị, email và mật khẩu";
    }


    if (
        !USERNAME_REGEX.test(
            username
        )
    ) {

        return "Username phải dài 3-32 ký tự và chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang";
    }


    if (
        displayName.length >
        50
    ) {

        return "Tên hiển thị tối đa 50 ký tự";
    }


    if (
        !isValidEmail(
            email
        )
    ) {

        return "Email không hợp lệ";
    }


    if (
        password.length <
            MIN_PASSWORD_LENGTH ||

        password.length >
            MAX_PASSWORD_LENGTH
    ) {

        return `Password phải dài ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} ký tự`;
    }


    return null;
}


// ============================================================
// 1. BẮT ĐẦU ĐĂNG KÝ
// POST /api/auth/register/start
//
// KHÔNG TẠO USER Ở BƯỚC NÀY.
// Chỉ lưu tạm PendingRegistration + gửi OTP.
// ============================================================

const startRegister = async (
    req,
    res
) => {

    let pending =
        null;


    try {

        const username =
            cleanUsername(
                req.body?.username
            );


        const usernameNormalized =
            normalizeUsername(
                username
            );


        const displayName =
            cleanDisplayName(
                req.body?.displayName
            );


        const email =
            cleanEmail(
                req.body?.email
            );


        const emailNormalized =
            normalizeEmail(
                email
            );


        const password =
            typeof req.body?.password ===
            "string"
                ? req.body.password
                : "";


        const validationError =
            validateRegisterInput({
                username,
                displayName,
                email:
                    emailNormalized,
                password
            });


        if (validationError) {

            return res
                .status(400)
                .json({
                    message:
                        validationError
                });
        }


        // ----------------------------------------------------
        // Chỉ kiểm tra email/username đã thuộc USER THẬT chưa.
        // Email mới hoàn toàn vẫn được đăng ký bình thường.
        // ----------------------------------------------------

        const existingUser =
            await User.findOne({
                $or: [
                    {
                        usernameNormalized
                    },
                    {
                        emailNormalized
                    }
                ]
            });


        if (existingUser) {

            return res
                .status(409)
                .json({
                    message:
                        "Username hoặc email đã được sử dụng"
                });
        }


        // ----------------------------------------------------
        // Hash password trước khi lưu tạm.
        // Không lưu password plain text.
        // ----------------------------------------------------

        const passwordHash =
            await argon2.hash(
                password,
                {
                    type:
                        argon2.argon2id
                }
            );


        const code =
            createOtp();


        // ----------------------------------------------------
        // Xóa request đăng ký cũ cùng username/email
        // để tránh tồn tại nhiều OTP song song.
        // ----------------------------------------------------

        await PendingRegistration
            .deleteMany({
                $or: [
                    {
                        usernameNormalized
                    },
                    {
                        emailNormalized
                    }
                ]
            });


        // ----------------------------------------------------
        // Tạo dữ liệu TẠM.
        // Đây chưa phải User.
        // ----------------------------------------------------

        pending =
            await PendingRegistration
                .create({
                    username,
                    usernameNormalized,
                    displayName,
                    email,
                    emailNormalized,
                    passwordHash,

                    otpHash:
                        hashOtp(code),

                    attempts:
                        0,

                    expiresAt:
                        otpExpiresAt()
                });


        // ----------------------------------------------------
        // Gửi OTP tới email vừa nhập.
        // Email này có thể hoàn toàn mới với SecureChat.
        // ----------------------------------------------------

        const mailInfo = await sendOtpEmail({
    to: pending.email,
    code,
    purpose: "register"
});

const accepted =
    Array.isArray(mailInfo?.accepted)
        ? mailInfo.accepted.map(x => String(x).toLowerCase())
        : [];

if (!accepted.includes(pending.email.toLowerCase())) {
    throw new Error(
        "Gmail chưa chấp nhận địa chỉ nhận OTP"
    );
}


        return res
            .status(200)
            .json({
                message:
                    "Đã gửi mã OTP 6 số tới email",

                email
            });

    } catch (error) {

        console.error(
            "Start register error:",
            error
        );


        // Nếu Gmail gửi lỗi thì xóa Pending vừa tạo.
        // Không để đăng ký dở dang vô thời hạn.
        if (pending?._id) {

            try {

                await PendingRegistration
                    .deleteOne({
                        _id:
                            pending._id
                    });

            } catch {}
        }


        if (
            error?.code ===
            11000
        ) {

            return res
                .status(409)
                .json({
                    message:
                        "Username hoặc email đang được sử dụng"
                });
        }


        return res
    .status(500)
    .json({
        message:
            process.env.NODE_ENV === "development"
                ? `Đăng ký lỗi: ${error.message}`
                : "Không thể gửi mã xác thực"
    });
    }
};


// ============================================================
// 2. GỬI LẠI OTP ĐĂNG KÝ
// POST /api/auth/register/resend
// body: { email }
// ============================================================

const resendRegisterOtp = async (
    req,
    res
) => {

    try {

        const emailNormalized =
            normalizeEmail(
                req.body?.email
            );


        if (
            !isValidEmail(
                emailNormalized
            )
        ) {

            return res
                .status(400)
                .json({
                    message:
                        "Email không hợp lệ"
                });
        }


        const pending =
            await PendingRegistration
                .findOne({
                    emailNormalized
                });


        if (!pending) {

            return res
                .status(404)
                .json({
                    message:
                        "Không tìm thấy đăng ký đang chờ xác thực"
                });
        }


        // Nếu lúc chờ OTP đã có user khác lấy username/email
        // thì hủy pending.
        const existingUser =
            await User.findOne({
                $or: [
                    {
                        usernameNormalized:
                            pending.usernameNormalized
                    },
                    {
                        emailNormalized:
                            pending.emailNormalized
                    }
                ]
            });


        if (existingUser) {

            await PendingRegistration
                .deleteOne({
                    _id:
                        pending._id
                });


            return res
                .status(409)
                .json({
                    message:
                        "Username hoặc email đã được sử dụng"
                });
        }


        const code =
            createOtp();


        pending.otpHash =
            hashOtp(code);


        pending.attempts =
            0;


        pending.expiresAt =
            otpExpiresAt();


        await pending.save();


        const mailInfo = await sendOtpEmail({
    to: email,
    code,
    purpose: "register"
});

const accepted =
    Array.isArray(mailInfo?.accepted)
        ? mailInfo.accepted.map(x => String(x).toLowerCase())
        : [];

if (!accepted.includes(email.toLowerCase())) {
    throw new Error(
        "Gmail chưa chấp nhận địa chỉ nhận OTP"
    );
}


        return res.json({
            message:
                "Đã gửi OTP mới tới email"
        });

    } catch (error) {

        console.error(
            "Resend register OTP error:",
            error
        );


        return res
            .status(500)
            .json({
                message:
                    "Không thể gửi lại OTP"
            });
    }
};


// ============================================================
// 3. XÁC THỰC OTP ĐĂNG KÝ
// POST /api/auth/register/verify
// body: { email, code }
//
// CHỈ KHI OTP ĐÚNG MỚI TẠO USER.
// ============================================================

const verifyRegisterOtp = async (
    req,
    res
) => {

    try {

        const emailNormalized =
            normalizeEmail(
                req.body?.email
            );


        const code =
            String(
                req.body?.code ||
                req.body?.otp ||
                ""
            ).trim();


        if (
            !isValidEmail(
                emailNormalized
            ) ||
            !/^\d{6}$/.test(
                code
            )
        ) {

            return res
                .status(400)
                .json({
                    message:
                        "Email hoặc OTP không hợp lệ"
                });
        }


        const pending =
            await PendingRegistration
                .findOne({
                    emailNormalized
                });


        if (!pending) {

            return res
                .status(404)
                .json({
                    message:
                        "Không tìm thấy đăng ký đang chờ xác thực"
                });
        }


        if (
            pending.expiresAt <=
            new Date()
        ) {

            return res
                .status(400)
                .json({
                    message:
                        "OTP đã hết hạn. Hãy gửi lại mã mới."
                });
        }


        if (
            pending.attempts >=
            MAX_OTP_ATTEMPTS
        ) {

            return res
                .status(429)
                .json({
                    message:
                        "Bạn nhập sai quá nhiều lần. Hãy gửi lại OTP."
                });
        }


        if (
            !otpMatches(
                code,
                pending.otpHash
            )
        ) {

            pending.attempts +=
                1;


            await pending.save();


            return res
                .status(400)
                .json({
                    message:
                        "OTP không đúng"
                });
        }


        // Kiểm tra lại lần cuối trước khi tạo User.
        const existingUser =
            await User.findOne({
                $or: [
                    {
                        usernameNormalized:
                            pending.usernameNormalized
                    },
                    {
                        emailNormalized:
                            pending.emailNormalized
                    }
                ]
            });


        if (existingUser) {

            await PendingRegistration
                .deleteOne({
                    _id:
                        pending._id
                });


            return res
                .status(409)
                .json({
                    message:
                        "Username hoặc email đã được sử dụng"
                });
        }


        // ----------------------------------------------------
        // OTP ĐÚNG -> BÂY GIỜ MỚI TẠO USER THẬT.
        // ----------------------------------------------------

        const user =
            await User.create({
                username:
                    pending.username,

                usernameNormalized:
                    pending.usernameNormalized,

                displayName:
                    pending.displayName,

                email:
                    pending.email,

                emailNormalized:
                    pending.emailNormalized,

                emailVerified:
                    true,

                passwordHash:
                    pending.passwordHash
            });


        await PendingRegistration
            .deleteOne({
                _id:
                    pending._id
            });


        return res
            .status(201)
            .json({
                message:
                    "Xác thực email và tạo tài khoản thành công",

                user:
                    publicUser(user)
            });

    } catch (error) {

        console.error(
            "Verify register OTP error:",
            error
        );


        if (
            error?.code ===
            11000
        ) {

            return res
                .status(409)
                .json({
                    message:
                        "Username hoặc email đã được sử dụng"
                });
        }


        return res
            .status(500)
            .json({
                message:
                    "Không thể hoàn tất đăng ký"
            });
    }
};


// ============================================================
// ĐĂNG NHẬP
// POST /api/auth/login
//
// UI hiện tại:
// {
//   username,
//   email,
//   password
// }
//
// username + email phải thuộc cùng 1 user.
// ============================================================

const login = async (
    req,
    res
) => {

    try {

        const username =
            cleanUsername(
                req.body?.username
            );


        const email =
            cleanEmail(
                req.body?.email
            );


        const identifier =
            typeof (req.body?.identifier ?? req.body?.identity) ===
            "string"
                ? String(req.body?.identifier ?? req.body?.identity).trim()
                : "";


        const password =
            typeof req.body?.password ===
            "string"
                ? req.body.password
                : "";


        if (!password) {

            return res
                .status(400)
                .json({
                    message:
                        "Vui lòng nhập mật khẩu"
                });
        }


        let query =
            null;


        if (
            username &&
            email
        ) {

            query = {
                usernameNormalized:
                    normalizeUsername(
                        username
                    ),

                emailNormalized:
                    normalizeEmail(
                        email
                    )
            };

        } else {

            const value =
                identifier ||
                username ||
                email;


            if (!value) {

                return res
                    .status(400)
                    .json({
                        message:
                            "Vui lòng nhập tài khoản"
                    });
            }


            query =
                value.includes("@")
                    ? {
                        emailNormalized:
                            normalizeEmail(
                                value
                            )
                    }
                    : {
                        usernameNormalized:
                            normalizeUsername(
                                value
                            )
                    };
        }


        const user =
            await User
                .findOne(
                    query
                )
                .select(
                    "+passwordHash"
                );


        if (!user) {

            return res
                .status(401)
                .json({
                    message:
                        "Username, email hoặc mật khẩu không đúng"
                });
        }


        if (
            user.emailVerified !==
            true
        ) {

            return res
                .status(403)
                .json({
                    message:
                        "Email chưa được xác thực"
                });
        }


        const passwordMatch =
            await argon2.verify(
                user.passwordHash,
                password
            );


        if (!passwordMatch) {

            return res
                .status(401)
                .json({
                    message:
                        "Username, email hoặc mật khẩu không đúng"
                });
        }


        await regenerateSession(
            req
        );


        req.session.userId =
            user._id.toString();


        await saveSession(
            req
        );


        return res.json({
            message:
                "Đăng nhập thành công",

            user:
                publicUser(user)
        });

    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        return res
            .status(500)
            .json({
                message:
                    "Lỗi máy chủ"
            });
    }
};


// ============================================================
// QUÊN MẬT KHẨU
// POST /api/auth/password/forgot
// body: { email }
// ============================================================

const forgotPassword = async (
    req,
    res
) => {

    try {

        const emailNormalized =
            normalizeEmail(
                req.body?.email
            );


        if (
            !isValidEmail(
                emailNormalized
            )
        ) {

            return res
                .status(400)
                .json({
                    message:
                        "Email không hợp lệ"
                });
        }


        const user =
            await User.findOne({
                emailNormalized
            });


        // Không tiết lộ email có tồn tại hay không.
        if (
            !user ||
            user.emailVerified !==
                true
        ) {

            return res.json({
                message:
                    "Nếu email tồn tại, OTP đã được gửi"
            });
        }


        const code =
            createOtp();


        await PasswordResetOtp
            .deleteMany({
                userId:
                    user._id
            });


        await PasswordResetOtp
            .create({
                userId:
                    user._id,

                emailNormalized:
                    user.emailNormalized,

                otpHash:
                    hashOtp(code),

                attempts:
                    0,

                expiresAt:
                    otpExpiresAt()
            });


        await sendOtpEmail({
            to:
                user.email,

            code,

            purpose:
                "reset-password"
        });


        return res.json({
            message:
                "Nếu email tồn tại, OTP đã được gửi"
        });

    } catch (error) {

        console.error(
            "Forgot password error:",
            error
        );


        return res
            .status(500)
            .json({
                message:
                    "Không thể gửi OTP đặt lại mật khẩu"
            });
    }
};


// ============================================================
// RESET PASSWORD
// POST /api/auth/password/reset
// body: { email, code, newPassword }
// ============================================================

const resetPassword = async (
    req,
    res
) => {

    try {

        const emailNormalized =
            normalizeEmail(
                req.body?.email
            );


        const code =
            String(
                req.body?.code ||
                req.body?.otp ||
                ""
            ).trim();


        const newPassword =
            typeof req.body?.newPassword ===
            "string"
                ? req.body.newPassword
                : "";


        if (
            !isValidEmail(
                emailNormalized
            ) ||
            !/^\d{6}$/.test(
                code
            )
        ) {

            return res
                .status(400)
                .json({
                    message:
                        "Email hoặc OTP không hợp lệ"
                });
        }


        if (
            newPassword.length <
                MIN_PASSWORD_LENGTH ||

            newPassword.length >
                MAX_PASSWORD_LENGTH
        ) {

            return res
                .status(400)
                .json({
                    message:
                        `Password phải dài ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} ký tự`
                });
        }


        const user =
            await User.findOne({
                emailNormalized
            });


        if (!user) {

            return res
                .status(400)
                .json({
                    message:
                        "OTP không hợp lệ hoặc đã hết hạn"
                });
        }


        const reset =
            await PasswordResetOtp
                .findOne({
                    userId:
                        user._id,

                    emailNormalized
                });


        if (
            !reset ||
            reset.expiresAt <=
                new Date()
        ) {

            return res
                .status(400)
                .json({
                    message:
                        "OTP không hợp lệ hoặc đã hết hạn"
                });
        }


        if (
            reset.attempts >=
            MAX_OTP_ATTEMPTS
        ) {

            return res
                .status(429)
                .json({
                    message:
                        "Bạn nhập sai quá nhiều lần. Hãy yêu cầu OTP mới."
                });
        }


        if (
            !otpMatches(
                code,
                reset.otpHash
            )
        ) {

            reset.attempts +=
                1;


            await reset.save();


            return res
                .status(400)
                .json({
                    message:
                        "OTP không đúng"
                });
        }


        user.passwordHash =
            await argon2.hash(
                newPassword,
                {
                    type:
                        argon2.argon2id
                }
            );


        await user.save();


        await PasswordResetOtp
            .deleteOne({
                _id:
                    reset._id
            });


        disconnectUserSockets(
            req,
            user._id.toString()
        );


        return res.json({
            message:
                "Đổi mật khẩu thành công"
        });

    } catch (error) {

        console.error(
            "Reset password error:",
            error
        );


        return res
            .status(500)
            .json({
                message:
                    "Không thể đổi mật khẩu"
            });
    }
};


// ============================================================
// LOGOUT
// ============================================================

const logout = async (
    req,
    res
) => {

    const userId =
        req.session?.userId;


    try {

        disconnectUserSockets(
            req,
            userId
        );


        await destroySession(
            req
        );


        clearSessionCookie(
            res
        );


        return res.json({
            message:
                "Đăng xuất thành công"
        });

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );


        return res
            .status(500)
            .json({
                message:
                    "Không thể đăng xuất"
            });
    }
};


// ============================================================
// CURRENT USER
// ============================================================

const getCurrentUser = async (
    req,
    res
) => {

    try {

        const user =
            await User
                .findById(
                    req.session.userId
                )
                .select(
                    "_id username displayName email emailVerified createdAt"
                );


        if (!user) {

            try {

                await destroySession(
                    req
                );

            } catch {}


            clearSessionCookie(
                res
            );


            return res
                .status(401)
                .json({
                    message:
                        "Phiên đăng nhập không còn hợp lệ"
                });
        }


        return res.json({
            user:
                publicUser(user)
        });

    } catch (error) {

        console.error(
            "Get current user error:",
            error
        );


        return res
            .status(500)
            .json({
                message:
                    "Lỗi máy chủ"
            });
    }
};


module.exports = {
    startRegister,
    resendRegisterOtp,
    verifyRegisterOtp,
    login,
    forgotPassword,
    resetPassword,
    logout,
    getCurrentUser
};