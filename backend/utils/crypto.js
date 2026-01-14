const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "default_secret_key_must_be_32_bytes_long";

function getEncryptionKey() {
    // Ensure key is 32 bytes for AES-256
    return crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substr(0, 32);
}

function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(getEncryptionKey()), iv);
    let encrypted = cipher.update(String(text));
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return text;
    if (typeof text !== 'string' || !text.includes(':')) return text; // Already decrypted or invalid

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
        console.warn("⚠️ Decryption failed:", err.message);
        return text;
    }
}

module.exports = { encrypt, decrypt };
