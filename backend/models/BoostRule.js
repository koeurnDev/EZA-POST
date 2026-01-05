const mongoose = require('mongoose');

const boostRuleSchema = new mongoose.Schema({
    userId: {
        type: String,  // Changed from ObjectId to String to match JWT user IDs
        required: true
    },
    enabled: {
        type: Boolean,
        default: true
    },
    rules: [{
        type: {
            type: String,
            enum: ['time', 'engagement'],
            required: true
        },
        condition: {
            hours: Number,        // For time-based: boost after X hours
            minLikes: Number,     // For engagement-based: boost if likes < X
            minComments: Number,
            minShares: Number
        },
        actions: [{
            type: String,
            enum: ['like', 'comment', 'share']
        }],
        intensity: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium'
        }
    }],
    realBoost: {
        enabled: {
            type: Boolean,
            default: false
        },
        maxActionsPerAccount: {
            type: Number,
            default: 25  // Reduced from 50 to 25 (more conservative)
        },
        delayBetweenActions: {
            min: { type: Number, default: 5000 },  // Increased from 2000 to 5000ms
            max: { type: Number, default: 12000 }  // Increased from 8000 to 12000ms
        },
        cooldownHours: {
            type: Number,
            default: 4  // Increased from 3 to 4 hours
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
boostRuleSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('BoostRule', boostRuleSchema);
