/**
 * ============================================================
 * 📌 /api/tools/pinterest — Pinterest Downloader
 * ============================================================
 * 1. Lookup: Scrapes metadata (Images/Videos)
 * 2. Download: Saves file to server for automation
 */

const express = require("express");
const router = express.Router();
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth");
const cheerio = require("cheerio"); // ⚠️ Ensure this is installed: npm install cheerio

// 🗂️ Temp directory
const tempDir = path.join(__dirname, "../../temp/downloads");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// ⚙️ Helper: Get Binary Path
const getBinaryPath = () => {
    return process.env.NODE_ENV === 'production'
        ? path.join(__dirname, '../../bin/yt-dlp')
        : undefined; // Local uses default PATH
};

/* -------------------------------------------------------------------------- */
/* 🔍 POST /lookup — Get Image/Video Info                                     */
/* -------------------------------------------------------------------------- */
router.post("/lookup", requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || !url.includes("pinterest")) return res.status(400).json({ success: false, error: "Invalid Pinterest URL" });

        console.log(`📌 Lookup Pinterest: ${url}`);

        // 1. Try yt-dlp first (Best for HD Videos)
        try {
            console.log("    👉 Attempting yt-dlp for Video...");
            const youtubedl = require("youtube-dl-exec"); // 🔄 Lazy Load

            const output = await youtubedl(url, {
                dumpSingleJson: true,
                noWarnings: true,
                noCheckCertificate: true,
                ffmpegLocation: require('ffmpeg-static')
            }, { execPath: getBinaryPath() }); // ✅ FIX APPLIED

            // If yt-dlp finds a video
            if (output.url || (output.formats && output.formats.length > 0)) {
                let bestVideo = output.url;

                if (output.formats) {
                    // Filter and sort for best video with audio
                    const validFormats = output.formats.filter(f => f.vcodec !== 'none');
                    const sorted = validFormats.sort((a, b) => {
                        const aHasAudio = a.acodec !== 'none' && a.acodec !== undefined;
                        const bHasAudio = b.acodec !== 'none' && b.acodec !== undefined;
                        if (aHasAudio && !bHasAudio) return -1;
                        if (!aHasAudio && bHasAudio) return 1;
                        return (b.height || 0) - (a.height || 0);
                    });
                    if (sorted.length > 0) bestVideo = sorted[0].url;
                }

                return res.json({
                    success: true,
                    media: {
                        title: output.title || "Pinterest Video",
                        type: 'video',
                        url: bestVideo,
                        preview: output.thumbnail,
                        original_url: url
                    }
                });
            }
        } catch (e) {
            console.log("    ⚠️ yt-dlp failed (likely an image), switching to scraper...");
        }

        // 2. Fallback to Cheerio Scraper (Best for Images)
        console.log("    👉 Attempting Cheerio Scraper for Image...");
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36' }
        });

        const $ = cheerio.load(response.data);

        // Detect Media
        let videoUrl = $('video source').attr('src');
        let imageUrl = $('meta[property="og:image"]').attr('content');
        const title = $('meta[property="og:title"]').attr('content') || "Pinterest Pin";

        // Upgrade Image Quality (736x -> originals)
        let finalUrl = imageUrl;
        if (imageUrl && imageUrl.match(/\/\d+x\//)) {
            const hdUrl = imageUrl.replace(/\/\d+x\//, "/originals/");
            try {
                // Verify if the HD URL actually exists and is an image
                const head = await axios.head(hdUrl);
                if (head.status === 200 && head.headers['content-type']?.startsWith('image')) {
                    finalUrl = hdUrl;
                    console.log("    ✅ Upgraded to HD Image:", finalUrl);
                } else {
                    console.warn("    ⚠️ HD Image check failed (Status/Type), reverting to SD.");
                }
            } catch (e) {
                console.warn("    ⚠️ HD Image not found, reverting to SD:", e.message);
            }
        }

        return res.json({
            success: true,
            media: {
                title: title,
                type: videoUrl ? 'video' : 'image',
                url: videoUrl || finalUrl,
                preview: imageUrl,
                original_url: url
            }
        });

    } catch (err) {
        console.error("❌ Pinterest Lookup Failed:", err.message);
        let errorMessage = "Failed to fetch info.";
        if (err.message.includes("cookies") || err.message.includes("registered users")) {
            errorMessage = "This content is private or restricted. Only public content can be downloaded.";
        }
        return res.status(500).json({ success: false, error: errorMessage });
    }
});

/* -------------------------------------------------------------------------- */
/* 📥 POST /download — Save to Server (Standardized for EZA_POST)             */
/* -------------------------------------------------------------------------- */
router.post("/download", requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: "No URL provided" });

        const safeId = `pin-${Date.now()}`;
        // Guess extension based on URL or default to jpg
        const ext = url.includes('.mp4') ? '.mp4' : (url.includes('.png') ? '.png' : '.jpg');
        const filename = `${safeId}${ext}`;
        const outputPath = path.join(tempDir, filename);

        console.log(`📥 Downloading Pinterest Media to Server: ${filename}`);

        const writer = fs.createWriteStream(outputPath);
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.pinterest.com/'
            }
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        console.log("✅ Download Complete:", filename);

        // 🕒 Auto-delete after 10 mins
        setTimeout(() => {
            if (fs.existsSync(outputPath)) fs.unlink(outputPath, () => console.log(`🗑️ Auto-deleted ${filename}`));
        }, 600 * 1000);

        // Return the path for the bot to use
        res.json({
            success: true,
            url: `/uploads/temp/downloads/${filename}`,
            meta: { filename, type: ext === '.mp4' ? 'video' : 'image' }
        });

    } catch (err) {
        console.error("❌ Download Error:", err.message);
        res.status(500).json({ success: false, error: "Download failed. Ensure content is Public." });
    }
});

/* -------------------------------------------------------------------------- */
/* 🌐 GET /proxy — For Frontend Preview (Hotlink Fix)                         */
/* -------------------------------------------------------------------------- */
router.get("/proxy", async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).send("Missing URL");

        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.pinterest.com/'
            }
        });

        response.data.pipe(res);
    } catch (err) {
        res.status(500).send("Proxy Failed");
    }
});

module.exports = router;
