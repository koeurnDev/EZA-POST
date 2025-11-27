// ============================================================
// 🚀 /api/auth/demo.js (MongoDB Version)
// ============================================================

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../../models/User");

// 🔑 JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ============================================================
// ✅ POST /api/auth/demo
// ============================================================
router.post("/", async (req, res) => {
  try {
    const demoUser = {
      id: "demo_user_001",
      name: "Demo User",
      email: "demo@krpost.app",
      isDemo: true,
    };

    // ✅ Ensure demo user exists in MongoDB
    const existingUser = await User.findOne({ id: demoUser.id });
    if (!existingUser) {
      await User.create({
        id: demoUser.id,
        email: demoUser.email,
        password: "demo_pass_hash",
        name: demoUser.name,
      });
    }

    // ✅ Set session so `/auth/status` works via session
    if (req.session) {
      req.session.userId = demoUser.id;
    }

    const token = jwt.sign(demoUser, JWT_SECRET, { expiresIn: "1h" });

    res.json({
      success: true,
      message: "Welcome to the demo account!",
      token,
      user: demoUser,
    });
  } catch (err) {
    console.error("Demo login error:", err);
    res.status(500).json({
      success: false,
      message: "Server error during demo login.",
    });
  }
});

module.exports = router;
