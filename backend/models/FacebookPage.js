const mongoose = require("mongoose");

const facebookPageSchema = new mongoose.Schema({
    userId: {
        type: String, // or mongoose.Schema.Types.ObjectId if referencing User _id
        required: true,
        index: true
    },
    pageId: {
        type: String,
        required: true,
        unique: true
    },
    pageName: {
        type: String,
        required: true
    },
    pageAccessToken: {
        type: String,
        required: true
    },
    pictureUrl: {
        type: String
    }
}, {
    timestamps: true
});

// Encryption helper (reuse from User.js or move to util)
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

facebookPageSchema.pre('save', function (next) {
    if (this.isModified('pageAccessToken') && this.pageAccessToken) {
        this.pageAccessToken = encrypt(this.pageAccessToken);
    }
    next();
});

facebookPageSchema.methods.getDecryptedAccessToken = function () {
    return decrypt(this.pageAccessToken);
};

module.exports = mongoose.model("FacebookPage", facebookPageSchema);
