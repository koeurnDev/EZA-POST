// ============================================================
// 👤 User Model (Mongoose Schema)
// ============================================================

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        password: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            default: "User",
        },
        plan: {
            type: String,
            enum: ["free", "pro"],
            default: "free"
        },
        last_login: {
            type: Date,
        },
        facebookId: {
            type: String,
            unique: true,
            sparse: true, // Allows null/undefined values to not conflict
        },
        facebookAccessToken: {
            type: String,
        },
        facebookName: {
            type: String, // 👤 Store Facebook User Name
        },
        facebookTokenExpiresAt: {
            type: Date, // ⏳ Token Expiration Date
        },
        selectedPages: {
            type: [String], // 📋 Array of Page IDs that are "ON"
            default: [],
        },
        connectedPages: [{
            id: String,
            name: String,
            access_token: String,
            picture: String,
            category: String
        }],
        pageSettings: [{
            pageId: String,
            enableBot: { type: Boolean, default: false },
            enableSchedule: { type: Boolean, default: true },
            enableInbox: { type: Boolean, default: false }
        }],
        avatar: {
            type: String,
        },
        coverImage: {
            type: String,
        },
        role: {
            type: String,
            default: "user",
            enum: ["user", "admin"],
        },
        resetPasswordToken: {
            type: String,
        },
        resetPasswordExpires: {
            type: Date,
        },
        // 🔐 2FA Fields
        twoFactorSecret: {
            type: String, // Encrypted secret (AES-256-GCM)
            default: null,
        },
        twoFactorEnabled: {
            type: Boolean,
            default: false,
        },
        twoFactorVerified: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt
        collection: "users",
    }
);

// 🔐 Encryption Helpers (For Access Tokens Only - Legacy/System)
const crypto = require('crypto');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "default_secret_key_must_be_32_bytes_long";
const IV_LENGTH = 16;

function getEncryptionKey() {
    return crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substr(0, 32);
}

function encrypt(text) {
    if (!text) return text;
    if (text.includes(':') && text.split(':')[0].length === 32) return text;

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(getEncryptionKey()), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return text;
    const textParts = text.split(':');
    if (textParts.length !== 2) return text;

    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts[1], 'hex');

    try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(getEncryptionKey()), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (err) {
        return text;
    }
}

// 🔒 Pre-save Hook to Encrypt Tokens (Facebook Only)
userSchema.pre('save', function (next) {
    // Encrypt User Token
    if (this.isModified('facebookAccessToken') && this.facebookAccessToken) {
        this.facebookAccessToken = encrypt(this.facebookAccessToken);
    }

    // Encrypt Page Tokens
    if (this.isModified('connectedPages') && this.connectedPages && this.connectedPages.length > 0) {
        this.connectedPages.forEach(page => {
            if (page.access_token) {
                page.access_token = encrypt(page.access_token);
            }
        });
    }

    // ⚠️ Note: twoFactorSecret is encrypted manually in the controller using crypto2fa.js
    next();
});

// 🔓 Methods to Get Decrypted Tokens
userSchema.methods.getDecryptedAccessToken = function () {
    return decrypt(this.facebookAccessToken);
};

userSchema.methods.getDecryptedPageToken = function (pageId) {
    const page = this.connectedPages.find(p => p.id === pageId);
    return page ? decrypt(page.access_token) : null;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
