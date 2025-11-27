const mongoose = require("mongoose");

const repliedCommentSchema = new mongoose.Schema(
    {
        commentId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        postId: {
            type: String,
            required: true,
            index: true,
        },
        replyMessage: {
            type: String,
            required: true,
        },
        repliedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
        collection: "replied_comments",
    }
);

module.exports = mongoose.model("RepliedComment", repliedCommentSchema);
