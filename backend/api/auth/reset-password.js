const express = require("express");
const router = express.Router();
const prisma = require("../../utils/prisma");
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
        const user = await prisma.user.findFirst({
            where: {
                resetPasswordToken: token,
                resetPasswordExpires: { gt: new Date() }, // Token must not be expired
            }
        });

        if (!user) {
            return res.status(400).json({ error: "Password reset token is invalid or has expired." });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Update user: Clear reset fields & set new password
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpires: null
            }
        });

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
