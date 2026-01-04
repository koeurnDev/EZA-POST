// ============================================================
// ⏳ Pending Reply Model (Mongoose Schema)
// Stores replies waiting to be sent (Delay Queue)
// ============================================================

const mongoose = require("mongoose");

const pendingReplySchema = new mongoose.Schema(
    {
        commentId: {
            type: String,
            required: true,
            unique: true, // Prevent duplicates
        },
        replyMessage: {
            type: String,
            required: true,
        },
        attachmentUrl: {
            type: String,
            default: null,
        },
        pageId: {
            type: String,
            required: true,
        },
        accessToken: {
            type: String,
            required: true,
        },
        sendAt: {
            type: Date,
            required: true,
            index: true, // Optimized for polling
        },
        status: {
            type: String,
            enum: ["pending", "processing", "failed", "completed"],
            default: "pending",
        },
        attempts: {
            type: Number,
            default: 0,
        },
        error: {
            type: String,
        }
    },
    {
        timestamps: true,
        collection: "pending_replies",
    }
);

const PendingReply = mongoose.model("PendingReply", pendingReplySchema);

module.exports = PendingReply;
