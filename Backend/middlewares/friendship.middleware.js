const mongoose =
    require("mongoose");

const {
    assertFriends
} =
    require("../services/friendship.service");


// ======================================
// LẤY USER ĐANG ĐĂNG NHẬP
// ======================================

function getCurrentUserId(req) {
    return (
        req.user?._id ||
        req.user?.id ||
        req.userId ||
        req.session?.userId ||
        req.session?.user?._id ||
        req.session?.user?.id ||
        null
    );
}


// ======================================
// CHỈ CHO TẠO HỘI THOẠI VỚI BẠN BÈ
// ======================================

async function requireFriendshipWithTarget(
    req,
    res,
    next
) {
    try {

        const currentUserId =
            getCurrentUserId(req);


        if (!currentUserId) {
            return res
                .status(401)
                .json({
                    success: false,
                    message:
                        "Bạn cần đăng nhập."
                });
        }


        const targetUserId =
            String(
                req.body?.targetUserId ||
                ""
            ).trim();


        if (
            !mongoose.Types.ObjectId
                .isValid(targetUserId)
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Người nhận không hợp lệ."
                });
        }


        if (
            String(currentUserId) ===
            String(targetUserId)
        ) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Không thể tạo hội thoại với chính mình."
                });
        }


        await assertFriends(
            currentUserId,
            targetUserId
        );


        next();

    } catch (error) {

        console.error(
            "Friendship middleware:",
            error
        );


        return res
            .status(
                error.statusCode ||
                500
            )
            .json({
                success: false,

                code:
                    error.code ||
                    "FRIENDSHIP_CHECK_FAILED",

                message:
                    error.message ||
                    "Không kiểm tra được quan hệ bạn bè."
            });
    }
}


module.exports = {
    requireFriendshipWithTarget
};