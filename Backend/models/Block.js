const mongoose = require("mongoose");


// =====================================================
// BLOCK SCHEMA
// =====================================================

const blockSchema =
    new mongoose.Schema(
        {
            // Người thực hiện chặn
            blocker: {
                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

                required:
                    true,

                index:
                    true
            },


            // Người bị chặn
            blocked: {
                type:
                    mongoose.Schema.Types.ObjectId,

                ref:
                    "User",

                required:
                    true,

                index:
                    true
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
// Không cho một user chặn cùng một người nhiều lần
// =====================================================

blockSchema.index(
    {
        blocker: 1,
        blocked: 1
    },

    {
        unique:
            true
    }
);


// =====================================================
// EXPORT
// Tránh lỗi OverwriteModelError
// =====================================================

module.exports =
    mongoose.models.Block ||
    mongoose.model(
        "Block",
        blockSchema
    );