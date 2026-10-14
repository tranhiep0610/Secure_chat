const express = require("express");
const router = express.Router();
const { createGroup, getGroups } = require("../controllers/group.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.get("/", authMiddleware, getGroups);
router.post("/", authMiddleware, createGroup);

module.exports = router;
