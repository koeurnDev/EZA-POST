// ============================================================
// 🛡️ AUTH ROUTER (Login + Register)
// ============================================================

const express = require("express");
const router = express.Router();

console.log("🔄 Loading Auth Routes...");

// Import route handlers
const login = require("./login");
const register = require("./register");
const status = require("./status");
const logout = require("./logout");

// Define routes
router.use("/login", login);
router.use("/register", register);
router.use("/status", status);
router.use("/logout", logout);

router.use("/facebook", require("./facebook")); // ✅ Restored for "Connect Account"
router.use("/google", require("./google")); // 🔴 Google OAuth & One Tap
router.use("/telegram", require("./telegram")); // 🔷 Telegram Login Widget

router.use("/forgot-password", require("./forgot-password"));
router.use("/reset-password", require("./reset-password"));
router.use("/2fa", require("./2fa")); // 🔐 2FA Routes

// Export router
module.exports = router;
