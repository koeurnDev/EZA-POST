const crypto = require("crypto");

// Ensure ENCRYPTION_KEY is available and valid
const getEncryptionKey = () => {
    const key = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "default_secret_key_must_be_32_bytes_long";
    // Create a 32-byte key from the string
    return crypto.createHash('sha256').update(String(key)).digest();
};

const ALGO = "aes-256-gcm";

exports.encrypt2FASecret = (secret) => {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, key, iv);

    const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Return IV + Tag + Encrypted Data (Base64)
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
};

exports.decrypt2FASecret = (data) => {
    if (!data) return null;

    try {
        const key = getEncryptionKey();
        const buff = Buffer.from(data, "base64");

        const iv = buff.subarray(0, 12);
        const tag = buff.subarray(12, 28);
        const ciphertext = buff.subarray(28);

        const decipher = crypto.createDecipheriv(ALGO, key, iv);
        decipher.setAuthTag(tag);

        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return decrypted.toString("utf8");
    } catch (err) {
        console.error("❌ Decryption Failed:", err.message);
        return null;
    }
};
