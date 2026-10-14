const mongoose = require("mongoose");

const avatarSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        mime: { type: String, default: "image/jpeg" },
        data: { type: Buffer, required: true }
    },
    { timestamps: true }
);

module.exports = mongoose.models.Avatar || mongoose.model("Avatar", avatarSchema);