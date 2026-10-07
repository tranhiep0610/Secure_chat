const express =
    require("express");

const router =
    express.Router();


// =====================================================
// CONTROLLERS
// =====================================================

const {
    createOrGetConversation,
    getConversations,
    getMessages
} =
    require("../controllers/message.controller");


// =====================================================
// MIDDLEWARE
// =====================================================

const authMiddleware =
    require("../middlewares/auth.middleware");


const {
    requireFriendshipWithTarget
} =
    require("../middlewares/friendship.middleware");


// =====================================================
// POST /api/messages/conversation
//
// Tạo mới hoặc lấy lại hội thoại 1-1.
//
// body:
// {
//     targetUserId: "..."
// }
//
// Điều kiện:
// - Phải đăng nhập
// - Hai tài khoản phải là bạn bè
// =====================================================

router.post(
    "/conversation",

    authMiddleware,

    requireFriendshipWithTarget,

    createOrGetConversation
);


// =====================================================
// GET /api/messages/conversations
//
// Lấy danh sách các hội thoại
// của tài khoản hiện tại.
// =====================================================

router.get(
    "/conversations",

    authMiddleware,

    getConversations
);


// =====================================================
// GET /api/messages/:conversationId
//
// Lấy lịch sử tin nhắn
// của một hội thoại.
// =====================================================

router.get(
    "/:conversationId",

    authMiddleware,

    getMessages
);


// =====================================================
// EXPORT
// =====================================================

module.exports =
    router;