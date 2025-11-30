// ============================================================
// 🤖 Bot Rule Model (Mongoose Schema)
// ============================================================

const mongoose = require("mongoose");

const botRuleSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        keyword: {
            type: String,
            required: true,
            trim: true,
        },
        reply: {
            type: String,
            required: true,
        },
        ruleType: {
            type: String,
            enum: ["KEYWORD", "REGEX"],
            default: "KEYWORD",
        },
        scope: {
            type: String,
            enum: ["ALL", "SPECIFIC"],
            default: "ALL",
        },
        postId: {
            type: String,
            // Only required if scope is SPECIFIC
        },
        enabled: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        collection: "bot_rules",
    }
);

const botStatusSchema = new mongoose.Schema(
    {
        enabled: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        collection: "bot_status",
    }
);

const BotRule = mongoose.model("BotRule", botRuleSchema);
const BotStatus = mongoose.model("BotStatus", botStatusSchema);

module.exports = { BotRule, BotStatus };
