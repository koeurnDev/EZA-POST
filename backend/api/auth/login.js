const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require('../../utils/prisma');
const { authenticator } = require('otplib');
const { decrypt2FASecret } = require('../../libs/crypto2fa');

// ============================================================
// ✅ Login Route
// ============================================================
router.post("/", async (req, res) => {
  const { email, password } = req.body;

  // 🛑 Validate input
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required",
    });
  }

  try {
    // 🔍 Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // 🔐 Verify password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    // 🔐 2FA Check
    if (user.twoFactorEnabled) {
      const tempToken = jwt.sign(
        { id: user.id, email: user.email, scope: '2fa_pending' },
        process.env.JWT_SECRET || "supersecretkey",
        { expiresIn: "5m" }
      );
      return res.json({
        success: true,
        requires2FA: true,
        tempToken
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // 🎫 Generate JWT (valid for 1 day)
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "supersecretkey",
      { expiresIn: "1d" }
    );

    // 🍪 Send token in cookie (secure & HttpOnly)
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || process.env.RENDER === "true",
      sameSite: (process.env.NODE_ENV === "production" || process.env.RENDER === "true") ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    console.log(`✅ User logged in: ${email}`);

    // ✅ Respond success
    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        role: user.role
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error during login",
      details: err.message
    });
  }
});

// ============================================================
// ✅ 2FA Verification Route (Complete Login)
// ============================================================
router.post("/2fa", async (req, res) => {
  const { tempToken, code } = req.body;

  if (!tempToken || !code) {
    return res.status(400).json({ success: false, error: "Token and code required" });
  }

  try {
    // Verify Temp Token
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET || "supersecretkey");
    if (decoded.scope !== '2fa_pending') throw new Error('Invalid token scope');

    // Find User
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) throw new Error('User not found');

    // Verify TOTP
    const secret = decrypt2FASecret(user.twoFactorSecret);
    const isValid = authenticator.verify({ token: code, secret });

    if (!isValid) return res.status(401).json({ success: false, error: "Invalid 2FA Code" });

    // ✅ Success - Update login time & Issue Full Token
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "supersecretkey",
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || process.env.RENDER === "true",
      sameSite: (process.env.NODE_ENV === "production" || process.env.RENDER === "true") ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: "Login successful",
      user: { id: user.id, name: user.name, email: user.email }
    });

  } catch (err) {
    console.error("❌ 2FA Login Error:", err.message);
    res.status(401).json({ success: false, error: "Invalid or expired session" });
  }
});

module.exports = router;

