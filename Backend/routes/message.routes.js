const express = require("express");

const router = express.Router();

const {
    createOrGetConversation,
    getConversations,
    getMessages
} = require("../controllers/message.controller");

const authMiddleware =
    require("../middlewares/auth.middleware");


router.post(
    "/conversation",
    authMiddleware,
    createOrGetConversation
);


router.get(
    "/conversations",
    authMiddleware,
    getConversations
);


router.get(
    "/:conversationId",
    authMiddleware,
    getMessages
);


module.exports = router;