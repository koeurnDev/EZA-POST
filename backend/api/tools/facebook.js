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
const crypto = require("crypto");
const { isSupportedPublicPostPath, normalizeFacebookUrl } = require("../../utils/facebookUrl");

// 📂 Constants & Paths
const tempDir = path.join(__dirname, "../../temp/videos");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const cookiesPath = path.join(__dirname, "../../cookies.txt");

const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/* -------------------------------------------------------------------------- */
/* 🔍 POST /lookup — Get Video or Image Info                                  */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* 🔍 POST /lookup — Get Video or Image Info                                  */
/* -------------------------------------------------------------------------- */
router.post("/lookup", requireAuth, async (req, res) => {
    try {
        const url = normalizeFacebookUrl(req.body?.url);

        // 🌟 MODE B: Standard URL Lookup
        if (!url) {
            return res.status(400).json({ success: false, error: "Invalid Facebook URL" });
        }

        console.log(`📘 Lookup Facebook: ${url}`);

        // 🔒 Public-Only Check
        if (!isSupportedPublicPostPath(url)) {
            return res.status(400).json({
                success: false,
                error: "Facebook Stories are not supported. Only accessible posts, reels, and images can be downloaded."
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

            let output = await ytdlp.lookup(url, flags);

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
                url: output.url || output.webpage_url || url,
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
                        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
                        'Cookie': cookieHeader
                    },
                    timeout: 15000,
                    maxRedirects: 0,
                    maxContentLength: 2 * 1024 * 1024,
                    maxBodyLength: 2 * 1024 * 1024,
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
        const url = normalizeFacebookUrl(req.body?.url);
        if (!url) return res.status(400).json({ success: false, error: "Invalid Facebook URL" });
        if (!isSupportedPublicPostPath(url)) {
            return res.status(400).json({
                success: false,
                error: "Facebook Stories are not supported. Only accessible posts, reels, and images can be downloaded."
            });
        }

        const safeTitle = `fb-${Date.now()}-${crypto.randomUUID()}`;
        const outputTemplate = path.join(tempDir, `${safeTitle}.%(ext)s`);

        console.log("📥 Downloading Facebook video with local yt-dlp...");

        const dlFlags = {
            noWarnings: true,
            noCheckCertificate: true,
            output: outputTemplate,
            format: 'bestvideo+bestaudio/best',
            mergeOutputFormat: 'mp4',
            userAgent: DEFAULT_UA,
            playlistItems: '1',
            ffmpegLocation: require('ffmpeg-static')
        };

        if (fs.existsSync(cookiesPath)) {
            dlFlags.cookies = cookiesPath;
        }

        await ytdlp.download(url, outputTemplate, dlFlags);

        const found = fs.readdirSync(tempDir).find(f =>
            f.startsWith(safeTitle) && !f.endsWith('.part') && !f.endsWith('.ytdl')
        );
        if (!found) throw new Error("File not found after download");

        console.log("✅ Facebook Download Complete:", found);
        setTimeout(() => {
            const filePath = path.join(tempDir, found);
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, (err) => {
                    if (err) console.error(`❌ Failed to auto-delete ${found}:`, err);
                });
            }
        }, 5 * 60 * 1000);

        return res.json({ success: true, url: `/uploads/temp/videos/${found}` });

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
