const express =
    require("express");

const User =
    require("../models/User");

const authMiddleware =
    require("../middlewares/auth.middleware");


const router =
    express.Router();


// ======================================================
// TẤT CẢ API PROFILE ĐỀU PHẢI ĐĂNG NHẬP
// ======================================================

router.use(
    authMiddleware
);


// ======================================================
// GET /api/profile
// LẤY THÔNG TIN TÀI KHOẢN HIỆN TẠI
// ======================================================

router.get(
    "/",

    async (
        req,
        res
    ) => {
        try {

            const currentUserId =
                req.session.userId;


            const user =
                await User
                    .findById(
                        currentUserId
                    )

                    .select(
                        "username displayName createdAt"
                    );


            if (!user) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Không tìm thấy tài khoản."
                    });
            }


            return res
                .status(200)
                .json({
                    success:
                        true,

                    user: {
                        _id:
                            String(
                                user._id
                            ),

                        username:
                            user.username,

                        displayName:
                            user.displayName ||
                            user.username,

                        createdAt:
                            user.createdAt
                    }
                });

        }

        catch (error) {

            console.error(
                "GET profile error:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Không tải được hồ sơ."
                });
        }
    }
);


// ======================================================
// PATCH /api/profile
// CẬP NHẬT TÊN HIỂN THỊ
//
// body:
// {
//     displayName: "Tên mới"
// }
// ======================================================

router.patch(
    "/",

    async (
        req,
        res
    ) => {
        try {

            const currentUserId =
                req.session.userId;


            const displayName =
                String(
                    req.body?.displayName ||
                    ""
                )
                    .trim();


            // ==========================================
            // VALIDATE
            // ==========================================

            if (
                displayName.length <
                    1 ||
                displayName.length >
                    50
            ) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Tên hiển thị phải từ 1 đến 50 ký tự."
                    });
            }


            // ==========================================
            // UPDATE
            // ==========================================

            const user =
                await User
                    .findByIdAndUpdate(
                        currentUserId,

                        {
                            $set: {
                                displayName:
                                    displayName
                            }
                        },

                        {
                            new:
                                true,

                            runValidators:
                                true
                        }
                    )

                    .select(
                        "username displayName createdAt"
                    );


            if (!user) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Không tìm thấy tài khoản."
                    });
            }


            return res
                .status(200)
                .json({
                    success:
                        true,

                    message:
                        "Đã cập nhật hồ sơ.",

                    user: {
                        _id:
                            String(
                                user._id
                            ),

                        username:
                            user.username,

                        displayName:
                            user.displayName ||
                            user.username,

                        createdAt:
                            user.createdAt
                    }
                });

        }

        catch (error) {

            console.error(
                "PATCH profile error:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Không cập nhật được hồ sơ."
                });
        }
    }
);


// ======================================================
// EXPORT
// ======================================================

module.exports =
    router;