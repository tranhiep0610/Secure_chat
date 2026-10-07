const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const User = require("../models/User");

const PendingRegistration =
  require("../models/PendingRegistration");

const PasswordResetOtp =
  require("../models/PasswordResetOtp");

const {
  sendOtpEmail
} = require("../services/email.service");


const OTP_MIN =
  100000;

const OTP_MAX =
  1000000;

const OTP_LIFETIME_MS =
  5 * 60 * 1000;

const MAX_ATTEMPTS =
  5;


function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);
}


function createOtp() {
  return String(
    crypto.randomInt(
      OTP_MIN,
      OTP_MAX
    )
  );
}


function hashOtp(code) {
  const pepper =
    process.env.EMAIL_OTP_PEPPER ||
    "securechat-dev-pepper";

  return crypto
    .createHash("sha256")
    .update(
      `${pepper}:${code}`
    )
    .digest("hex");
}


function expiresAt() {
  return new Date(
    Date.now() +
    OTP_LIFETIME_MS
  );
}


async function startRegister(
  req,
  res
) {
  try {
    const username =
      normalizeUsername(
        req.body?.username
      );

    const email =
      normalizeEmail(
        req.body?.email
      );

    const password =
      String(
        req.body?.password ||
        ""
      );


    if (
      username.length < 3 ||
      username.length > 30
    ) {
      return res.status(400).json({
        message:
          "Username cần từ 3 đến 30 ký tự."
      });
    }


    if (!isValidEmail(email)) {
      return res.status(400).json({
        message:
          "Email không hợp lệ."
      });
    }


    if (password.length < 8) {
      return res.status(400).json({
        message:
          "Mật khẩu cần tối thiểu 8 ký tự."
      });
    }


    const existed =
      await User.findOne({
        $or: [
          { username },
          { email }
        ]
      });


    if (existed) {
      return res.status(409).json({
        message:
          "Username hoặc email đã được sử dụng."
      });
    }


    const code =
      createOtp();

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );


    await PendingRegistration.deleteMany({
      $or: [
        { email },
        { username }
      ]
    });


    await PendingRegistration.create({
      username,
      email,
      passwordHash,
      otpHash:
        hashOtp(code),
      attempts:
        0,
      expiresAt:
        expiresAt()
    });


    await sendOtpEmail({
      to:
        email,
      code,
      purpose:
        "register"
    });


    return res.json({
      success:
        true,

      message:
        "Đã gửi mã OTP tới email."
    });

  } catch (error) {
    console.error(
      "startRegister error:",
      error
    );

    return res.status(500).json({
      message:
        "Không gửi được mã xác thực."
    });
  }
}


async function resendRegisterCode(
  req,
  res
) {
  try {
    const email =
      normalizeEmail(
        req.body?.email
      );

    const pending =
      await PendingRegistration.findOne({
        email
      });


    if (!pending) {
      return res.status(404).json({
        message:
          "Không tìm thấy đăng ký đang chờ xác thực."
      });
    }


    const code =
      createOtp();


    pending.otpHash =
      hashOtp(code);

    pending.attempts =
      0;

    pending.expiresAt =
      expiresAt();


    await pending.save();


    await sendOtpEmail({
      to:
        email,
      code,
      purpose:
        "register"
    });


    return res.json({
      success:
        true,

      message:
        "Đã gửi mã OTP mới."
    });

  } catch (error) {
    console.error(
      "resendRegisterCode error:",
      error
    );

    return res.status(500).json({
      message:
        "Không gửi lại được mã OTP."
    });
  }
}


async function confirmRegister(
  req,
  res
) {
  try {
    const email =
      normalizeEmail(
        req.body?.email
      );

    const code =
      String(
        req.body?.code ||
        ""
      ).trim();


    const pending =
      await PendingRegistration.findOne({
        email
      });


    if (
      !pending ||
      pending.expiresAt <
        new Date()
    ) {
      return res.status(400).json({
        message:
          "Mã OTP đã hết hạn hoặc không tồn tại."
      });
    }


    if (
      pending.attempts >=
      MAX_ATTEMPTS
    ) {
      return res.status(429).json({
        message:
          "Bạn đã nhập sai quá nhiều lần. Hãy gửi lại mã mới."
      });
    }


    if (
      hashOtp(code) !==
      pending.otpHash
    ) {
      pending.attempts += 1;
      await pending.save();

      return res.status(400).json({
        message:
          "Mã OTP không đúng."
      });
    }


    const existed =
      await User.findOne({
        $or: [
          {
            username:
              pending.username
          },
          {
            email:
              pending.email
          }
        ]
      });


    if (existed) {
      await PendingRegistration.deleteOne({
        _id:
          pending._id
      });

      return res.status(409).json({
        message:
          "Tài khoản đã tồn tại."
      });
    }


    const user =
      await User.create({
        username:
          pending.username,

        email:
          pending.email,

        passwordHash:
          pending.passwordHash,

        displayName:
          pending.username,

        emailVerified:
          true
      });


    await PendingRegistration.deleteOne({
      _id:
        pending._id
    });


    return res.status(201).json({
      success:
        true,

      user: {
        _id:
          user._id,

        username:
          user.username,

        email:
          user.email
      }
    });

  } catch (error) {
    console.error(
      "confirmRegister error:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể hoàn tất đăng ký."
    });
  }
}


async function startReset(
  req,
  res
) {
  try {
    const email =
      normalizeEmail(
        req.body?.email
      );


    if (!isValidEmail(email)) {
      return res.status(400).json({
        message:
          "Email không hợp lệ."
      });
    }


    const user =
      await User.findOne({
        email
      });


    // Tránh tiết lộ email nào tồn tại trong hệ thống.
    if (!user) {
      return res.json({
        success:
          true,

        message:
          "Nếu email tồn tại, mã OTP đã được gửi."
      });
    }


    const code =
      createOtp();


    await PasswordResetOtp.deleteMany({
      email
    });


    await PasswordResetOtp.create({
      email,
      otpHash:
        hashOtp(code),
      attempts:
        0,
      expiresAt:
        expiresAt()
    });


    await sendOtpEmail({
      to:
        email,
      code,
      purpose:
        "reset"
    });


    return res.json({
      success:
        true,

      message:
        "Nếu email tồn tại, mã OTP đã được gửi."
    });

  } catch (error) {
    console.error(
      "startReset error:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể xử lý yêu cầu đặt lại mật khẩu."
    });
  }
}


async function confirmReset(
  req,
  res
) {
  try {
    const email =
      normalizeEmail(
        req.body?.email
      );

    const code =
      String(
        req.body?.code ||
        ""
      ).trim();

    const newPassword =
      String(
        req.body?.newPassword ||
        ""
      );


    if (newPassword.length < 8) {
      return res.status(400).json({
        message:
          "Mật khẩu mới cần tối thiểu 8 ký tự."
      });
    }


    const record =
      await PasswordResetOtp.findOne({
        email
      });


    if (
      !record ||
      record.expiresAt <
        new Date()
    ) {
      return res.status(400).json({
        message:
          "Mã OTP đã hết hạn hoặc không tồn tại."
      });
    }


    if (
      record.attempts >=
      MAX_ATTEMPTS
    ) {
      return res.status(429).json({
        message:
          "Bạn đã nhập sai quá nhiều lần. Hãy yêu cầu mã mới."
      });
    }


    if (
      hashOtp(code) !==
      record.otpHash
    ) {
      record.attempts += 1;
      await record.save();

      return res.status(400).json({
        message:
          "Mã OTP không đúng."
      });
    }


    const user =
      await User.findOne({
        email
      });


    if (!user) {
      return res.status(404).json({
        message:
          "Không tìm thấy tài khoản."
      });
    }


    user.passwordHash =
      await bcrypt.hash(
        newPassword,
        12
      );


    await user.save();


    await PasswordResetOtp.deleteOne({
      _id:
        record._id
    });


    // Nếu request đang có session đăng nhập,
    // hủy session cũ sau khi đổi mật khẩu.
    if (req.session) {
      req.session.destroy(
        () => {}
      );
    }


    return res.json({
      success:
        true,

      message:
        "Đổi mật khẩu thành công."
    });

  } catch (error) {
    console.error(
      "confirmReset error:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể đổi mật khẩu."
    });
  }
}


module.exports = {
  startRegister,
  resendRegisterCode,
  confirmRegister,
  startReset,
  confirmReset
};