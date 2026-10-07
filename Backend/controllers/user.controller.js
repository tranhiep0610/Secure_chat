const mongoose = require("mongoose");
const User = require("../models/User");


// ============================================================
// GET /api/users
// GET /api/users?search=huy123
// ============================================================

const getUsers = async (req, res) => {
    try {
        const currentUserId =
            req.session?.userId;

        if (!currentUserId) {
            return res.status(401).json({
                message: "Chưa đăng nhập"
            });
        }

        const search =
            String(
                req.query?.search || ""
            )
                .trim()
                .toLowerCase();

        const query = {
            _id: {
                $ne: new mongoose.Types.ObjectId(
                    currentUserId
                )
            }
        };

        // Nếu có từ khóa thì tìm theo username hoặc displayName
        if (search) {
            query.$or = [
                {
                    usernameNormalized: {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    username: {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    displayName: {
                        $regex: search,
                        $options: "i"
                    }
                }
            ];
        }

        const users = await User
            .find(query)
            .select(
                "_id username displayName emailVerified createdAt"
            )
            .sort({
                createdAt: -1
            })
            .limit(50)
            .lean();

        return res.status(200).json({
            users
        });

    } catch (error) {
        console.error(
            "Get users error:",
            error
        );

        return res.status(500).json({
            message: "Không thể tải danh sách người dùng"
        });
    }
};


module.exports = {
    getUsers
};