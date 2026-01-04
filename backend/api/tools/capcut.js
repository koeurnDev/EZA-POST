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
const { capcut } = require("btch-downloader");

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

        // 1. Get Direct Link
        const data = await capcut(url);
        // btch-downloader usually returns { title, video, cover... } or similar.
        // Let's log to be safe in dev, but trust structure for now.
        // Assuming data.video contains the url.

        if (!data || !data.video) {
            throw new Error("Failed to parse CapCut link. Verify it is public.");
        }

        const videoUrl = data.video;
        const safeId = `cc-${Date.now()}`;
        const outputFilename = `${safeId}.mp4`;
        const outputPath = path.join(tempDir, outputFilename);

        // 2. Download Media Stream
        const writer = fs.createWriteStream(outputPath);
        const response = await axios({
            url: videoUrl,
            method: 'GET',
            responseType: 'stream'
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        console.log("✅ CapCut Download Complete:", outputPath);

        // Generate metadata
        const metadata = {
            title: data.title || `CapCut Video ${safeId}`,
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
