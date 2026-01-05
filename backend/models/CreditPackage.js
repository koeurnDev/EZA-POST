const mongoose = require('mongoose');

const creditPackageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    credits: {
        type: Number,
        required: true
    },
    price: {
        type: Number,  // in USD
        required: true
    },
    priceKHR: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    popular: {
        type: Boolean,
        default: false
    },
    active: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('CreditPackage', creditPackageSchema);
