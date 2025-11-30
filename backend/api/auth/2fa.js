const express = require('express');
const router = express.Router();
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const User = require('../../models/User');
const { requireAuth } = require('../../utils/auth');
const { encrypt2FASecret, decrypt2FASecret } = require('../../libs/crypto2fa');

// Step 1 — Generate TOTP + QR
router.post("/setup", requireAuth, async (req, res) => {
    try {
        console.log("🔐 Starting 2FA Setup for user:", req.user);
        const userId = req.user.id || req.user._id; // Handle both cases
        console.log("   👉 User ID:", userId);

        if (!userId) {
            throw new Error("User ID not found in request");
        }

        const secret = authenticator.generateSecret();
        console.log("   👉 Generated Secret");

        const encrypted = encrypt2FASecret(secret);
        console.log("   👉 Encrypted Secret");

        const otpURI = authenticator.keyuri(req.user.email, "EZA_POST", secret);
        const qr = await qrcode.toDataURL(otpURI);
        console.log("   👉 Generated QR Code");

        const updatedUser = await User.findOneAndUpdate({ id: userId }, {
            twoFactorSecret: encrypted,
            twoFactorVerified: false,
        }, { new: true });

        if (!updatedUser) {
            // Try finding by _id if custom id failed
            await User.findByIdAndUpdate(userId, {
                twoFactorSecret: encrypted,
                twoFactorVerified: false,
            });
        }

        console.log("   ✅ 2FA Secret Saved to DB");

        res.json({
            success: true,
            ok: true,
            qrCode: qr,
        });
    } catch (err) {
        console.error("❌ 2FA Setup Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Step 2 — Verify the OTP code
router.post("/verify", requireAuth, async (req, res) => {
    try {
        const { token } = req.body; // Frontend sends 'token' (Settings.jsx) or 'code'
        const code = token || req.body.code;
        const userId = req.user.id;

        const user = await User.findOne({ id: userId });
        if (!user || !user.twoFactorSecret) {
            return res.status(400).json({ success: false, error: "2FA not initialized." });
        }

        const secret = decrypt2FASecret(user.twoFactorSecret);
        const isValid = authenticator.verify({ token: code, secret });

        if (!isValid) return res.status(400).json({ success: false, error: "Invalid OTP." });

        await User.findOneAndUpdate({ id: userId }, {
            twoFactorEnabled: true,
            twoFactorVerified: true,
        });

        res.json({ success: true, ok: true });
    } catch (err) {
        console.error("❌ 2FA Verify Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Disable 2FA
router.post("/disable", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        await User.findOneAndUpdate({ id: userId }, {
            twoFactorEnabled: false,
            twoFactorSecret: null,
            twoFactorVerified: false,
        });

        res.json({ success: true, ok: true });
    } catch (err) {
        console.error("❌ 2FA Disable Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
