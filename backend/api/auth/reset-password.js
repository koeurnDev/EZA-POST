const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const bcrypt = require("bcrypt");

// ✅ POST /api/auth/reset-password
router.post("/", async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: "Token and password are required." });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters." });
        }

        // Find user with valid token
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }, // Token must not be expired
        });

        if (!user) {
            return res.status(400).json({ error: "Password reset token is invalid or has expired." });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // Clear reset fields
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.json({
            success: true,
            message: "Password has been reset successfully! You can now login.",
        });

    } catch (err) {
        console.error("❌ Reset password error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

module.exports = router;
