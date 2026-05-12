const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require('../../utils/prisma');
const { sendEmail } = require("../../services/emailService");

// ============================================================
// ✅ Register Route
// ============================================================
router.post("/", async (req, res) => {
  const { email, password, name } = req.body;

  // 🛑 Validate input
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required",
    });
  }

  // 🔒 Standard Password Policy (Min 6 chars)
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: "Password must be at least 6 characters long.",
    });
  }

  try {
    console.log(`[Register] Attempting to find user: ${email}`);
    // 🔍 Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      console.log(`[Register] User already exists: ${email}`);
      return res.status(409).json({
        success: false,
        error: "User already exists. Please log in instead.",
      });
    }

    // 🔐 Hash password
    console.log(`[Register] Hashing password for: ${email}`);
    const hashedPassword = await bcrypt.hash(password, 10);

    // 💾 Create new user in PostgreSQL
    console.log(`[Register] Creating user in DB: ${email}`);
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || "User",
        plan: "free",
        role: "user",
      },
    });

    console.log(`✅ [Register] New user created: ${newUser.id} (${email})`);

    // 📧 Send Welcome Email
    console.log(`[Register] Sending welcome email to: ${email}`);
    try {
      await sendEmail({
        to: newUser.email,
        subject: "Welcome to EZA_POST! 🚀",
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h1 style="color: #2563eb;">Welcome to EZA_POST!</h1>
            <p>Hi <strong>${newUser.name}</strong>,</p>
            <p>Thank you for joining EZA_POST. We're excited to have you on board!</p>
            <p>You can now log in and start scheduling your posts.</p>
            <br>
            <p>Best regards,</p>
            <p><strong>The EZA_POST Team</strong></p>
            </div>
        `,
      });
      console.log(`✅ [Register] Welcome email sent to: ${email}`);
    } catch (emailErr) {
      console.warn("⚠️ [Register] Failed to send welcome email:", emailErr.message);
    }

    // 🎫 Create JWT token for instant login
    console.log(`[Register] Generating JWT for: ${email}`);
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email },
      process.env.JWT_SECRET || "supersecretkey",
      { expiresIn: "1d" }
    );

    // 🍪 Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    // ✅ Response
    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token, // ✅ Return token for localStorage
      user: { id: newUser.id, email: newUser.email, name: newUser.name },
    });
  } catch (err) {
    console.error("❌ [Register] Critical Error:", err);
    return res.status(500).json({
      success: false,
      error: "Registration failed. Please try again later.",
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router;

