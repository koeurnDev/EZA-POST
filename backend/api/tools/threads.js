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
const { Transform } = require("stream");
const {
    isThreadsMediaUrl,
    maxThreadsMediaBytes,
    normalizeThreadsPostUrl,
} = require("../../utils/threadsUrl");

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
        const cleanUrl = normalizeThreadsPostUrl(req.body?.url);
        if (!cleanUrl) {
            return res.status(400).json({
                success: false,
                error: "Invalid Threads URL. Use an HTTPS threads.net or threads.com post link.",
            });
        }

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
                    },
                    timeout: 15000,
                    maxRedirects: 0,
                    maxContentLength: 2 * 1024 * 1024,
                    maxBodyLength: 2 * 1024 * 1024,
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
                if (entry.vcodec !== 'none' && isThreadsMediaUrl(entry.url)) {
                    media.videos.push({
                        url: entry.url,
                        cover: isThreadsMediaUrl(entry.thumbnail) ? entry.thumbnail : undefined,
                        type: 'video'
                    });
                } else if (isThreadsMediaUrl(entry.url)) {
                    // Filter m3u8 if possible or prefer mp4, but usually direct URL is fine
                    media.images.push(entry.url);
                }
            });
            media.type = media.videos.length > 0 ? 'video_collection' : 'image_collection';
        } else {
            // Single Media
            if (output.vcodec !== 'none' && isThreadsMediaUrl(output.url)) {
                media.videos.push({
                    url: output.url,
                    cover: isThreadsMediaUrl(output.thumbnail) ? output.thumbnail : undefined,
                    type: 'video'
                });
                media.type = 'video';
            } else if (isThreadsMediaUrl(output.url)) {
                media.images.push(output.url);
                media.type = 'image';
            }
        }

        if (!media.videos.length && !media.images.length) {
            return res.status(502).json({
                success: false,
                error: "No supported public media could be extracted from this Threads post.",
            });
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
router.get("/proxy", requireAuth, async (req, res) => {
    try {
        const { url, filename } = req.query;
        if (!url) return res.status(400).send("Missing URL");
        if (!isThreadsMediaUrl(url)) return res.status(403).send("Forbidden Source");

        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            timeout: 30000,
            maxRedirects: 0,
            maxContentLength: maxThreadsMediaBytes,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            }
        });

        const contentType = response.headers["content-type"] || "";
        if (!/^(image|video)\//i.test(contentType)) {
            response.data.destroy();
            return res.status(415).send("Unsupported media type");
        }
        const contentLength = Number(response.headers["content-length"]);
        if (Number.isFinite(contentLength) && contentLength > maxThreadsMediaBytes) {
            response.data.destroy();
            return res.status(413).send("Threads media exceeds the download size limit");
        }

        // ✅ Safe Header Encoding Logic (RFC 5987)
        const requestedFilename = typeof filename === "string"
            ? path.basename(filename).slice(0, 120)
            : "";
        const safeFilename = requestedFilename || `threads-${Date.now()}`;
        const utf8Filename = encodeURIComponent(safeFilename);
        const asciiFilename = safeFilename.replace(/[^a-zA-Z0-9_\-\.]/g, "_");

        res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`);
        res.setHeader('Content-Type', contentType);

        let bytesSent = 0;
        const sizeLimit = new Transform({
            transform(chunk, encoding, callback) {
                bytesSent += chunk.length;
                if (bytesSent > maxThreadsMediaBytes) {
                    callback(new Error("Threads media exceeds the download size limit"));
                    return;
                }
                callback(null, chunk);
            },
        });
        response.data.on("error", (error) => sizeLimit.destroy(error));
        sizeLimit.on("error", (error) => {
            if (!res.headersSent) res.status(413);
            res.destroy(error);
        });
        response.data.pipe(sizeLimit).pipe(res);

    } catch (err) {
        console.error("Proxy Error:", err.message);
        if (!res.headersSent) res.status(502).send("Proxy Failed");
        else res.destroy(err);
    }
});

module.exports = router;
