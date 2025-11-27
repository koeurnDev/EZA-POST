const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true,
    },
    caption: {
        type: String,
        required: true,
    },
    videoUrl: {
        type: String,
        required: true,
    },
    accounts: {
        type: [String], // Array of account IDs or names
        required: true,
    },
    scheduleTime: {
        type: Date,
        default: null,
    },
    status: {
        type: String,
        enum: ["created", "scheduled", "processing", "published", "failed"],
        default: "created",
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    error: {
        type: String,
        default: null,
    }
});

module.exports = mongoose.model("Post", postSchema);
