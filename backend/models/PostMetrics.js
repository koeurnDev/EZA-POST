const mongoose = require("mongoose");

const postMetricsSchema = new mongoose.Schema({
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true,
        index: true
    },
    facebookPostId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    pageId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },

    // Engagement Metrics
    likes: {
        type: Number,
        default: 0
    },
    comments: {
        type: Number,
        default: 0
    },
    shares: {
        type: Number,
        default: 0
    },
    reactions: {
        like: { type: Number, default: 0 },
        love: { type: Number, default: 0 },
        haha: { type: Number, default: 0 },
        wow: { type: Number, default: 0 },
        sad: { type: Number, default: 0 },
        angry: { type: Number, default: 0 }
    },
    reach: {
        type: Number,
        default: 0
    },
    impressions: {
        type: Number,
        default: 0
    },
    engagement: {
        type: Number,
        default: 0
    },

    // Viral Score Calculation
    viralScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
        index: -1 // Descending index for sorting
    },
    viralTier: {
        type: String,
        enum: ['low', 'medium', 'high', 'viral'],
        default: 'low'
    },

    // Tracking
    lastSyncedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'postmetrics'
});

// Compound index for efficient queries
postMetricsSchema.index({ userId: 1, viralScore: -1 });
postMetricsSchema.index({ pageId: 1, createdAt: -1 });

// Method to calculate total engagement
postMetricsSchema.methods.calculateEngagement = function () {
    const totalReactions = Object.values(this.reactions).reduce((sum, val) => sum + val, 0);
    this.engagement = this.likes + this.comments + this.shares + totalReactions;
    return this.engagement;
};

module.exports = mongoose.model("PostMetrics", postMetricsSchema);
