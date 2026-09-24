const Conversation = require("../models/Conversation");
const Message = require("../models/Message");


// ======================================================
// TẠO / LẤY CONVERSATION GIỮA 2 USER
// POST /api/messages/conversation
// ======================================================

exports.createOrGetConversation = async (req, res) => {
    try {
        const currentUserId = req.session.userId;
        const { targetUserId } = req.body;

        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                message: "Chưa đăng nhập"
            });
        }

        if (!targetUserId) {
            return res.status(400).json({
                success: false,
                message: "Thiếu targetUserId"
            });
        }

        if (String(currentUserId) === String(targetUserId)) {
            return res.status(400).json({
                success: false,
                message: "Không thể chat với chính mình"
            });
        }


        let conversation = await Conversation.findOne({
            participants: {
                $all: [
                    currentUserId,
                    targetUserId
                ]
            },
            $expr: {
                $eq: [
                    { $size: "$participants" },
                    2
                ]
            }
        });


        if (!conversation) {
            conversation = await Conversation.create({
                participants: [
                    currentUserId,
                    targetUserId
                ]
            });
        }


        conversation = await Conversation.findById(
            conversation._id
        ).populate(
            "participants",
            "username displayName"
        );


        return res.status(200).json({
            success: true,
            conversation
        });

    } catch (error) {

        console.error(
            "createOrGetConversation:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Lỗi server"
        });
    }
};



// ======================================================
// LẤY DANH SÁCH CONVERSATION CỦA USER
// GET /api/messages/conversations
// ======================================================

exports.getConversations = async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Chưa đăng nhập"
            });
        }


        const conversations = await Conversation.find({
            participants: userId
        })
            .populate(
                "participants",
                "username displayName"
            )
            .populate("lastMessage")
            .sort({
                updatedAt: -1
            });


        return res.json({
            success: true,
            conversations
        });

    } catch (error) {

        console.error(
            "getConversations:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Lỗi server"
        });
    }
};



// ======================================================
// LẤY LỊCH SỬ TIN NHẮN
// GET /api/messages/:conversationId
// ======================================================

exports.getMessages = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { conversationId } = req.params;


        const conversation =
            await Conversation.findOne({
                _id: conversationId,
                participants: userId
            });


        if (!conversation) {
            return res.status(403).json({
                success: false,
                message:
                    "Bạn không thuộc cuộc trò chuyện này"
            });
        }


        const messages = await Message.find({
            conversationId
        })
            .sort({
                createdAt: 1
            })
            .lean();


        return res.json({
            success: true,
            messages
        });

    } catch (error) {

        console.error(
            "getMessages:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Lỗi server"
        });
    }
};