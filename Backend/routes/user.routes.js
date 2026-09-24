const express = require("express");

const { getUsers } = require("../controllers/user.controller");

const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/", authMiddleware, getUsers);

module.exports = router;