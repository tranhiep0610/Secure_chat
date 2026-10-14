const mongoose = require("mongoose");
const Avatar = require("../models/Avatar");
const { getCurrentUserId } = require("./message.controller");

const MAX_BYTES = 300 * 1024;

exports.saveMyAvatar = async (req, res) => {
    try {
        const me = getCurrentUserId(req);
        if (!me) return res.status(401).json({ success: false, message: "Chưa đăng nhập" });

        const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
            String(req.body?.dataUrl || "")
        );
        if (!m) return res.status(400).json({ success: false, message: "Ảnh không hợp lệ" });

        const buf = Buffer.from(m[2], "base64");
        if (!buf.length || buf.length > MAX_BYTES) {
            return res.status(400).json({ success: false, message: "Ảnh quá lớn" });
        }

        await Avatar.findOneAndUpdate(
            { userId: me },
            { mime: m[1], data: buf },
            { upsert: true, setDefaultsOnInsert: true }
        );

        return res.json({ success: true });
    } catch (error) {
        console.error("saveMyAvatar:", error);
        return res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

exports.getAvatar = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(404).end();

        const doc = await Avatar.findOne({ userId });
        if (!doc) return res.status(404).end();

        res.set("Content-Type", doc.mime);
        res.set("Cache-Control", "private, max-age=30");
        return res.send(doc.data);
    } catch (error) {
        console.error("getAvatar:", error);
        return res.status(500).end();
    }
};