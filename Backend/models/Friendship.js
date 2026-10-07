const mongoose = require("mongoose");


// =====================================================
// FRIENDSHIP SCHEMA
// =====================================================

const friendshipSchema =
    new mongoose.Schema(
        {
            // Hai người trong quan hệ bạn bè.
            // userA và userB luôn được sắp xếp cố định
            // để tránh tạo trùng A-B và B-A.

            userA: {
                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

                required:
                    true,

                index:
                    true
            },


            userB: {
                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

                required:
                    true,

                index:
                    true
            },


            // Người gửi lời mời
            requestedBy: {
                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

                required:
                    true
            },


            // Trạng thái quan hệ
            status: {
                type:
                    String,

                enum: [
                    "pending",
                    "accepted",
                    "rejected"
                ],

                default:
                    "pending",

                index:
                    true
            },


            // Thời điểm accept / reject
            respondedAt: {
                type:
                    Date,

                default:
                    null
            }
        },

        {
            timestamps:
                true,

            versionKey:
                false
        }
    );


// =====================================================
// INDEX
// Một cặp user chỉ có duy nhất một friendship
// =====================================================

friendshipSchema.index(
    {
        userA: 1,
        userB: 1
    },

    {
        unique:
            true
    }
);


friendshipSchema.index(
    {
        status: 1,
        requestedBy: 1,
        createdAt: -1
    }
);


// =====================================================
// NORMALIZE PAIR
//
// A gửi B hay B gửi A đều tạo ra cùng:
// {
//     userA,
//     userB
// }
// =====================================================

friendshipSchema.statics.normalizePair =
    function (
        firstUserId,
        secondUserId
    ) {
        const first =
            String(
                firstUserId
            );


        const second =
            String(
                secondUserId
            );


        if (
            !first ||
            !second
        ) {
            throw new Error(
                "Thiếu userId."
            );
        }


        if (
            first ===
            second
        ) {
            throw new Error(
                "Không thể kết bạn với chính mình."
            );
        }


        if (
            first <
            second
        ) {
            return {
                userA:
                    firstUserId,

                userB:
                    secondUserId
            };
        }


        return {
            userA:
                secondUserId,

            userB:
                firstUserId
        };
    };


// =====================================================
// KIỂM TRA USER CÓ NẰM TRONG FRIENDSHIP KHÔNG
// =====================================================

friendshipSchema.methods.containsUser =
    function (
        userId
    ) {
        const id =
            String(
                userId
            );


        return (
            String(
                this.userA
            ) === id ||

            String(
                this.userB
            ) === id
        );
    };


// =====================================================
// LẤY ID NGƯỜI CÒN LẠI
// =====================================================

friendshipSchema.methods.getOtherUserId =
    function (
        userId
    ) {
        const id =
            String(
                userId
            );


        if (
            String(
                this.userA
            ) === id
        ) {
            return this.userB;
        }


        if (
            String(
                this.userB
            ) === id
        ) {
            return this.userA;
        }


        return null;
    };


// =====================================================
// EXPORT
//
// mongoose.models.Friendship giúp tránh lỗi:
// OverwriteModelError
// =====================================================

module.exports =
    mongoose.models.Friendship ||
    mongoose.model(
        "Friendship",
        friendshipSchema
    );