const nodemailer = require("nodemailer");

let transporter = null;


// ============================================================
// ĐỌC CẤU HÌNH GMAIL
// ============================================================

function getEmailConfig() {
    const user = String(
        process.env.GMAIL_USER || ""
    ).trim();

    // Google App Password thường hiện dạng:
    // abcd efgh ijkl mnop
    // Bỏ hết khoảng trắng trước khi dùng.
    const pass = String(
        process.env.GMAIL_APP_PASSWORD || ""
    ).replace(/\s+/g, "");

    if (!user) {
        throw new Error(
            "Thiếu GMAIL_USER trong Backend/.env"
        );
    }

    if (!pass) {
        throw new Error(
            "Thiếu GMAIL_APP_PASSWORD trong Backend/.env"
        );
    }

    return {
        user,
        pass
    };
}


// ============================================================
// TẠO NODEMAILER TRANSPORTER
// ============================================================

function getTransporter() {
    if (transporter) {
        return transporter;
    }

    const {
        user,
        pass
    } = getEmailConfig();

    transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",

        port: 465,

        secure: true,

        auth: {
            user,
            pass
        }
    });

    return transporter;
}


// ============================================================
// TEST KẾT NỐI GMAIL
// ============================================================

async function verifyEmailConnection() {
    const mailer = getTransporter();

    await mailer.verify();

    console.log(
        "✅ Gmail SMTP connection OK"
    );

    return true;
}


// ============================================================
// GỬI EMAIL OTP
// ============================================================

async function sendOtpEmail({
    to,
    code,
    purpose
}) {
    const recipient = String(
        to || ""
    ).trim();

    if (!recipient) {
        throw new Error(
            "Email người nhận bị trống"
        );
    }

    const otp = String(
        code || ""
    ).trim();

    if (!/^\d{6}$/.test(otp)) {
        throw new Error(
            "OTP phải gồm đúng 6 chữ số"
        );
    }

    const {
        user
    } = getEmailConfig();

    const isRegister =
        purpose === "register";

    const subject = isRegister
        ? "Xác thực đăng ký SecureChat"
        : "Đặt lại mật khẩu SecureChat";

    const title = isRegister
        ? "Xác thực tài khoản"
        : "Khôi phục mật khẩu";


    try {
        const info = await getTransporter()
            .sendMail({
                from:
                    `"SecureChat" <${user}>`,

                to:
                    recipient,

                replyTo:
                    user,

                subject:
                    `${subject} - ${otp}`,

                text:
                    `Mã OTP SecureChat của bạn là ${otp}. ` +
                    `Mã có hiệu lực trong 5 phút.`,

                html: `
                    <div
                        style="
                            max-width:520px;
                            margin:0 auto;
                            padding:30px;
                            font-family:Arial,sans-serif;
                            color:#172033;
                            background:#ffffff;
                        "
                    >

                        <div
                            style="
                                font-size:22px;
                                font-weight:800;
                            "
                        >
                            SecureChat
                        </div>


                        <h2
                            style="
                                margin:22px 0 8px;
                            "
                        >
                            ${title}
                        </h2>


                        <p
                            style="
                                color:#64748b;
                                line-height:1.6;
                            "
                        >
                            Mã OTP của bạn:
                        </p>


                        <div
                            style="
                                margin:22px 0;
                                padding:20px;
                                border-radius:12px;
                                background:#f1f5f9;
                                text-align:center;
                                font-size:30px;
                                font-weight:800;
                                letter-spacing:8px;
                            "
                        >
                            ${otp}
                        </div>


                        <p
                            style="
                                color:#64748b;
                                font-size:14px;
                                line-height:1.6;
                            "
                        >
                            Mã có hiệu lực trong 5 phút.
                            Không chia sẻ OTP cho người khác.
                        </p>

                    </div>
                `
            });


        // ====================================================
        // KIỂM TRA GMAIL CÓ ACCEPT ĐỊA CHỈ NHẬN KHÔNG
        // ====================================================

        const accepted = Array.isArray(
            info?.accepted
        )
            ? info.accepted.map(
                item =>
                    String(item)
                        .trim()
                        .toLowerCase()
            )
            : [];


        const rejected = Array.isArray(
            info?.rejected
        )
            ? info.rejected
            : [];


        // ====================================================
        // LOG KẾT QUẢ GỬI
        // ====================================================

        console.log("");
        console.log(
            "=============================================="
        );

        console.log(
            "📧 SECURECHAT OTP EMAIL RESULT"
        );

        console.log(
            "From:",
            user
        );

        console.log(
            "To:",
            recipient
        );

        console.log(
            "Message ID:",
            info?.messageId
        );

        console.log(
            "Accepted:",
            info?.accepted
        );

        console.log(
            "Rejected:",
            rejected
        );

        console.log(
            "Pending:",
            info?.pending
        );

        console.log(
            "Response:",
            info?.response
        );

        console.log(
            "=============================================="
        );

        console.log("");


        // ====================================================
        // CHỈ COI LÀ THÀNH CÔNG NẾU GMAIL ACCEPT ĐỊA CHỈ
        // ====================================================

        if (
            !accepted.includes(
                recipient.toLowerCase()
            )
        ) {
            throw new Error(
                `Gmail chưa chấp nhận địa chỉ người nhận: ${recipient}`
            );
        }


        return info;

    } catch (error) {
        console.error("");

        console.error(
            "=============================================="
        );

        console.error(
            "❌ GMAIL SEND ERROR"
        );

        console.error(
            "Recipient:",
            recipient
        );

        console.error(
            "Code:",
            error?.code
        );

        console.error(
            "Command:",
            error?.command
        );

        console.error(
            "Response code:",
            error?.responseCode
        );

        console.error(
            "Response:",
            error?.response
        );

        console.error(
            "Message:",
            error?.message
        );

        console.error(
            "=============================================="
        );

        console.error("");


        throw error;
    }
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
    sendOtpEmail,
    verifyEmailConnection
};