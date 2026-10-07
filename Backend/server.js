const path = require("path");//

require("dotenv").config();

const express =
    require("express");

const http =
    require("http");

const cors =
    require("cors");

const session =
    require("express-session");

const MongoStore =
    require("connect-mongo");

const {
    Server
} =
    require("socket.io");


// =====================================================
// CONFIG
// =====================================================

const connectDB =
    require("./config/database");


// =====================================================
// ROUTES
// =====================================================

const authRoutes =
    require("./routes/auth.routes");

const userRoutes =
    require("./routes/user.routes");

const messageRoutes =
    require("./routes/message.routes");

const friendRoutes =
    require("./routes/friend.routes");

const blockRoutes =
    require("./routes/block.routes");

const profileRoutes =
    require("./routes/profile.routes");


// =====================================================
// SOCKET
// =====================================================

const initChatSocket =
    require("./sockets/chat.socket");


// =====================================================
// EXPRESS + HTTP SERVER
// =====================================================

const app =
    express();

const server =
    http.createServer(
        app
    );


// =====================================================
// DATABASE
// =====================================================

connectDB();


// =====================================================
// CORS
// =====================================================

const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    process.env.FRONTEND_ORIGIN
]
    .filter(Boolean);


app.use(
    cors({
        origin:
            function (
                origin,
                callback
            ) {

                if (!origin) {
                    return callback(
                        null,
                        true
                    );
                }


                if (
                    allowedOrigins.includes(
                        origin
                    )
                ) {
                    return callback(
                        null,
                        true
                    );
                }


                return callback(
                    new Error(
                        "Origin không được CORS cho phép."
                    )
                );
            },

        credentials:
            true
    })
);


// =====================================================
// BODY PARSER
// =====================================================

app.use(
    express.json({
        limit:
            "2mb"
    })
);


app.use(
    express.urlencoded({
        extended:
            true
    })
);

// =========================================
// SERVE FRONTEND
// =========================================

const frontendPath =
    path.join(
        __dirname,
        "..",
        "Frontend"
    );

app.use(
    express.static(frontendPath)
);

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            frontendPath,
            "index.html"
        )
    );
});

// =====================================================
// SESSION
// =====================================================

const sessionTtlMs =
    Number(
        process.env
            .SESSION_TTL_MS ||
        60 * 60 * 1000
    );


const mongoUrl =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/secure_chat";


const sessionMiddleware =
    session({
        name:
            process.env
                .SESSION_COOKIE_NAME ||
            "secure_chat.sid",

        secret:
            process.env
                .SESSION_SECRET ||
            "secure-chat-secret-dev",

        resave:
            false,

        saveUninitialized:
            false,

        store:
            MongoStore.create({
                mongoUrl:
                    mongoUrl,

                ttl:
                    Math.ceil(
                        sessionTtlMs /
                        1000
                    )
            }),

        cookie: {
            httpOnly:
                true,

            sameSite:
                "lax",

            secure:
                process.env
                    .NODE_ENV ===
                "production",

            maxAge:
                sessionTtlMs
        }
    });


// =====================================================
// SESSION PHẢI ĐỨNG TRƯỚC TẤT CẢ API
// =====================================================

app.use(
    sessionMiddleware
);


// =====================================================
// API ROUTES
// =====================================================

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


app.use(
    "/api/friends",
    friendRoutes
);


app.use(
    "/api/blocks",
    blockRoutes
);


app.use(
    "/api/profile",
    profileRoutes
);


// =====================================================
// TEST / HEALTH CHECK
// =====================================================

app.get(
    "/",
    (
        req,
        res
    ) => {

        return res.json({
            success:
                true,

            message:
                "Secure Chat server running"
        });
    }
);


app.get(
    "/api/health",
    (
        req,
        res
    ) => {

        return res.json({
            success:
                true,

            server:
                "Secure Chat",

            status:
                "online",

            timestamp:
                new Date()
                    .toISOString()
        });
    }
);


// =====================================================
// SOCKET.IO
// =====================================================

const io =
    new Server(
        server,
        {
            cors: {
                origin:
                    allowedOrigins,

                credentials:
                    true
            }
        }
    );


app.set(
    "io",
    io
);


// =====================================================
// SOCKET.IO DÙNG CHUNG SESSION EXPRESS
// =====================================================

io.engine.use(
    sessionMiddleware
);


// =====================================================
// KHỞI TẠO SOCKET CHAT
// =====================================================

initChatSocket(
    io
);


// =====================================================
// 404 API
// =====================================================

app.use(
    "/api",

    (
        req,
        res
    ) => {

        return res
            .status(404)
            .json({
                success:
                    false,

                message:
                    `Không tìm thấy API: ${req.method} ${req.originalUrl}`
            });
    }
);


// =====================================================
// ERROR HANDLER
// =====================================================

app.use(
    (
        err,
        req,
        res,
        next
    ) => {

        console.error(
            "Server error:",
            err
        );


        if (
            err.message ===
            "Origin không được CORS cho phép."
        ) {

            return res
                .status(403)
                .json({
                    success:
                        false,

                    message:
                        err.message
                });
        }


        return res
            .status(500)
            .json({
                success:
                    false,

                message:
                    "Lỗi máy chủ."
            });
    }
);


// =====================================================
// START SERVER
// =====================================================

const PORT =
    Number(
        process.env.PORT ||
        3000
    );


// server.listen(
//     PORT,

//     () => {

//         console.log(
//             "======================================"
//         );

//         console.log(
//             `Secure Chat server running at http://localhost:${PORT}`
//         );

//         console.log(
//             `Health check: http://localhost:${PORT}/api/health`
//         );

//         console.log(
//             "======================================"
//         );
//     }
// );
server.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `Secure Chat server running on port ${PORT}`
        );
    }
);