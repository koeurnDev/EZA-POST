const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['purchase', 'spend', 'refund', 'bonus'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    balance: {
        type: Number,
        required: true
    },
    description: {
        type: String
    },
    relatedId: {
        type: String  // Order ID or Boost ID
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient queries
creditTransactionSchema.index({ userId: 1, createdAt: -1 });
creditTransactionSchema.index({ type: 1 });

module.exports = mongoose.model('CreditTransaction', creditTransactionSchema);
