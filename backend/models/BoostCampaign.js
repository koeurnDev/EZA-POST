const mongoose = require("mongoose");

const boostCampaignSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true,
        index: true
    },
    facebookPostId: {
        type: String,
        required: true
    },
    pageId: {
        type: String,
        required: true
    },

    // Campaign Details
    campaignId: {
        type: String,
        unique: true,
        sparse: true // Allows null until created
    },
    adSetId: {
        type: String
    },
    adId: {
        type: String
    },

    // Configuration
    budget: {
        type: Number,
        required: true,
        min: 5,
        max: 500
    },
    duration: {
        type: Number,
        required: true,
        min: 1,
        max: 30
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },

    // Targeting
    targeting: {
        ageMin: {
            type: Number,
            default: 18,
            min: 13,
            max: 65
        },
        ageMax: {
            type: Number,
            default: 65,
            min: 13,
            max: 65
        },
        genders: {
            type: [String],
            enum: ['male', 'female', 'all'],
            default: ['all']
        },
        locations: {
            type: [String],
            default: ['US']
        },
        interests: {
            type: [String],
            default: []
        },
        customAudience: {
            type: String,
            default: null
        }
    },

    // Status
    status: {
        type: String,
        enum: ['draft', 'active', 'paused', 'completed', 'failed'],
        default: 'draft',
        index: true
    },

    // Performance Metrics (synced from FB)
    metrics: {
        spend: {
            type: Number,
            default: 0
        },
        impressions: {
            type: Number,
            default: 0
        },
        reach: {
            type: Number,
            default: 0
        },
        clicks: {
            type: Number,
            default: 0
        },
        ctr: {
            type: Number,
            default: 0
        },
        cpc: {
            type: Number,
            default: 0
        },
        engagement: {
            type: Number,
            default: 0
        }
    },

    // Error tracking
    error: {
        type: String,
        default: null
    },

    // Tracking
    lastSyncedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    collection: 'boostcampaigns'
});

// Compound indexes for efficient queries
boostCampaignSchema.index({ userId: 1, status: 1 });
boostCampaignSchema.index({ userId: 1, createdAt: -1 });
boostCampaignSchema.index({ postId: 1, status: 1 });

// Method to check if campaign is active
boostCampaignSchema.methods.isActive = function () {
    const now = new Date();
    return this.status === 'active' && now >= this.startDate && now <= this.endDate;
};

// Method to calculate remaining budget
boostCampaignSchema.methods.getRemainingBudget = function () {
    const totalBudget = this.budget * this.duration;
    return totalBudget - (this.metrics.spend || 0);
};

module.exports = mongoose.model("BoostCampaign", boostCampaignSchema);
