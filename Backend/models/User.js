const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        // Tên đăng nhập người dùng nhập/nhìn thấy.
        username: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 32
        },

        // Dùng để tìm kiếm và chống trùng không phân biệt hoa/thường.
        usernameNormalized: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true,
            lowercase: true,
            minlength: 3,
            maxlength: 32
        },

        displayName: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 50
        },

        // Chỉ controller đăng nhập mới được chủ động lấy trường này.
        passwordHash: {
            type: String,
            required: true,
            select: false
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Lớp bảo vệ bổ sung: nếu document bị JSON hóa thì vẫn không lộ passwordHash.
userSchema.set("toJSON", {
    transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.usernameNormalized;
        return ret;
    }
});

module.exports = mongoose.model("User", userSchema);
