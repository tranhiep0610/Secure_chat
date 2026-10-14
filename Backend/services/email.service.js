const nodemailer = require("nodemailer");
 
let transporter = null;
 
// ============================================================
// CHỌN CÁCH GỬI
// - Có BREVO_API_KEY  -> gửi qua Brevo HTTP API (chạy được trên Render free)
// - Không có          -> gửi qua Gmail SMTP (dùng khi chạy local)
// ============================================================
 
function useBrevo() {
    return Boolean(String(process.env.BREVO_API_KEY || "").trim());
}
 
 
// ============================================================
// GMAIL SMTP (LOCAL)
// ============================================================
 
function getGmailConfig() {
    const user = String(process.env.GMAIL_USER || "").trim();
 
    // App Password dạng "abcd efgh ijkl mnop" -> bỏ khoảng trắng
    const pass = String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
 
    if (!user) throw new Error("Thiếu GMAIL_USER");
    if (!pass) throw new Error("Thiếu GMAIL_APP_PASSWORD");
 
    return { user, pass };
}
 
function getTransporter() {
    if (transporter) return transporter;
 
    const { user, pass } = getGmailConfig();
 
    transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user, pass },
        // Báo lỗi nhanh thay vì treo khi cổng SMTP bị chặn
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
    });
 
    return transporter;
}
 
 
// ============================================================
// NỘI DUNG EMAIL
// ============================================================
 
function buildContent(purpose, otp) {
    const isRegister = purpose === "register";
 
    const subject = isRegister
        ? "Xác thực đăng ký SecureChat"
        : "Đặt lại mật khẩu SecureChat";
 
    const title = isRegister ? "Xác thực tài khoản" : "Khôi phục mật khẩu";
 
    const text =
        `Mã OTP SecureChat của bạn là ${otp}. ` +
        `Mã có hiệu lực trong 5 phút.`;
 
    const html = `
        <div style="max-width:520px;margin:0 auto;padding:30px;font-family:Arial,sans-serif;color:#172033;background:#ffffff;">
            <div style="font-size:22px;font-weight:800;">SecureChat</div>
            <h2 style="margin:22px 0 8px;">${title}</h2>
            <p style="color:#64748b;line-height:1.6;">Mã OTP của bạn:</p>
            <div style="margin:22px 0;padding:20px;border-radius:12px;background:#f1f5f9;text-align:center;font-size:30px;font-weight:800;letter-spacing:8px;">
                ${otp}
            </div>
            <p style="color:#64748b;font-size:14px;line-height:1.6;">
                Mã có hiệu lực trong 5 phút. Không chia sẻ OTP cho người khác.
            </p>
        </div>
    `;
 
    return { subject: `${subject} - ${otp}`, text, html };
}
 
 
// ============================================================
// GỬI QUA BREVO (HTTP API)
// ============================================================
 
async function sendViaBrevo({ recipient, subject, text, html }) {
    const apiKey = String(process.env.BREVO_API_KEY || "").trim();
    const senderEmail = String(process.env.BREVO_SENDER_EMAIL || "").trim();
    const senderName = String(process.env.BREVO_SENDER_NAME || "SecureChat").trim();
 
    if (!senderEmail) {
        throw new Error("Thiếu BREVO_SENDER_EMAIL (email đã xác minh trong Brevo)");
    }
 
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": apiKey
        },
        body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: [{ email: recipient }],
            subject,
            textContent: text,
            htmlContent: html
        })
    });
 
    const data = await response.json().catch(() => ({}));
 
    if (!response.ok) {
        throw new Error(
            `Brevo lỗi ${response.status}: ${data?.message || JSON.stringify(data)}`
        );
    }
 
    console.log("📧 Brevo OTP sent to:", recipient, "| messageId:", data?.messageId);
 
    // Trả về cùng dạng với nodemailer để auth.controller.js kiểm tra "accepted"
    return {
        messageId: data?.messageId,
        accepted: [recipient],
        rejected: []
    };
}
 
 
// ============================================================
// GỬI QUA GMAIL SMTP
// ============================================================
 
async function sendViaGmail({ recipient, subject, text, html }) {
    const { user } = getGmailConfig();
 
    const info = await getTransporter().sendMail({
        from: `"SecureChat" <${user}>`,
        to: recipient,
        replyTo: user,
        subject,
        text,
        html
    });
 
    const accepted = Array.isArray(info?.accepted)
        ? info.accepted.map((item) => String(item).trim().toLowerCase())
        : [];
 
    console.log("📧 Gmail OTP result | To:", recipient, "| Accepted:", info?.accepted);
 
    if (!accepted.includes(recipient.toLowerCase())) {
        throw new Error(`Gmail chưa chấp nhận địa chỉ người nhận: ${recipient}`);
    }
 
    return info;
}
 
 
// ============================================================
// HÀM CHÍNH
// ============================================================
 
async function sendOtpEmail({ to, code, purpose }) {
    const recipient = String(to || "").trim();
    if (!recipient) throw new Error("Email người nhận bị trống");
 
    const otp = String(code || "").trim();
    if (!/^\d{6}$/.test(otp)) throw new Error("OTP phải gồm đúng 6 chữ số");
 
    const content = buildContent(purpose, otp);
 
    try {
        return useBrevo()
            ? await sendViaBrevo({ recipient, ...content })
            : await sendViaGmail({ recipient, ...content });
    } catch (error) {
        console.error("❌ SEND OTP EMAIL ERROR");
        console.error("Provider:", useBrevo() ? "Brevo" : "Gmail SMTP");
        console.error("Recipient:", recipient);
        console.error("Code:", error?.code);
        console.error("Message:", error?.message);
        throw error;
    }
}
 
 
// ============================================================
// TEST KẾT NỐI (CHỈ ÁP DỤNG CHO GMAIL SMTP)
// ============================================================
 
async function verifyEmailConnection() {
    if (useBrevo()) {
        console.log("✅ Đang dùng Brevo API, bỏ qua kiểm tra SMTP");
        return true;
    }
 
    await getTransporter().verify();
    console.log("✅ Gmail SMTP connection OK");
    return true;
}
 
 
module.exports = {
    sendOtpEmail,
    verifyEmailConnection
};
 