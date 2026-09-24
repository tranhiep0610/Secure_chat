require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { Server } = require("socket.io");

const connectDB = require("./config/database");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const messageRoutes = require("./routes/message.routes");

const initChatSocket = require("./sockets/chat.socket");

const app = express();
const server = http.createServer(app);


// ======================================
// DATABASE
// ======================================

connectDB();


// ======================================
// CORS
// ======================================

const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500"
];

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true
    })
);


// ======================================
// BODY PARSER
// ======================================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


// ======================================
// SESSION
// ======================================

const sessionTtlMs = Number(
    process.env.SESSION_TTL_MS ||
    60 * 60 * 1000
);

const sessionMiddleware = session({
    name:
        process.env.SESSION_COOKIE_NAME ||
        "secure_chat.sid",

    secret:
        process.env.SESSION_SECRET ||
        "secure-chat-secret-dev",

    resave: false,

    saveUninitialized: false,

    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,

        ttl: Math.ceil(
            sessionTtlMs / 1000
        )
    }),

    cookie: {
        httpOnly: true,

        sameSite: "lax",

        secure:
            process.env.NODE_ENV === "production",

        maxAge: sessionTtlMs
    }
});

app.use(sessionMiddleware);


// ======================================
// ROUTES
// ======================================

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/users",
    userRoutes
);

app.use(
    "/api/messages",
    messageRoutes
);


// ======================================
// TEST SERVER
// ======================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Secure Chat server running"
    });
});


// ======================================
// SOCKET.IO
// ======================================

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true
    }
});


// Cho auth.controller lấy được io
// req.app.get("io")
app.set("io", io);


// Socket.IO dùng chung session với Express
io.engine.use(sessionMiddleware);


// Khởi tạo realtime chat
initChatSocket(io);


// ======================================
// ERROR HANDLER CƠ BẢN
// ======================================

app.use((err, req, res, next) => {
    console.error("Server error:", err);

    res.status(500).json({
        success: false,
        message: "Lỗi máy chủ"
    });
});


// ======================================
// START SERVER
// ======================================

const PORT =
    process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(
        `Secure Chat server running at http://localhost:${PORT}`
    );
});