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
    platforms: [{
        name: { type: String, enum: ['facebook', 'youtube', 'tiktok', 'instagram'] },
        status: { type: String, enum: ['pending', 'published', 'failed'], default: 'pending' },
        postId: { type: String }, // External ID
        error: { type: String }
    }],
    mediaType: {
        type: String,
        enum: ["video", "image", "carousel"],
        default: "video"
    },
    // Legacy support (optional helper)
    platformStatus: {
        facebook: { type: String },
        youtube: { type: String },
        tiktok: { type: String },
        instagram: { type: String }
    }
});

module.exports = mongoose.model("Post", postSchema);
