const crypto = require("crypto");

const mongoose = require("mongoose");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Friendship = require("../models/Friendship");
const { publish } = require("../realtime");


// ======================================================
// HELPERS
// ======================================================

function getCurrentUserId(req) {
    const id =
        req.user?._id ||
        req.user?.id ||
        req.userId ||
        req.session?.userId ||
        req.session?.user?._id ||
        req.session?.user?.id ||
        null;

    return id ? String(id) : null;
}

function isValidId(id) {
    return (
        typeof id === "string" &&
        mongoose.Types.ObjectId.isValid(id)
    );
}

// Chuẩn hóa tên thuật toán về đúng 2 giá trị mà Message.js cho phép.
// Trả về null nếu không nhận ra (để báo lỗi 400 thay vì âm thầm coi là DES).
function normalizeAlgorithm(value) {
    const v = String(value || "").toUpperCase();
    if (v.includes("AES")) return "AES-GCM";
    if (v.includes("DES")) return "DES-CBC";
    return null;
}

function formatPeer(user) {
    if (!user) return null;

    return {
        id: String(user._id),
        _id: String(user._id),
        username: user.username,
        displayName: user.displayName || user.username,
        bio: user.bio || "",
        createdAt: user.createdAt
    };
}

// Trả về tin nhắn cho frontend.
// Gói mã hóa gốc (m.envelope) được ưu tiên, vì nó chứa đủ các trường
// mà aes.js / des.js cần (version, timestamp, mac...). Chỉ conversationId
// và senderId luôn lấy từ database để không bị giả mạo.
function formatMessage(m) {
    const stored = m.envelope || {};

    return {
        id: String(m._id),
        conversationId: String(m.conversationId),
        senderId: String(m.senderId),
        algorithm: m.algorithm,
        readAt: m.readAt ?? null,
        envelope: {
            ...stored,
            algorithm: stored.algorithm || m.algorithm,
            conversationId: String(m.conversationId),
            senderId: String(m.senderId),
            keyId: stored.keyId ?? m.keyId ?? null,
            iv: stored.iv ?? m.iv,
            ciphertext: stored.ciphertext ?? m.ciphertext,
            hmac: stored.hmac ?? m.hmac ?? null,
            cryptoTimestamp: stored.cryptoTimestamp ?? m.cryptoTimestamp ?? null,
            clientMessageId: m.clientMessageId
        },
        createdAt: m.createdAt
    };
}

function formatConversation(conversation, currentUserId, unreadCount = 0) {
    const participants = (conversation.participants || []).filter(Boolean);

    const peerDoc = participants.find(
        p => String(p._id || p) !== String(currentUserId)
    );

    const peer = formatPeer(peerDoc);
    if (!peer) return null;

    const last = conversation.lastMessage;

    return {
        id: String(conversation._id),
        _id: String(conversation._id),
        peer,
        otherUser: peer,
        participants: participants.map(formatPeer),

        lastMessage: last && last.algorithm
            ? {
                id: String(last._id),
                senderId: String(last.senderId),
                algorithm: last.algorithm,
                createdAt: last.createdAt
            }
            : null,

        unreadCount,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
    };
}

async function findOrCreateConversation(userA, userB) {
    let conversation = await Conversation.findOne({
        participants: { $all: [userA, userB] },
        $expr: { $eq: [{ $size: "$participants" }, 2] }
    });

    if (!conversation) {
        conversation = await Conversation.create({
            participants: [userA, userB]
        });
    }

    return conversation;
}


// ======================================================
// POST /api/messages/conversation
// Tạo / lấy hội thoại 1-1
// ======================================================

exports.createOrGetConversation = async (req, res) => {
    console.log(">>> createOrGetConversation (bản mới)", req.body);
    try {
        const me = getCurrentUserId(req);
        const targetUserId = String(req.body?.targetUserId || "").trim();

        if (!me) {
            return res.status(401).json({
                success: false,
                message: "Chưa đăng nhập"
            });
        }

        if (!isValidId(targetUserId)) {
            return res.status(400).json({
                success: false,
                message: "targetUserId không hợp lệ"
            });
        }

        if (me === targetUserId) {
            return res.status(400).json({
                success: false,
                message: "Không thể chat với chính mình"
            });
        }

        const created = await findOrCreateConversation(me, targetUserId);

        const conversation = await Conversation.findById(created._id)
            .populate("participants", "username displayName bio createdAt")
            .populate("lastMessage")
            .lean();

        const formatted = formatConversation(conversation, me, 0);

        if (!formatted) {
            return res.status(500).json({
                success: false,
                message: "Hội thoại thiếu người tham gia."
            });
        }

        return res.status(200).json({
            success: true,
            conversation: formatted
        });
    } catch (error) {
        console.error("createOrGetConversation:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi server"
        });
    }
};


// ======================================================
// GET /api/messages/conversations
// Danh sách hội thoại của user hiện tại
// ======================================================

exports.getConversations = async (req, res) => {
    try {
        const me = getCurrentUserId(req);

        if (!me) {
            return res.status(401).json({
                success: false,
                message: "Chưa đăng nhập"
            });
        }

        const conversations = await Conversation.find({
            participants: me
        })
            .populate("participants", "username displayName bio createdAt")
            .populate("lastMessage")
            .sort({ updatedAt: -1 })
            .lean();

        // Đếm tin chưa đọc của từng hội thoại bằng một truy vấn duy nhất.
        const unreadRows = await Message.aggregate([
            {
                $match: {
                    conversationId: { $in: conversations.map(c => c._id) },
                    senderId: { $ne: new mongoose.Types.ObjectId(me) },
                    readAt: null
                }
            },
            {
                $group: {
                    _id: "$conversationId",
                    count: { $sum: 1 }
                }
            }
        ]);

        const unreadMap = new Map(
            unreadRows.map(row => [String(row._id), row.count])
        );

        const result = conversations
            .map(c => formatConversation(c, me, unreadMap.get(String(c._id)) || 0))
            .filter(Boolean);

        console.log(
            ">>> getConversations: tìm thấy",
            conversations.length,
            "| sau format:",
            result.length,
            "| user:",
            me
        );

        return res.json({
            success: true,
            conversations: result
        });

    } catch (error) {
        console.error("getConversations:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi server"
        });
    }
};


// ======================================================
// GET /api/messages/:conversationId
// Lịch sử tin nhắn (đồng thời đánh dấu đã đọc)
// ======================================================

exports.getMessages = async (req, res) => {
    try {
        const me = getCurrentUserId(req);
        const { conversationId } = req.params;

        if (!me) {
            return res.status(401).json({
                success: false,
                message: "Chưa đăng nhập"
            });
        }

        if (!isValidId(conversationId)) {
            return res.status(400).json({
                success: false,
                message: "conversationId không hợp lệ"
            });
        }

        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: me
        });

        if (!conversation) {
            return res.status(403).json({
                success: false,
                message: "Bạn không thuộc cuộc trò chuyện này"
            });
        }

        const messages = await Message.find({ conversationId })
            .sort({ createdAt: 1 })
            .lean();

        const readAt = new Date();
        const result = await Message.updateMany(
            {
                conversationId,
                senderId: { $ne: me },
                readAt: null
            },
            { $set: { readAt } }
        );

        // Báo cho người gửi biết tin của họ đã được đọc (hiện ✓✓ ngay)
        if (result.modifiedCount > 0) {
            const peerId = conversation.participants
                .map(String)
                .find(p => p !== me);

            if (peerId) {
                publish(peerId, "read", {
                    conversationId: String(conversationId),
                    readAt: readAt.toISOString()
                });
            }
        }

        return res.json({
            success: true,
            messages: messages.map(formatMessage)
        });

    } catch (error) {
        console.error("getMessages:", error);

        return res.status(500).json({
            success: false,
            message: "Lỗi server"
        });
    }
};


// ======================================================
// POST /api/messages
// body: { receiverId, message: <envelope đã mã hóa>, algorithm }
// ======================================================

exports.sendMessage = async (req, res) => {
    try {
        const me = getCurrentUserId(req);
        const body = req.body || {};
        const receiverId = String(body.receiverId || "").trim();
        const envelope = body.message;

        if (!me) {
            return res.status(401).json({
                success: false,
                message: "Chưa đăng nhập"
            });
        }

        if (!isValidId(receiverId) || receiverId === me) {
            return res.status(400).json({
                success: false,
                message: "Người nhận không hợp lệ"
            });
        }

        if (!envelope || typeof envelope !== "object") {
            return res.status(400).json({
                success: false,
                message: "Thiếu dữ liệu tin nhắn đã mã hóa"
            });
        }

        const algorithm = normalizeAlgorithm(
            body.algorithm || envelope.algorithm || envelope.alg || envelope.algo
        );

        if (!algorithm) {
            return res.status(400).json({
                success: false,
                message: "Thuật toán mã hóa không được hỗ trợ (chỉ AES-GCM hoặc DES-CBC)"
            });
        }

        // Chấp nhận nhiều tên trường khác nhau từ frontend
        const iv = envelope.iv ?? envelope.nonce ?? body.iv;
        const ciphertext =
            envelope.ciphertext ?? envelope.cipherText ?? envelope.data ?? body.ciphertext;

        // Không có clientMessageId thì backend tự tạo
        const clientMessageId = String(
            envelope.clientMessageId || body.clientMessageId || crypto.randomUUID()
        ).trim();

        if (iv == null || ciphertext == null) {
            return res.status(400).json({
                success: false,
                message: `Tin nhắn thiếu iv hoặc ciphertext (nhận được: ${Object.keys(envelope).join(", ") || "không có gì"})`
            });
        }

        const pair = Friendship.normalizePair(me, receiverId);
        const friendship = await Friendship.findOne({
            ...pair,
            status: "accepted"
        });

        if (!friendship) {
            return res.status(403).json({
                success: false,
                message: "Hai tài khoản chưa là bạn bè."
            });
        }

        const conversation = await findOrCreateConversation(me, receiverId);

        let message;
        let isNew = true;

        try {
            message = await Message.create({
                conversationId: conversation._id,
                senderId: me,
                clientMessageId,
                algorithm,
                keyId: envelope.keyId || null,
                iv,
                ciphertext,
                hmac: envelope.hmac ?? envelope.mac ?? null,
                cryptoTimestamp: envelope.cryptoTimestamp ?? envelope.timestamp ?? null,
                // Lưu nguyên gói mã hóa gốc để giải mã không bị thiếu trường
                envelope
            });
        } catch (error) {
            // Nếu client gửi lại cùng tin nhắn do retry, trả bản đã lưu.
            if (error.code === 11000) {
                isNew = false;
                message = await Message.findOne({
                    senderId: me,
                    clientMessageId
                });
                if (!message) throw error;
            } else {
                throw error;
            }
        }

        conversation.lastMessage = message._id;
        await conversation.save();

        // Đẩy tin tới người nhận ngay lập tức
        if (isNew) {
            publish(receiverId, "message", {
                conversationId: String(conversation._id),
                message: formatMessage(message)
            });
        }

        return res.status(201).json({
            success: true,
            message: formatMessage(message)
        });
    } catch (error) {
        console.error("sendMessage error:", error);

        return res.status(500).json({
            success: false,
            message: "Không gửi được tin nhắn",
            detail: error.message
        });
    }
};

exports.getCurrentUserId = getCurrentUserId;
