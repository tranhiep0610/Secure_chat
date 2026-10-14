const mongoose = require("mongoose");
const Group = require("../models/Group");
const Friendship = require("../models/Friendship");
const { getCurrentUserId } = require("./message.controller");

function formatGroup(g) {
    const members = (g.members || []).map(u => ({
        id: String(u._id),
        username: u.username,
        displayName: u.displayName || u.username
    }));
    return {
        id: String(g._id),
        name: g.name,
        ownerId: String(g.owner),
        members,
        memberCount: members.length,
        createdAt: g.createdAt
    };
}

exports.createGroup = async (req, res) => {
    try {
        const me = getCurrentUserId(req);
        if (!me) return res.status(401).json({ success: false, message: "Chưa đăng nhập" });

        const name = String(req.body?.name || "").trim();
        const rawIds = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
        const memberIds = [...new Set(rawIds.map(String))].filter(id => id !== me);

        if (!name || name.length > 50) {
            return res.status(400).json({ success: false, message: "Tên nhóm không hợp lệ" });
        }
        if (!memberIds.every(id => mongoose.Types.ObjectId.isValid(id))) {
            return res.status(400).json({ success: false, message: "Danh sách thành viên không hợp lệ" });
        }
        if (memberIds.length < 2) {
            return res.status(400).json({ success: false, message: "Cần chọn ít nhất 2 người bạn" });
        }

        // Chỉ được thêm người đã là bạn bè
        for (const id of memberIds) {
            const pair = Friendship.normalizePair(me, id);
            const ok = await Friendship.findOne({ ...pair, status: "accepted" });
            if (!ok) {
                return res.status(403).json({ success: false, message: "Có thành viên chưa là bạn bè của bạn." });
            }
        }

        const created = await Group.create({ name, owner: me, members: [me, ...memberIds] });
        const group = await Group.findById(created._id)
            .populate("members", "username displayName")
            .lean();

        return res.status(201).json({ success: true, group: formatGroup(group) });
    } catch (error) {
        console.error("createGroup:", error);
        return res.status(500).json({ success: false, message: "Lỗi server" });
    }
};

exports.getGroups = async (req, res) => {
    try {
        const me = getCurrentUserId(req);
        if (!me) return res.status(401).json({ success: false, message: "Chưa đăng nhập" });

        const groups = await Group.find({ members: me })
            .populate("members", "username displayName")
            .sort({ updatedAt: -1 })
            .lean();

        return res.json({ success: true, groups: groups.map(formatGroup) });
    } catch (error) {
        console.error("getGroups:", error);
        return res.status(500).json({ success: false, message: "Lỗi server" });
    }
};