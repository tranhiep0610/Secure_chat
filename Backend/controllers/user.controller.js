const User = require("../models/User");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const publicUser = (user) => ({
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    createdAt: user.createdAt
});

// =========================
// DANH SÁCH / TÌM NGƯỜI DÙNG
// GET /api/users?q=<keyword>
// =========================
const getUsers = async (req, res) => {
    try {
        const rawQuery = typeof req.query?.q === "string" ? req.query.q.trim() : "";
        const keyword = rawQuery.slice(0, 50);

        const filter = {
            _id: { $ne: req.session.userId }
        };

        if (keyword) {
            const safeKeyword = escapeRegex(keyword);
            filter.$or = [
                {
                    usernameNormalized: {
                        $regex: escapeRegex(keyword.toLowerCase()),
                        $options: "i"
                    }
                },
                {
                    displayName: {
                        $regex: safeKeyword,
                        $options: "i"
                    }
                }
            ];
        }

        const users = await User.find(filter)
            .select("_id username displayName createdAt")
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        return res.status(200).json({
            users: users.map(publicUser)
        });
    } catch (error) {
        console.error("Get users error:", error.message);
        return res.status(500).json({
            message: "Lỗi máy chủ"
        });
    }
};

module.exports = {
    getUsers
};
