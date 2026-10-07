const express =
    require("express");

const mongoose =
    require("mongoose");

const Block =
    require("../models/Block");

const Friendship =
    require("../models/Friendship");

const User =
    require("../models/User");

const authMiddleware =
    require("../middlewares/auth.middleware");


const router =
    express.Router();


// ======================================================
// HELPER
// ======================================================

function validId(
    id
) {
    return mongoose
        .Types
        .ObjectId
        .isValid(
            id
        );
}


function publicUser(
    user
) {
    if (!user) {
        return null;
    }


    return {
        _id:
            String(
                user._id
            ),

        username:
            user.username,

        displayName:
            user.displayName ||
            user.username
    };
}


// ======================================================
// TẤT CẢ API BLOCK ĐỀU PHẢI ĐĂNG NHẬP
// ======================================================

router.use(
    authMiddleware
);


// ======================================================
// GET /api/blocks
//
// LẤY DANH SÁCH NHỮNG NGƯỜI MÌNH ĐÃ CHẶN
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


            const rows =
                await Block
                    .find({
                        blocker:
                            currentUserId
                    })

                    .populate(
                        "blocked",
                        "username displayName"
                    )

                    .sort({
                        createdAt:
                            -1
                    });


            return res
                .status(200)
                .json({
                    success:
                        true,

                    blocks:
                        rows.map(
                            row => ({
                                blockId:
                                    String(
                                        row._id
                                    ),

                                user:
                                    publicUser(
                                        row.blocked
                                    ),

                                createdAt:
                                    row.createdAt
                            })
                        )
                });

        }

        catch (error) {

            console.error(
                "GET blocks error:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Không tải được danh sách đã chặn."
                });
        }
    }
);


// ======================================================
// POST /api/blocks
//
// body:
// {
//     targetUserId: "..."
// }
//
// CHẶN USER
// ======================================================

router.post(
    "/",

    async (
        req,
        res
    ) => {
        try {

            const currentUserId =
                String(
                    req.session.userId
                );


            const targetUserId =
                String(
                    req.body
                        ?.targetUserId ||
                    ""
                )
                    .trim();


            // ==========================================
            // VALIDATE TARGET USER
            // ==========================================

            if (
                !validId(
                    targetUserId
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Người dùng không hợp lệ."
                    });
            }


            // ==========================================
            // KHÔNG ĐƯỢC TỰ CHẶN MÌNH
            // ==========================================

            if (
                currentUserId ===
                targetUserId
            ) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "Không thể tự chặn chính mình."
                    });
            }


            // ==========================================
            // KIỂM TRA USER TỒN TẠI
            // ==========================================

            const targetUser =
                await User
                    .findById(
                        targetUserId
                    )

                    .select(
                        "username displayName"
                    );


            if (!targetUser) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Không tìm thấy người dùng."
                    });
            }


            // ==========================================
            // TẠO BLOCK
            // ==========================================

            const block =
                await Block
                    .findOneAndUpdate(
                        {
                            blocker:
                                currentUserId,

                            blocked:
                                targetUserId
                        },

                        {
                            $setOnInsert: {
                                blocker:
                                    currentUserId,

                                blocked:
                                    targetUserId
                            }
                        },

                        {
                            new:
                                true,

                            upsert:
                                true,

                            setDefaultsOnInsert:
                                true
                        }
                    );


            // ==========================================
            // BLOCK -> XÓA FRIENDSHIP / LỜI MỜI
            // ==========================================

            const pair =
                Friendship
                    .normalizePair(
                        currentUserId,
                        targetUserId
                    );


            await Friendship
                .deleteOne(
                    pair
                );


            return res
                .status(200)
                .json({
                    success:
                        true,

                    message:
                        "Đã chặn người dùng.",

                    block: {
                        _id:
                            String(
                                block._id
                            ),

                        user:
                            publicUser(
                                targetUser
                            )
                    }
                });

        }

        catch (error) {

            console.error(
                "POST block error:",
                error
            );


            // Nếu block đã tồn tại
            if (
                error?.code ===
                11000
            ) {

                return res
                    .status(409)
                    .json({
                        success:
                            false,

                        message:
                            "Người dùng này đã bị chặn."
                    });
            }


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Không thể chặn người dùng."
                });
        }
    }
);


// ======================================================
// DELETE /api/blocks/:userId
//
// BỎ CHẶN USER
// ======================================================

router.delete(
    "/:userId",

    async (
        req,
        res
    ) => {
        try {

            const currentUserId =
                String(
                    req.session.userId
                );


            const targetUserId =
                String(
                    req.params.userId ||
                    ""
                )
                    .trim();


            // ==========================================
            // VALIDATE
            // ==========================================

            if (
                !validId(
                    targetUserId
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success:
                            false,

                        message:
                            "User ID không hợp lệ."
                    });
            }


            // ==========================================
            // DELETE BLOCK
            // ==========================================

            const result =
                await Block
                    .deleteOne({
                        blocker:
                            currentUserId,

                        blocked:
                            targetUserId
                    });


            if (
                !result.deletedCount
            ) {

                return res
                    .status(404)
                    .json({
                        success:
                            false,

                        message:
                            "Người dùng này không nằm trong danh sách chặn."
                    });
            }


            return res
                .status(200)
                .json({
                    success:
                        true,

                    message:
                        "Đã bỏ chặn."
                });

        }

        catch (error) {

            console.error(
                "DELETE block error:",
                error
            );


            return res
                .status(500)
                .json({
                    success:
                        false,

                    message:
                        "Không thể bỏ chặn."
                });
        }
    }
);


// ======================================================
// EXPORT
// ======================================================

module.exports =
    router;