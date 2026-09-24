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
            type: Number,
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