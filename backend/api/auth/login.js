const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");

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
    const user = await User.findOne({ email });
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

    // Update last login
    user.last_login = new Date();
    await user.save();

    // 🎫 Generate JWT (valid for 1 day)
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "supersecretkey",
      { expiresIn: "1d" }
    );

    // 🍪 Send token in cookie (secure & HttpOnly)
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
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
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({
      success: false,
      error: "Internal server error during login",
    });
  }
});

module.exports = router;
