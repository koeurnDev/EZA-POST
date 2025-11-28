// ============================================================
// 📜 Bot History Model (Mongoose Schema)
// Logs all bot actions for transparency and analytics
// ============================================================

const mongoose = require("mongoose");

const botHistorySchema = new mongoose.Schema(
    {
        commentId: {
            type: String,
            required: true,
        },
        replyMessage: {
            type: String,
            required: true,
        },
        pageName: {
            type: String,
        },
        pageId: {
            type: String,
        },
        status: {
            type: String,
            enum: ["success", "failed"],
            required: true,
        },
        error: {
            type: String,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
        collection: "bot_history",
    }
);

const BotHistory = mongoose.model("BotHistory", botHistorySchema);

module.exports = BotHistory;
