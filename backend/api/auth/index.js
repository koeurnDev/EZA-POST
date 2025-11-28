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
const demo = require("./demo");
const logout = require("./logout");

// Define routes
router.use("/login", login);
router.use("/register", register);
router.use("/status", status);
router.use("/demo", demo);
router.use("/logout", logout);

router.use("/facebook", require("./facebook")); // ✅ Restored for "Connect Account"

router.use("/forgot-password", require("./forgot-password"));
router.use("/reset-password", require("./reset-password"));

// Export router
module.exports = router;
