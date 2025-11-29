const express = require("express");
const router = express.Router();
const tiktokDownloader = require("../utils/tiktokDownloader");
const { uploadFile } = require("../utils/cloudinary");
const fs = require("fs");
const path = require("path");

// 🗂️ Ensure temp directory exists
const tempDir = path.join(__dirname, "../../temp/videos");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// ============================================================
// ✅ POST /api/tiktok/process (Download & Upload to Cloudinary)
// ============================================================
router.post("/process", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: "URL required" });

    try {
        console.log(`🔄 Processing TikTok URL: ${url}`);

        // 1. Download Video
        const videoBuffer = await tiktokDownloader.downloadTiktokVideo(url);

        // 2. Save to Temp File
        const tempFilename = `tiktok_${Date.now()}.mp4`;
        const tempFilePath = path.join(tempDir, tempFilename);
        fs.writeFileSync(tempFilePath, videoBuffer);

        // 3. Upload to Cloudinary
        console.log(`📤 Uploading to Cloudinary...`);
        const result = await uploadFile(tempFilePath, "kr_post/videos", "video");

        // 4. Return Result
        res.json({
            success: true,
            url: result.url,
            publicId: result.publicId,
            size: result.size
        });

    } catch (err) {
        console.error("❌ TikTok processing failed:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

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

// ============================================================
// ✅ GET /api/tiktok/preview (Redirect to MP4)
// ============================================================
router.get("/preview", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL required");

    try {
        const videoUrl = await tiktokDownloader.getPlayableUrl(url);
        // Redirect to the actual video file
        res.redirect(videoUrl);
    } catch (err) {
        console.error("Preview error:", err.message);
        res.status(500).send("Failed to load video preview");
    }
});

module.exports = router;
