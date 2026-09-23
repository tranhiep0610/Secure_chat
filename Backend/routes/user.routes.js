const express = require("express");

const { getUsers } = require("../controllers/user.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

// Phải đăng nhập mới được xem danh sách người dùng
router.get("/", authMiddleware, getUsers);

module.exports = router;