/**
 * ============================================================
 * 🧵 /api/tools/threads — Threads Downloader
 * ============================================================
 * Uses yt-dlp to download media from Threads.
 */

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth");
const axios = require("axios");

// ⚙️ Helper: Get Binary Path
const getBinaryPath = () => {
    return process.env.NODE_ENV === 'production'
        ? path.join(__dirname, '../../bin/yt-dlp')
        : undefined;
};

/* -------------------------------------------------------------------------- */
/* 🔍 POST /lookup — Get Image/Video Info                                     */
/* -------------------------------------------------------------------------- */
router.post("/lookup", requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: "No URL provided" });

        // 🛠️ Auto-correct threads.com -> threads.net (Common typo)
        let cleanUrl = url.replace("threads.com", "threads.net");

        // 🧹 Strip query parameters to fix yt-dlp issues
        if (cleanUrl.includes("?")) {
            cleanUrl = cleanUrl.split("?")[0];
        }

        if (!cleanUrl.includes("threads.net")) {
            return res.status(400).json({ success: false, error: "Invalid Threads URL (must be threads.net)" });
        }

        // Ensure trailing slash for consistent parsing (optional but good practice)
        if (!cleanUrl.endsWith("/")) cleanUrl += "/";

        console.log(`🧵 Lookup Threads: ${cleanUrl}`);

        let output;

        // Strategy 1: yt-dlp via Utility Wrapper (Cleaner implementation)
        try {
            const ytdlp = require("../../utils/ytdlp");
            output = await ytdlp.lookup(cleanUrl, {
                noWarnings: true,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.04472.124 Safari/537.36',
            });
        } catch (e) {
            console.warn(`    ⚠️ yt-dlp failed: ${e.message}`);
            // Fallthrough to scraper
        }

        // Strategy 2: Cheerio Scraper (Fallback)
        if (!output) {
            console.log("    👉 Attempting Cheerio Scraper...");
            try {
                const cheerio = require("cheerio");
                const htmlRes = await axios.get(cleanUrl, {
                    headers: {
                        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Referer': 'https://www.threads.net/'
                    }
                });

                console.log(`    🔍 Scraper Status: ${htmlRes.status}, Length: ${htmlRes.data.length}`);
                if (htmlRes.request.res.responseUrl && !htmlRes.request.res.responseUrl.includes(cleanUrl)) {
                    console.warn(`    ⚠️ Redirected to: ${htmlRes.request.res.responseUrl}`);
                }

                const $ = cheerio.load(htmlRes.data);

                // Parse Metadata
                const title = $('meta[property="og:description"]').attr('content') || $('meta[property="og:title"]').attr('content') || "Threads Post";
                const image = $('meta[property="og:image"]').attr('content');
                const video = $('meta[property="og:video"]').attr('content');

                if (!image && !video) throw new Error("No media found in OpenGraph tags");

                output = {
                    id: `threads_${Date.now()}`,
                    title: title,
                    url: video || image,
                    thumbnail: image,
                    vcodec: video ? 'h264' : 'none', // Dummy indicator
                    uploader: 'Threads User'
                };

                // Manually construct 'entries' if multiple provided (Cheerio is limited here without JSON parsing)
                // For now, this fallback handles single item effectively

            } catch (err) {
                console.error("❌ Scraper Failed:", err.message);
                if (!output) throw new Error("Failed to fetch via both yt-dlp and scraper. Content might be private.");
            }
        }

        if (!output) throw new Error("No data returned.");

        // Parse Output
        const media = {
            id: output.id,
            title: output.description || output.title || "Threads Post",
            author: {
                username: output.uploader_id || "threads_user",
                fullname: output.uploader || "Threads User",
                avatar: ""
            },
            stats: {
                likes: output.like_count || 0,
                replies: output.comment_count || 0
            },
            type: 'image',
            images: [],
            videos: [],
            cover: output.thumbnail,
            original_url: url
        };

        // Handle Carousel/Multiple Entries
        if (output.entries) {
            output.entries.forEach(entry => {
                if (entry.vcodec !== 'none' && entry.url) {
                    media.videos.push({
                        url: entry.url,
                        cover: entry.thumbnail,
                        type: 'video'
                    });
                } else if (entry.url) {
                    // Filter m3u8 if possible or prefer mp4, but usually direct URL is fine
                    media.images.push(entry.url);
                }
            });
            media.type = media.videos.length > 0 ? 'video_collection' : 'image_collection';
        } else {
            // Single Media
            if (output.vcodec !== 'none' && output.url) {
                media.videos.push({
                    url: output.url,
                    cover: output.thumbnail,
                    type: 'video'
                });
                media.type = 'video';
            } else if (output.url) {
                media.images.push(output.url);
                media.type = 'image';
            }
        }

        res.json({ success: true, media });

    } catch (err) {
        console.error("❌ Threads Lookup Failed:", err.message);
        // Respond with detailed error
        res.status(500).json({ success: false, error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* 🌐 GET /proxy — Secure Proxy for Downloads                                 */
/* -------------------------------------------------------------------------- */
router.get("/proxy", async (req, res) => {
    try {
        const { url, filename } = req.query;
        if (!url) return res.status(400).send("Missing URL");

        // Simple Domain Check
        if (!url.match(/(fbcdn|cdninstagram|threads\.net)/)) {
            return res.status(403).send("Forbidden Source");
        }

        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            }
        });

        // ✅ Safe Header Encoding Logic (RFC 5987)
        const safeFilename = (filename || `threads-${Date.now()}`);
        const utf8Filename = encodeURIComponent(safeFilename);
        const asciiFilename = safeFilename.replace(/[^a-zA-Z0-9_\-\.]/g, "_");

        res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');

        response.data.pipe(res);

    } catch (err) {
        console.error("Proxy Error:", err.message);
        res.status(502).send("Proxy Failed");
    }
});

module.exports = router;
