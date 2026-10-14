const mongoose = require("mongoose");
 
const messageSchema = new mongoose.Schema(
    {
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Conversation",
            required: true,
            index: true
        },
 
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
 
        clientMessageId: {
            type: String,
            required: true
        },
 
        algorithm: {
            type: String,
            enum: [
                "AES-GCM",
                "DES-CBC"
            ],
            required: true
        },
 
        keyId: {
            type: String,
            default: null
        },
 
        iv: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
 
        ciphertext: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
 
        hmac: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
 
        cryptoTimestamp: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
 
        // Gói mã hóa gốc từ frontend (version, timestamp, mac...),
        // cần giữ nguyên để giải mã không bị thiếu trường.
        envelope: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
 
        // Thời điểm người nhận đã đọc tin. Thiếu trường này thì
        // số tin chưa đọc không bao giờ giảm.
        readAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);
 
// tránh lưu trùng nếu client gửi retry
messageSchema.index(
    {
        senderId: 1,
        clientMessageId: 1
    },
    {
        unique: true
    }
);
 
messageSchema.index({
    conversationId: 1,
    createdAt: 1
});
 
module.exports = mongoose.model(
    "Message",
    messageSchema
);
 