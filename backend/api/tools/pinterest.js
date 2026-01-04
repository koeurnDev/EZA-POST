/**
 * ============================================================
 * 📌 /api/tools/pinterest — Pinterest Downloader (Image & Video)
 * ============================================================
 * Scrapes metadata from Pinterest URL to find the best quality media.
 */

const express = require("express");
const router = express.Router();
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth");
const https = require("https");
const cheerio = require("cheerio"); // Need to install this if missing
const youtubedl = require("youtube-dl-exec");

// 🗂️ Temp directory
const tempDir = path.join(__dirname, "../../temp/downloads");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

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
            const output = await youtubedl(url, {
                dumpSingleJson: true,
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true,
            });

            // If yt-dlp finds a video
            if (output.url || (output.formats && output.formats.length > 0)) {
                // Find best video url
                let bestVideo = output.url; // Default (often best pre-merged)

                if (output.formats) {
                    // Filter for playable formats (video + audio if possible)
                    // standard Pinterest videos usually have a direct url, but just in case
                    const validFormats = output.formats.filter(f => f.vcodec !== 'none');

                    // Prioritize formats with audio (acodec != 'none') and sort by height
                    const sorted = validFormats.sort((a, b) => {
                        const aHasAudio = a.acodec !== 'none' && a.acodec !== undefined;
                        const bHasAudio = b.acodec !== 'none' && b.acodec !== undefined;

                        if (aHasAudio && !bHasAudio) return -1; // a comes first
                        if (!aHasAudio && bHasAudio) return 1;  // b comes first
                        return (b.height || 0) - (a.height || 0); // then by resolution
                    });

                    if (sorted.length > 0) {
                        bestVideo = sorted[0].url;
                    }
                }

                console.log("    ✅ yt-dlp found video!");
                return res.json({
                    success: true,
                    media: {
                        title: output.title || "Pinterest Video",
                        type: 'video',
                        url: bestVideo,
                        sd_url: bestVideo,
                        preview: output.thumbnail,
                        original_url: url
                    }
                });
            }
        } catch (e) {
            console.log("    ⚠️ yt-dlp failed (likely an image):", e.message);
        }

        // 2. Fallback to Cheerio Scraper (Best for Images)
        console.log("    👉 Attempting Cheerio Scraper for Image...");
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });

        const $ = cheerio.load(response.data);

        let videoUrl = null;
        let imageUrl = $('meta[property="og:image"]').attr('content');
        const title = $('meta[property="og:title"]').attr('content') || "Pinterest Pin";

        // Attempt to find video in JSON-LD or standard tags
        const videoTag = $('video source').attr('src');
        if (videoTag) videoUrl = videoTag;

        // Fix Image Quality (Pinterest serves .jpg, we want originals usually)
        let hdUrl = imageUrl;
        if (imageUrl && imageUrl.match(/\/\d+x\//)) {
            hdUrl = imageUrl.replace(/\/\d+x\//, "/originals/");
        }

        return res.json({
            success: true,
            media: {
                title: title,
                type: videoUrl ? 'video' : 'image',
                url: videoUrl || hdUrl, // Use detected video or HD image
                sd_url: imageUrl,
                preview: imageUrl,
                original_url: url
            }
        });

    } catch (err) {
        console.error("❌ Pinterest Lookup Failed:", err.message);
        return res.status(500).json({ success: false, error: "Failed to fetch info. Check URL." });
    }
});

/* -------------------------------------------------------------------------- */
/* 📥 GET /download — Proxy Download (Fixes CORS/Hotlink issues)              */
/* -------------------------------------------------------------------------- */
router.get("/download", async (req, res) => {
    try {
        const { url, filename } = req.query;
        if (!url) return res.status(400).send("Missing URL");

        // Initial setup
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.pinterest.com/'
            }
        });

        // Smart Extension Detection
        let name = filename || `pinterest-${Date.now()}`;
        if (!name.match(/\.(jpg|jpeg|png|mp4|webm|gif)$/i)) {
            const contentType = response.headers['content-type'];
            let ext = '.jpg'; // default
            if (contentType) {
                if (contentType.includes('video/mp4')) ext = '.mp4';
                else if (contentType.includes('image/png')) ext = '.png';
                else if (contentType.includes('image/gif')) ext = '.gif';
                else if (contentType.includes('image/jpeg')) ext = '.jpg';
            }
            name += ext;
        }

        res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
        response.data.pipe(res);

    } catch (err) {
        console.error("❌ Proxy Download Error:", err.message);
        res.status(500).send("Download Failed");
    }
});

module.exports = router;
