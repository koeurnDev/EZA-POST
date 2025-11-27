// ============================================================
// 🤖 Bot Rule Model (Mongoose Schema)
// ============================================================

const mongoose = require("mongoose");

const botRuleSchema = new mongoose.Schema(
    {
        keyword: {
            type: String,
            required: function () { return this.type === 'KEYWORD'; }, // Only required if type is KEYWORD
            trim: true,
        },
        reply: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ["KEYWORD", "ALL_POSTS"],
            default: "KEYWORD",
        },
        matchType: {
            type: String,
            enum: ["EXACT", "CONTAINS"],
            default: "CONTAINS",
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
