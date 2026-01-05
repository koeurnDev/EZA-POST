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
    },

    // Boost Tracking
    isBoosted: {
        type: Boolean,
        default: false
    },
    boostCampaigns: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BoostCampaign'
    }],
    viralScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    lastMetricsSync: {
        type: Date,
        default: null
    }
});

module.exports = mongoose.model("Post", postSchema);
