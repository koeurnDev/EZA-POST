/**
 * ============================================================
 * 📘 /api/tools/facebook — Facebook Downloader (Video & Reels)
 * ============================================================
 * Uses yt-dlp to download public Facebook posts/reels.
 */

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth");
const youtubedl = require("youtube-dl-exec");
const axios = require("axios");
const cheerio = require("cheerio");

// 🗂️ Temp directory
const tempDir = path.join(__dirname, "../../temp/videos");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

/* -------------------------------------------------------------------------- */
/* 🔍 POST /lookup — Get Video or Image Info                                  */
/* -------------------------------------------------------------------------- */
router.post("/lookup", requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || (!url.includes("facebook.com") && !url.includes("fb.watch"))) {
            return res.status(400).json({ success: false, error: "Invalid Facebook URL" });
        }

        console.log(`📘 Lookup Facebook: ${url}`);

        // 1️⃣ Try Video (yt-dlp)
        try {
            const output = await youtubedl(url, {
                dumpSingleJson: true,
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true,
            });

            const metadata = {
                title: output.title || "Facebook Video",
                thumbnail: output.thumbnail,
                duration: output.duration,
                author: output.uploader,
                url: output.url,
                type: 'video', // Explicit type
                is_video: true
            };

            return res.json({ success: true, video: metadata });

        } catch (ytErr) {
            console.log("⚠️ yt-dlp failed, trying scraper for image...");

            // 2️⃣ Try Image Scrape (Cheerio)
            try {
                console.log("🕷️ Scraping Facebook page for metadata...");
                const html = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Referer': 'https://www.facebook.com/',
                        'Upgrade-Insecure-Requests': '1'
                    },
                    timeout: 15000
                });

                const $ = cheerio.load(html.data);

                // Try multiple selectors
                const ogImage = $('meta[property="og:image"]').attr('content') || $('link[rel="image_src"]').attr('href');
                const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text();
                const ogDesc = $('meta[property="og:description"]').attr('content');

                console.log(`📄 Scraper Found - Title: "${ogTitle}", Image: ${!!ogImage}`);

                if (ogImage) {
                    return res.json({
                        success: true,
                        video: {
                            title: ogTitle || "Facebook Image",
                            thumbnail: ogImage,
                            author: ogDesc || "Facebook User",
                            url: ogImage,
                            type: 'image',
                            is_video: false
                        }
                    });
                }
            } catch (scrapeErr) {
                console.error("⚠️ Scraper failed:", scrapeErr.message);
            }

            throw new Error("Could not extract video or image.");
        }

    } catch (err) {
        console.error("❌ Facebook Lookup Error:", err.message);
        res.status(500).json({
            success: false,
            error: "Failed to fetch content. (Private post or unsupported format)"
        });
    }
});

/* -------------------------------------------------------------------------- */
/* 📥 POST /download — Download to Server                                     */
/* -------------------------------------------------------------------------- */
router.post("/download", requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: "No URL provided" });

        const safeTitle = `fb-${Date.now()}`;
        const outputTemplate = path.join(tempDir, `${safeTitle}.%(ext)s`);

        console.log(`📥 Downloading Facebook Video...`);

        await youtubedl(url, {
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            output: outputTemplate,
            format: 'bestvideo+bestaudio/best', // Attempt merge for best quality
            mergeOutputFormat: 'mp4', // ⭐️ Force MP4 container
        });

        // Find file
        const files = fs.readdirSync(tempDir);
        const found = files.find(f => f.startsWith(safeTitle));

        if (found) {
            console.log("✅ Facebook Download Complete:", found);
            res.json({ success: true, url: `/uploads/temp/videos/${found}` });
        } else {
            throw new Error("File not found after download");
        }

    } catch (err) {
        console.error("❌ FB Download Error:", err.message);
        res.status(500).json({ success: false, error: err.message || "Server Error" });
    }
});

module.exports = router;
