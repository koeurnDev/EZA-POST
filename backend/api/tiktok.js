const express = require("express");
const router = express.Router();
const tiktokDownloader = require("../utils/tiktokDownloader");
const { uploadFile } = require("../utils/cloudinary");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { requireAuth } = require("../utils/auth");
const { isTikTokPageUrl } = require("../utils/tiktokSource");

// 🗂️ Ensure temp directory exists
const tempDir = path.join(__dirname, "../../temp/videos");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// ============================================================
// ✅ POST /api/tiktok/process (Download & Upload to Cloudinary)
// ============================================================
router.post("/process", requireAuth, async (req, res) => {
    const { url } = req.body || {};
    if (!isTikTokPageUrl(url)) {
        return res.status(400).json({ success: false, error: "Enter a valid HTTPS TikTok link." });
    }
    const tempFilePath = path.join(tempDir, `tiktok_${crypto.randomUUID()}.mp4`);

    try {
        const downloadResult = await tiktokDownloader.downloadTiktokVideo(url);
        if (!downloadResult || !downloadResult.buffer) {
            throw new Error("TikTok download failed: no video buffer returned");
        }
        tiktokDownloader.validateVideoBuffer(downloadResult.buffer);
        await fs.promises.writeFile(tempFilePath, downloadResult.buffer, { flag: "wx" });
        const result = await uploadFile(tempFilePath, "kr_post/videos", "video");
        return res.json({
            success: true,
            url: result.url,
            publicId: result.publicId,
            size: result.size,
        });
    } catch (err) {
        console.error("TikTok processing failed:", err.message);
        return res.status(502).json({ success: false, error: "TikTok download or upload failed." });
    } finally {
        try {
            await fs.promises.unlink(tempFilePath);
        } catch (error) {
            if (error.code !== "ENOENT") {
                console.error("Failed to clean up TikTok temp file:", error.message);
            }
        }
    }
});

// ============================================================
// ✅ POST /api/tiktok/validate
// ============================================================
router.post("/validate", requireAuth, async (req, res) => {
    const { url } = req.body || {};
    if (!isTikTokPageUrl(url)) {
        return res.status(400).json({ valid: false, error: "Enter a valid HTTPS TikTok link." });
    }

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
router.get("/info", requireAuth, async (req, res) => {
    const { url } = req.query;
    if (!isTikTokPageUrl(url)) {
        return res.status(400).json({ success: false, error: "Enter a valid HTTPS TikTok link." });
    }

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
    if (!isTikTokPageUrl(url)) return res.status(400).send("Invalid TikTok URL.");

    try {
        const videoUrl = await tiktokDownloader.getPlayableUrl(url);
        res.set("Cache-Control", "private, no-store");
        return res.redirect(videoUrl);
    } catch (err) {
        console.error("Preview error:", err.message);
        return res.status(502).send("Failed to load TikTok video preview.");
    }
});

module.exports = router;
