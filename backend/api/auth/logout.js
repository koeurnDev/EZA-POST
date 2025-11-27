const express = require("express");
const router = express.Router();

// ============================================================
// ✅ Logout Route
// ============================================================
router.post("/", (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error("❌ Logout error:", err);
                return res.status(500).json({
                    success: false,
                    error: "Failed to log out",
                });
            }
            res.clearCookie("connect.sid"); // Clear session cookie
            res.json({ success: true, message: "Logged out successfully" });
        });
    } else {
        res.json({ success: true, message: "Logged out successfully" });
    }
});

module.exports = router;
