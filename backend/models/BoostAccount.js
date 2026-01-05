const mongoose = require('mongoose');
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.BOOST_ENCRYPTION_KEY || 'default-key-change-in-production-32b';
const ALGORITHM = 'aes-256-cbc';

// Encryption helper
function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

// Decryption helper
function decrypt(text) {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

const boostAccountSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    platform: {
        type: String,
        enum: ['tiktok', 'facebook', 'instagram'],
        default: 'tiktok'
    },
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true,
        set: function (value) {
            return encrypt(value);
        }
    },
    cookies: {
        type: Array,
        default: []
    },
    cookiesUpdated: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'banned', 'cooldown', 'error'],
        default: 'active'
    },
    lastUsed: {
        type: Date
    },
    totalActions: {
        type: Number,
        default: 0
    },
    dailyLimit: {
        type: Number,
        default: 25  // Reduced from 50 to 25 (more conservative)
    },
    actionsToday: {
        type: Number,
        default: 0
    },
    lastResetDate: {
        type: Date,
        default: Date.now
    },
    cooldownUntil: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Method to get decrypted password
boostAccountSchema.methods.getPassword = function () {
    return decrypt(this.password);
};

// Method to check if account is available
boostAccountSchema.methods.isAvailable = function () {
    if (this.status === 'banned') return false;
    if (this.status === 'cooldown' && this.cooldownUntil > new Date()) return false;

    // Reset daily counter if new day
    const today = new Date().toDateString();
    const lastReset = new Date(this.lastResetDate).toDateString();
    if (today !== lastReset) {
        this.actionsToday = 0;
        this.lastResetDate = new Date();
    }

    return this.actionsToday < this.dailyLimit;
};

// Method to record action
boostAccountSchema.methods.recordAction = async function () {
    this.totalActions += 1;
    this.actionsToday += 1;
    this.lastUsed = new Date();

    // Set cooldown if approaching limit
    if (this.actionsToday >= this.dailyLimit * 0.8) {
        const cooldownHours = 2 + Math.random() * 2; // 2-4 hours
        this.cooldownUntil = new Date(Date.now() + cooldownHours * 60 * 60 * 1000);
        this.status = 'cooldown';
    }

    await this.save();
};

// Index for efficient queries
boostAccountSchema.index({ userId: 1, platform: 1 });
boostAccountSchema.index({ status: 1, lastUsed: 1 });

module.exports = mongoose.model('BoostAccount', boostAccountSchema);
