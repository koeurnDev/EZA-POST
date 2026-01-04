/**
 * ============================================================
 * 📸 /api/tools/instagram — Instagram Downloader (Reels/Posts)
 * ============================================================
 * Uses yt-dlp to download media from Instagram.
 * Example: https://www.instagram.com/p/CODE/ or https://www.instagram.com/reels/CODE/
 */

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth");
const youtubedl = require("youtube-dl-exec");

// 🗂️ Temp directory
const tempDir = path.join(__dirname, "../../temp/instagram");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

/* -------------------------------------------------------------------------- */
/* 📥 POST /download — Download Instagram Media                               */
/* -------------------------------------------------------------------------- */
router.post("/download", requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || !url.includes("instagram.com")) {
            return res.status(400).json({ success: false, error: "Invalid Instagram URL" });
        }

        console.log(`📸 Downloading Instagram Media: ${url}`);

        const safeId = `ig-${Date.now()}`;
        const outputTemplate = path.join(tempDir, `${safeId}.%(ext)s`);

        // Flags for yt-dlp
        const flags = {
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            output: outputTemplate,
            maxDownloads: 1,
            format: "best", // Best quality
        };

        await youtubedl(url, flags);

        // Find the generated file
        const files = fs.readdirSync(tempDir);
        // Find file starting with safeId (handling different extensions like .mp4, .jpg)
        const foundFile = files.find(f => f.startsWith(safeId));

        if (foundFile) {
            console.log("✅ Instagram Download Complete:", foundFile);

            // Generate metadata
            const metadata = {
                title: `Instagram Media ${safeId}`,
                filename: foundFile,
                type: foundFile.endsWith(".mp4") ? "video" : "image"
            };

            res.json({
                success: true,
                url: `/uploads/temp/instagram/${foundFile}`,
                meta: metadata
            });
        } else {
            throw new Error("File not found after download. Account might be private.");
        }

    } catch (err) {
        console.error("❌ Instagram Download Error:", err.message);
        res.status(500).json({ success: false, error: "Failed to download. Ensure content is Public. " + err.message });
    }
});

module.exports = router;
