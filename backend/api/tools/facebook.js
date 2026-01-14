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
const axios = require("axios");
const ytdlp = require("../../utils/ytdlp");
const cheerio = require("cheerio"); // ✅ Required for scraper

// 📂 Constants & Paths
const tempDir = path.join(__dirname, "../../temp/videos");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const cookiesPath = path.join(__dirname, "../../cookies.txt");

const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/* -------------------------------------------------------------------------- */
/* 🔍 POST /lookup — Get Video or Image Info                                  */
/* -------------------------------------------------------------------------- */
// ⚙️ Helper: Check if Public (Basic)
const isPublicFacebook = (url) => {
    return /(facebook\.com|fb\.watch|fb\.me)/.test(url)
        && !url.includes('/stories/')
        && !url.includes('/groups/')
        && !url.includes('pfbid'); // User posts often have this ID but are usually private if not pages
};

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

        // 🔒 Public-Only Check
        if (!isPublicFacebook(url)) {
            return res.status(400).json({
                success: false,
                error: "Private Facebook content is not supported. Only public posts, reels, and images can be downloaded."
            });
        }

        // 1️⃣ Try Video (yt-dlp)
        try {
            const flags = {
                dumpSingleJson: true,
                noWarnings: true,
                noCheckCertificate: true,
                userAgent: DEFAULT_UA,
                ffmpegLocation: require('ffmpeg-static')
            };

            if (fs.existsSync(cookiesPath)) {
                flags.cookies = cookiesPath;
            }

            const output = await ytdlp.lookup(url, flags);

            // 🔄 Handle Playlists (Stories often return a playlist)
            if (output._type === 'playlist' || (output.entries && output.entries.length > 0)) {
                console.log("📂 Playlist/Story detected, using first entry...");
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
                        'Cookie': cookieHeader
                    },
                    timeout: 15000
                });

                const $ = cheerio.load(html.data);
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

            if (url.includes("stories") || url.includes("php")) {
                throw new Error("Could not download story. Ensure cookies.txt is updated.");
            }
            throw new Error("Could not extract video or image.");
        }

    } catch (err) {
        console.error("❌ Facebook Lookup Error:", err.message);

        let errorMessage = "Failed to fetch content. Ensure the link is Public.";
        if (err.message.includes("cookies") || err.message.includes("registered users") || err.message.includes("Private")) {
            errorMessage = "Private Facebook content is not supported. Only public posts, reels, and images can be downloaded.";
        }

        res.status(500).json({
            success: false,
            error: errorMessage
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
        const outputTemplate = path.join(tempDir, `${safeTitle}.mp4`);

        console.log(`📥 Downloading Facebook Video (${isRawUrl ? 'Raw URL' : 'yt-dlp'})...`);

        if (isRawUrl) {
            // 🌟 Direct Download Stream
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

            // ... (Auto-delete logic) ...

            // 🕒 Auto-Delete after 5 minutes
            setTimeout(() => {
                if (fs.existsSync(outputTemplate)) {
                    fs.unlink(outputTemplate, (err) => {
                        if (err) console.error(`❌ Failed to auto-delete ${safeTitle}:`, err);
                    });
                }
            }, 5 * 60 * 1000);

            return res.json({ success: true, url: `/uploads/temp/videos/${safeTitle}.mp4` });

        } else {
            // 🌟 Standard yt-dlp Download
            const outputTemplateYt = path.join(tempDir, `${safeTitle}.%(ext)s`);
            const dlFlags = {
                noWarnings: true,
                noCheckCertificate: true,
                output: outputTemplateYt,
                format: 'bestvideo+bestaudio/best',
                mergeOutputFormat: 'mp4',
                userAgent: DEFAULT_UA,
                playlistItems: '1',
                ffmpegLocation: require('ffmpeg-static')
            };

            if (fs.existsSync(cookiesPath)) {
                dlFlags.cookies = cookiesPath;
            }

            // ⚙️ Use Helper for Binary Path
            await ytdlp.download(url, outputTemplateYt, dlFlags);

            // Find file
            const files = fs.readdirSync(tempDir);
            const found = files.find(f => f.startsWith(safeTitle));

            if (found) {
                console.log("✅ Facebook Download Complete:", found);

                // 🕒 Auto-Delete after 5 minutes
                setTimeout(() => {
                    const filePath = path.join(tempDir, found);
                    if (fs.existsSync(filePath)) {
                        fs.unlink(filePath, (err) => { });
                    }
                }, 5 * 60 * 1000);

                res.json({ success: true, url: `/uploads/temp/videos/${found}` });
            } else {
                throw new Error("File not found after download");
            }
        }

    } catch (err) {
        console.error("❌ FB Download Error:", err.message);

        let errorMessage = "Download failed. Ensure content is Public.";
        let statusCode = 500;

        // 🔒 Public Only Logic: Catch private/restricted errors
        if (err.message.includes("cookies") || err.message.includes("registered users") || err.message.includes("formats")) {
            errorMessage = "This video appears to be Private or Restricted. Only Public content is supported.";
            statusCode = 400;
        } else if (err.message.includes("format")) {
            errorMessage = "Could not extract video. Ensure the link is valid and Public.";
            statusCode = 400;
        }

        res.status(statusCode).json({ success: false, error: errorMessage });
    }
});

module.exports = router;
