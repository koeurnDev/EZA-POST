const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const crypto = require("crypto");
const { sendEmail } = require("../../services/emailService"); // ✅ Import Email Service

console.log("✅ Loading Forgot Password Route...");

// ✅ POST /api/auth/forgot-password
router.post("/", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email is required." });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            // 🛡️ Security: Don't reveal if user exists
            return res.json({
                success: true,
                message: "If that email exists, we've sent a reset link.",
            });
        }

        // Generate Token
        const token = crypto.randomBytes(20).toString("hex");

        // Set Expiration (1 hour)
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        await user.save();

        // 📧 In a real app, send this via email (SendGrid, Nodemailer, etc.)
        // For now, we log it to the console for testing.
        const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${token}`;

        console.log("\n============================================================");
        console.log("🔐 PASSWORD RESET LINK (DEV MODE)");
        console.log(`👉 To: ${email}`);
        console.log(`👉 Link: ${resetLink}`);
        console.log("============================================================\n");

        // 📧 Send Reset Email
        await sendEmail({
            to: user.email,
            subject: "Reset Your Password - KR Post",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #dc2626;">Reset Your Password</h2>
                    <p>You requested a password reset. Click the button below to set a new password:</p>
                    <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                    <p style="margin-top: 20px; font-size: 12px; color: #666;">If you didn't request this, please ignore this email.</p>
                    <p style="font-size: 12px; color: #666;">Link expires in 1 hour.</p>
                </div>
            `,
        });

        res.json({
            success: true,
            message: "If that email exists, we've sent a reset link.",
        });

    } catch (err) {
        console.error("❌ Forgot password error:", err);
        res.status(500).json({ error: "Internal server error." });
    }
});

module.exports = router;
