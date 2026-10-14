const express = require("express");

const router = express.Router();

const {
    createOrGetConversation,
    getConversations,
    getMessages,
    sendMessage
} = require("../controllers/message.controller");

const authMiddleware = require("../middlewares/auth.middleware");

const {
    requireFriendshipWithTarget
} = require("../middlewares/friendship.middleware");


// POST /api/messages
// Gửi tin nhắn (controller đã tự kiểm tra bạn bè)
router.post("/", authMiddleware, (req, res, next) => {
    console.log("POST /api/messages đã vào route");
    next();
}, sendMessage);


// POST /api/messages/conversation
// Tạo hoặc lấy hội thoại 1-1 (phải là bạn bè)
router.post(
    "/conversation",
    authMiddleware,
    requireFriendshipWithTarget,
    createOrGetConversation
);


// GET /api/messages/conversations
// Phải đặt TRƯỚC route "/:conversationId"
router.get("/conversations", authMiddleware, getConversations);


// GET /api/messages/:conversationId
router.get("/:conversationId", authMiddleware, getMessages);


module.exports = router;