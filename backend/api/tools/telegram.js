/**
 * ============================================================
 * ✈️ /api/tools/telegram — Telegram Downloader (Public Links)
 * ============================================================
 * Uses yt-dlp to download media from public Telegram channels.
 * Example: https://t.me/channel_name/123
 */

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth");

// 🗂️ Temp directory
const tempDir = path.join(__dirname, "../../temp/telegram");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

/* -------------------------------------------------------------------------- */
/* 📥 POST /download — Download Telegram Media                                */
/* -------------------------------------------------------------------------- */
router.post("/download", requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || !url.includes("t.me/")) {
            return res.status(400).json({ success: false, error: "Invalid Telegram URL (must be t.me/...)" });
        }

        console.log(`✈️ Downloading Telegram Media: ${url}`);

        const safeId = `tg-${Date.now()}`;
        // Note: %(ext)s automatically detects the extension (mp4, jpg, etc)
        const outputTemplate = path.join(tempDir, `${safeId}.%(ext)s`);

        // Flags for yt-dlp to work with Telegram
        const flags = {
            noWarnings: true,
            noCheckCertificate: true,
            output: outputTemplate,
            maxDownloads: 1, // Focus on single file for now
        };

        // 🔄 Lazy Load & Configure Path
        const youtubedl = require("youtube-dl-exec");

        // ⚙️ VITAL FOR RENDER: Point to the custom binary path
        // Locally it uses default; In production it uses the ./bin folder
        const isProduction = process.env.NODE_ENV === 'production';
        const binaryPath = isProduction
            ? path.join(__dirname, '../../bin/yt-dlp')
            : undefined;

        console.log(`🔍 Using yt-dlp binary at: ${binaryPath || 'Global System Path'}`);

        // Execute Download
        await youtubedl(url, flags, { execPath: binaryPath });

        // Find the generated file (since we don't know the extension yet)
        const files = fs.readdirSync(tempDir);
        const foundFile = files.find(f => f.startsWith(safeId));

        if (foundFile) {
            console.log("✅ Telegram Download Complete:", foundFile);

            // Generate metadata (basic)
            const metadata = {
                title: `Telegram Media ${safeId}`,
                filename: foundFile,
                type: foundFile.endsWith(".mp4") ? "video" : "image"
            };

            res.json({
                success: true,
                url: `/uploads/temp/telegram/${foundFile}`,
                meta: metadata
            });
        } else {
            throw new Error("File not found after download. URL might be invalid or private.");
        }

    } catch (err) {
        console.error("❌ Telegram Download Error:", err.message);
        res.status(500).json({ success: false, error: "Failed to download. " + err.message });
    }
});

module.exports = router;
