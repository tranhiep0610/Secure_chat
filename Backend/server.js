require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const connectDB = require("./config/database");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const app = express();

// Kết nối MongoDB


// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 1000 * 60 * 60
    }
}));

// Auth API
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
// Test server
app.get("/", (req, res) => {
    res.json({
        message: "Secure Chat Backend is running"
    });
});
const PORT = process.env.PORT || 3000;

if (require.main === module) {
    connectDB();

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;