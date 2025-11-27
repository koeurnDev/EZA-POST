const express = require("express");
const router = express.Router();
const tiktokDownloader = require("../utils/tiktokDownloader");

// ============================================================
// ✅ POST /api/tiktok/validate
// ============================================================
router.post("/validate", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ valid: false, error: "URL required" });

    try {
        const id = await tiktokDownloader.extractVideoId(url);
        res.json({ valid: true, id });
    } catch (err) {
        res.json({ valid: false, error: err.message });
    }
});

// ============================================================
// ✅ GET /api/tiktok/info
// ============================================================
router.get("/info", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL required" });

    try {
        const metadata = await tiktokDownloader.getVideoMetadata(url);
        res.json({ success: true, ...metadata });
    } catch (err) {
        res.status(500).json({ success: false, error: "Failed to fetch metadata" });
    }
});

module.exports = router;
