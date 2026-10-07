const mongoose = require("mongoose");

const pendingRegistrationSchema =
    new mongoose.Schema(
        {
            username: {
                type: String,
                required: true,
                trim: true
            },

            usernameNormalized: {
                type: String,
                required: true,
                trim: true,
                lowercase: true,
                index: true
            },

            displayName: {
                type: String,
                required: true,
                trim: true,
                maxlength: 50
            },

            email: {
                type: String,
                required: true,
                trim: true
            },

            emailNormalized: {
                type: String,
                required: true,
                trim: true,
                lowercase: true,
                index: true
            },

            passwordHash: {
                type: String,
                required: true
            },

            otpHash: {
                type: String,
                required: true
            },

            attempts: {
                type: Number,
                default: 0
            },

            expiresAt: {
                type: Date,
                required: true,
                index: {
                    expires: 0
                }
            }
        },
        {
            timestamps: true,
            versionKey: false
        }
    );

module.exports =
    mongoose.models.PendingRegistration ||
    mongoose.model(
        "PendingRegistration",
        pendingRegistrationSchema
    );