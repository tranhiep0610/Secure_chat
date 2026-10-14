const path = require("path");
const fs = require("fs");
require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
// const { Server } = require("socket.io");            // Chưa dùng, bật lại nếu cần Socket.IO
// const initChatSocket = require("./sockets/chat.socket");

// =====================================================
// CONFIG
// =====================================================
const connectDB = require("./config/database");

// =====================================================
// ROUTES
// =====================================================
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const messageRoutes = require("./routes/message.routes");
const friendRoutes = require("./routes/friend.routes");
const blockRoutes = require("./routes/block.routes");
const profileRoutes = require("./routes/profile.routes");
const groupRoutes = require("./routes/group.routes");
const avatarRoutes = require("./routes/avatar.routes");
const authMiddleware = require("./middlewares/auth.middleware");
const { sendMessage, getCurrentUserId } = require("./controllers/message.controller");
const { sseHandler } = require("./realtime");

// =====================================================
// EXPRESS + HTTP SERVER
// =====================================================
const app = express();
const server = http.createServer(app);

const isProd = process.env.NODE_ENV === "production";

// Render nằm sau proxy HTTPS -> phải bật trước session để cookie secure hoạt động
if (isProd) {
    app.set("trust proxy", 1);
}

// =====================================================
// DATABASE
// =====================================================
connectDB();

// =====================================================
// CORS
// =====================================================
const allowedOrigins = [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "https://secure-chat-6oyl.onrender.com",
    process.env.FRONTEND_ORIGIN, // ví dụ: https://ten-frontend.onrender.com (không có dấu / cuối)
    process.env.CLIENT_URL
]
    .filter(Boolean)
    .map((o) => o.replace(/\/$/, ""));

app.use(
    cors({
        origin(origin, callback) {
            // Cho phép request không có origin (Postman, curl, cùng origin)
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            console.warn("CORS bị chặn:", origin);
            return callback(new Error("Origin không được CORS cho phép."));
        },
        credentials: true
    })
);

// =====================================================
// BODY PARSER
// =====================================================
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));

// =====================================================
// SESSION
// =====================================================
const sessionTtlMs = Number(process.env.SESSION_TTL_MS || 60 * 60 * 1000);

const mongoUrl =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/secure_chat";

const sessionMiddleware = session({
    name: process.env.SESSION_COOKIE_NAME || "secure_chat.sid",
    secret: process.env.SESSION_SECRET || "secure-chat-secret-dev",
    resave: false,
    saveUninitialized: false,
    rolling: true,

    store: MongoStore.create({
        mongoUrl,
        ttl: Math.ceil(sessionTtlMs / 1000)
    }),

    cookie: {
        httpOnly: true,
        // Production (HTTPS, khác domain): none + secure
        // Local (HTTP): lax, không secure
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        maxAge: sessionTtlMs
    }
});

// Session phải đứng trước tất cả API
app.use(sessionMiddleware);

// =====================================================
// API ROUTES
// =====================================================
app.get("/api/health", (req, res) => {
    return res.json({
        success: true,
        server: "Secure Chat",
        status: "online",
        timestamp: new Date().toISOString()
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// Endpoint gửi tin nhắn
app.post("/api/messages", authMiddleware, sendMessage);

// Kênh đẩy tin tức thì (Server-Sent Events)
app.get("/api/events", authMiddleware, sseHandler(getCurrentUserId));

// Các endpoint hội thoại còn lại
app.use("/api/messages", (req, res, next) => {
    console.log("MESSAGE API:", req.method, req.originalUrl);
    next();
});
app.use("/api/messages", messageRoutes);
console.log("ĐÃ ĐĂNG KÝ POST /api/messages");

app.use("/api/friends", friendRoutes);
app.use("/api/blocks", blockRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/avatars", avatarRoutes);
console.log("ĐÃ ĐĂNG KÝ /api/groups và /api/avatars");

// =====================================================
// SERVE FRONTEND (nếu thư mục frontend tồn tại)
// Sửa đường dẫn bên dưới cho đúng vị trí thư mục frontend của bạn
// =====================================================
const frontendDir = path.join(__dirname, "../SecureChat_FE_repaired");

if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir));
    console.log("Đang phục vụ frontend từ:", frontendDir);
}

// =====================================================
// LISTEN
// =====================================================
const PORT = Number(process.env.PORT) || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`SecureChat backend đang chạy tại cổng ${PORT}`);
});