const authMiddleware = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            message: "Bạn chưa đăng nhập"
        });
    }

    // senderId/userId phía server phải lấy từ session, không tin dữ liệu client tự gửi.
    req.auth = {
        userId: req.session.userId
    };

    return next();
};

module.exports = authMiddleware;
