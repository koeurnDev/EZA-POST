const mongoose = require("mongoose");

const platformConfigSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    platform: {
        type: String,
        required: true,
        enum: ['youtube', 'tiktok', 'instagram']
    },
    accessToken: {
        type: String,
        required: true
    },
    refreshToken: {
        type: String
    },
    tokenExpiresAt: {
        type: Date
    },
    profileName: {
        type: String
    },
    profilePicture: {
        type: String
    },
    externalId: {
        type: String
    },
    isConnected: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// 🔒 Encryption Hooks (Reuse logic from User.js later or keep simple for now)
// ideally we should encrypt accessToken here too.

module.exports = mongoose.model("PlatformConfig", platformConfigSchema);
