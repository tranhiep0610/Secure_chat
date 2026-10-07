const mongoose = require("mongoose");

const passwordResetOtpSchema =
    new mongoose.Schema(
        {
            userId: {
                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

                required:
                    true,

                index:
                    true
            },

            emailNormalized: {
                type:
                    String,

                required:
                    true,

                trim:
                    true,

                lowercase:
                    true,

                index:
                    true
            },

            otpHash: {
                type:
                    String,

                required:
                    true
            },

            attempts: {
                type:
                    Number,

                default:
                    0
            },

            expiresAt: {
                type:
                    Date,

                required:
                    true,

                index: {
                    expires:
                        0
                }
            }
        },
        {
            timestamps:
                true,

            versionKey:
                false
        }
    );

module.exports =
    mongoose.models.PasswordResetOtp ||
    mongoose.model(
        "PasswordResetOtp",
        passwordResetOtpSchema
    );