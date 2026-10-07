const mongoose = require("mongoose");

const userSchema =
    new mongoose.Schema(
        {
            username: {
                type: String,
                required: true,
                trim: true,
                minlength: 3,
                maxlength: 32
            },

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

            email: {
                type: String,
                required: true,
                trim: true,
                maxlength: 254
            },

            emailNormalized: {
                type: String,
                required: true,
                unique: true,
                index: true,
                trim: true,
                lowercase: true,
                maxlength: 254
            },

            emailVerified: {
                type: Boolean,
                default: true
            },

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

userSchema.set(
    "toJSON",
    {
        transform:
            (_doc, ret) => {

                delete ret.passwordHash;
                delete ret.usernameNormalized;
                delete ret.emailNormalized;

                return ret;
            }
    }
);

module.exports =
    mongoose.models.User ||
    mongoose.model(
        "User",
        userSchema
    );