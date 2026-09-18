const User = require("../models/User");

// =========================
// LẤY DANH SÁCH NGƯỜI DÙNG
// =========================
const getUsers = async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.session.userId } })
            .select("-passwordHash")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            users
        });

    } catch (error) {
        console.error("Get users error:", error);

        return res.status(500).json({
            message: "Lỗi máy chủ"
        });
    }
};

module.exports = {
    getUsers
};