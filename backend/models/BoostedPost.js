const mongoose = require('mongoose');

const boostedPostSchema = new mongoose.Schema({
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    },
    userId: {
        type: String,  // Changed from ObjectId to String to match JWT user IDs
        required: true
    },
    boostStarted: {
        type: Date,
        default: Date.now
    },
    boostEnded: {
        type: Date
    },
    metrics: {
        likesAdded: {
            type: Number,
            default: 0
        },
        commentsAdded: {
            type: Number,
            default: 0
        },
        sharesAdded: {
            type: Number,
            default: 0
        }
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'paused'],
        default: 'active'
    },
    ruleTriggered: {
        type: String // Description of which rule triggered this boost
    },
    realBoost: {
        enabled: {
            type: Boolean,
            default: false
        },
        accountsUsed: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BoostAccount'
        }],
        actionsCompleted: [{
            accountId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'BoostAccount'
            },
            action: {
                type: String,
                enum: ['like', 'comment', 'share']
            },
            timestamp: Date,
            success: Boolean,
            error: String
        }]
    }
});

// Index for efficient queries
boostedPostSchema.index({ userId: 1, status: 1 });
boostedPostSchema.index({ postId: 1 });

module.exports = mongoose.model('BoostedPost', boostedPostSchema);
