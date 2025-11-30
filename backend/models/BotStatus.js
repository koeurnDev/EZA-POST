const mongoose = require("mongoose");

const BotStatusSchema = new mongoose.Schema({
    enabled: {
        type: Boolean,
        default: true,
        required: true
    },
    lastRun: {
        type: Date,
        default: null
    },
    totalReplies: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("BotStatus", BotStatusSchema);
