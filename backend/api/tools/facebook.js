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

const cookiesPath = path.join(__dirname, "../../cookies.txt");
const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

/* -------------------------------------------------------------------------- */
/* 🔍 POST /lookup — Get Video or Image Info                                  */
/* -------------------------------------------------------------------------- */
router.post("/lookup", requireAuth, async (req, res) => {
    try {
        const { url } = req.body;

        // 🌟 MODE B: Standard URL Lookup
        const isFb = /(facebook\.com|fb\.watch|fb\.me)/.test(url);
        if (!url || !isFb) {
            return res.status(400).json({ success: false, error: "Invalid Facebook URL" });
        }

        console.log(`📘 Lookup Facebook: ${url}`);

        // Check for Stories (requires cookies usually)
        const isStory = url.includes("/stories/");
        if (isStory && !fs.existsSync(cookiesPath)) {
            // We won't block it, but we log a warning. yt-dlp might fail.
            console.warn("⚠️ Facebook Story detected but no cookies.txt found. Download may fail.");
        }

        // 1️⃣ Try Video (yt-dlp)
        try {
            const flags = {
                dumpSingleJson: true,
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true,
                userAgent: DEFAULT_UA,
            };

            if (fs.existsSync(cookiesPath)) {
                flags.cookies = cookiesPath;
            }

            let output = await youtubedl(url, flags);

            // 🔄 Handle Playlists (Stories often return a playlist)
            if (output._type === 'playlist' || (output.entries && output.entries.length > 0)) {
                console.log("📂 Playlist/Story detected, using first entry...");
                // Find the first valid video entry
                const firstEntry = output.entries.find(e => e.url) || output.entries[0];
                if (firstEntry) {
                    output = firstEntry;
                } else {
                    throw new Error("Empty playlist returned");
                }
            }

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
            console.log(`⚠️ yt-dlp failed (${ytErr.message ? ytErr.message.split('\n')[0] : 'Unknown'}), trying scraper for image...`);

            // 2️⃣ Try Image Scrape (Cheerio)
            try {
                console.log("🕷️ Scraping Facebook page for metadata...");

                // Parse cookies if available
                let cookieHeader = '';
                if (fs.existsSync(cookiesPath)) {
                    const cookieContent = fs.readFileSync(cookiesPath, 'utf8');
                    cookieHeader = cookieContent.split('\n')
                        .filter(line => line.trim() && !line.startsWith('#'))
                        .map(line => {
                            const parts = line.split('\t');
                            return (parts.length >= 7) ? `${parts[5]}=${parts[6].trim()}` : null;
                        })
                        .filter(c => c)
                        .join('; ');
                }

                const html = await axios.get(url, {
                    headers: {
                        'User-Agent': DEFAULT_UA,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'none',
                        'Sec-Fetch-User': '?1',
                        'Upgrade-Insecure-Requests': '1',
                        'Cookie': cookieHeader
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

            // Specific error message for stories/private paths
            if (isStory || url.includes("php")) {
                throw new Error("Could not download story. Ensure cookies.txt is updated.");
            }
            throw new Error("Could not extract video or image.");
        }

    } catch (err) {
        console.error("❌ Facebook Lookup Error:", err.message);
        res.status(500).json({
            success: false,
            error: err.message.includes("cookies")
                ? "Login required (Cookies missing/expired)"
                : "Failed to fetch content. (Private post or unsupported format)"
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

        const isRawUrl = url.includes("fbcdn.net") || url.includes("googlevideo.com") || url.startsWith("blob:");
        const safeTitle = `fb-${Date.now()}`;
        const outputTemplate = path.join(tempDir, `${safeTitle}.mp4`); // Default to mp4

        console.log(`📥 Downloading Facebook Video (${isRawUrl ? 'Raw URL' : 'yt-dlp'})...`);

        if (isRawUrl) {
            // 🌟 Direct Download Stream (No yt-dlp needed)
            const writer = fs.createWriteStream(outputTemplate);
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
                headers: { 'User-Agent': DEFAULT_UA }
            });

            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            console.log("✅ Direct Download Complete:", safeTitle);
            return res.json({ success: true, url: `/uploads/temp/videos/${safeTitle}.mp4` });

        } else {
            // 🌟 Standard yt-dlp Download
            const outputTemplateYt = path.join(tempDir, `${safeTitle}.%(ext)s`);
            const dlFlags = {
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true,
                output: outputTemplateYt,
                format: 'bestvideo+bestaudio/best', // Attempt merge for best quality
                mergeOutputFormat: 'mp4', // ⭐️ Force MP4 container
                userAgent: DEFAULT_UA,
                playlistItems: '1' // ⭐️ Only download the first item if it's a playlist (Story)
            };

            if (fs.existsSync(cookiesPath)) {
                dlFlags.cookies = cookiesPath;
            }

            await youtubedl(url, dlFlags);

            // Find file
            const files = fs.readdirSync(tempDir);
            const found = files.find(f => f.startsWith(safeTitle));

            if (found) {
                console.log("✅ Facebook Download Complete:", found);
                res.json({ success: true, url: `/uploads/temp/videos/${found}` });
            } else {
                throw new Error("File not found after download");
            }
        }

    } catch (err) {
        console.error("❌ FB Download Error:", err.message);
        res.status(500).json({ success: false, error: err.message || "Server Error" });
    }
});

module.exports = router;
