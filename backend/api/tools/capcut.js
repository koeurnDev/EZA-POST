/**
 * ============================================================
 * 🎬 /api/tools/capcut — CapCut Downloader
 * ============================================================
 * Uses btch-downloader to download media from CapCut.
 * Example: https://www.capcut.com/template-detail/...
 */

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { requireAuth } = require("../../utils/auth");
const ytdlp = require("../../utils/ytdlp");

// 🗂️ Temp directory
const tempDir = path.join(__dirname, "../../temp/capcut");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

/* -------------------------------------------------------------------------- */
/* 📥 POST /download — Download CapCut Media                                  */
/* -------------------------------------------------------------------------- */
router.post("/download", requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || !url.includes("capcut")) {
            return res.status(400).json({ success: false, error: "Invalid CapCut URL" });
        }

        console.log(`🎬 Downloading CapCut Media: ${url}`);

        // 1. Get Direct Link via yt-dlp
        const info = await ytdlp.lookup(url);

        if (!info || !info.url) {
            throw new Error("Failed to parse CapCut link. Video might be private or deleted.");
        }

        const videoUrl = info.url;
        const safeId = `cc-${Date.now()}`;
        const outputFilename = `${safeId}.mp4`;
        const outputPath = path.join(tempDir, outputFilename);

        // 2. Download Media Stream
        // We use axios to stream the file from the direct URL to our temp folder
        const writer = fs.createWriteStream(outputPath);
        const response = await axios({
            url: videoUrl,
            method: 'GET',
            responseType: 'stream',
            headers: info.http_headers // Pass headers from yt-dlp (User-Agent, etc.)
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        console.log("✅ CapCut Download Complete:", outputPath);

        // Generate metadata
        const metadata = {
            title: info.title || `CapCut Video ${safeId}`,
            filename: outputFilename,
            type: "video"
        };

        res.json({
            success: true,
            url: `/uploads/temp/capcut/${outputFilename}`,
            meta: metadata
        });

    } catch (err) {
        console.error("❌ CapCut Download Error:", err.message);
        res.status(500).json({ success: false, error: "Failed to download. " + err.message });
    }
});

module.exports = router;
