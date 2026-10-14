const express = require("express");
const router = express.Router();
const { saveMyAvatar, getAvatar } = require("../controllers/avatar.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.patch("/me", authMiddleware, saveMyAvatar);
router.get("/:userId", authMiddleware, getAvatar);

module.exports = router;