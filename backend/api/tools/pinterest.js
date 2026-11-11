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
const crypto = require("crypto");
const { Transform } = require("stream");
const { requireAuth } = require("../../utils/auth");
const cheerio = require("cheerio"); // ⚠️ Ensure this is installed: npm install cheerio
const ytdlp = require("../../utils/ytdlp");
const {
    isPinterestMediaUrl,
    maxPinterestDownloadBytes,
    normalizePinterestUrl,
} = require("../../utils/pinterestUrl");

// 🗂️ Temp directory
const tempDir = path.join(__dirname, "../../temp/downloads");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

/* -------------------------------------------------------------------------- */
/* 🔍 POST /lookup — Get Image/Video Info                                     */
/* -------------------------------------------------------------------------- */
router.post("/lookup", requireAuth, async (req, res) => {
    try {
        const url = normalizePinterestUrl(req.body?.url);
        if (!url) return res.status(400).json({ success: false, error: "Invalid Pinterest URL" });

        console.log(`📌 Lookup Pinterest: ${url}`);
        let output;

        // 1. Try yt-dlp first (Best for HD Videos)
        try {
            console.log("    👉 Attempting yt-dlp for Video...");
            output = await ytdlp.lookup(url, {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            });

            // If yt-dlp returns valid data
            if (output && (output.url || (output.formats && output.formats.length > 0))) {
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
            console.log(`    ⚠️ yt-dlp failed (likely an image): ${e.message}`);
            // Fallthrough to scraper
        }

        // 2. Fallback to Cheerio Scraper (Best for Images)
        console.log("    👉 Attempting Cheerio Scraper for Image...");
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
            timeout: 15000,
            maxRedirects: 0,
            maxContentLength: 2 * 1024 * 1024,
            maxBodyLength: 2 * 1024 * 1024,
        });

        const $ = cheerio.load(response.data);

        // Detect Media
        let videoUrl = $('video source').attr('src');
        let imageUrl = $('meta[property="og:image"]').attr('content');
        const title = $('meta[property="og:title"]').attr('content') || "Pinterest Pin";

        // Upgrade Image Quality (736x -> originals)
        let finalUrl = imageUrl;
        /* 
        // ⚠️ DISABLE HD UPGRADE: Causes 403/Corruption issues for now.
        if (imageUrl && imageUrl.match(/\/\d+x\//)) {
            const hdUrl = imageUrl.replace(/\/\d+x\//, "/originals/");
            try {
                // Verify if the HD URL actually exists and is an image
                const head = await axios.head(hdUrl, { headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' } });
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
        */

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
    const url = normalizePinterestUrl(req.body?.url);
    if (!url) return res.status(400).json({ success: false, error: "Invalid Pinterest URL" });
    const safeId = `pin-${Date.now()}-${crypto.randomUUID()}`;

    try {
        const outputTemplate = path.join(tempDir, `${safeId}.%(ext)s`);
        console.log(`📥 Downloading Pinterest Pin with local yt-dlp: ${url}`);

        await ytdlp.download(url, outputTemplate, {
            format: "bestvideo+bestaudio/best",
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            noPlaylist: true,
        });

        const filename = fs.readdirSync(tempDir).find((file) =>
            file.startsWith(`${safeId}.`) && !file.endsWith(".part") && !file.endsWith(".ytdl")
        );
        if (!filename) throw new Error("No completed Pinterest media file was produced.");

        const outputPath = path.join(tempDir, filename);
        const stats = await fs.promises.stat(outputPath);
        if (stats.size > maxPinterestDownloadBytes) {
            await fs.promises.unlink(outputPath);
            return res.status(413).json({
                success: false,
                error: "Pinterest media exceeds the 50 MiB download limit.",
            });
        }

        const isVideo = /\.(?:mp4|mov|m4v|webm)$/i.test(filename);
        setTimeout(() => {
            fs.promises.unlink(outputPath).catch((err) => {
                if (err.code !== "ENOENT") console.error(`Failed to remove ${filename}:`, err);
            });
        }, 10 * 60 * 1000);

        return res.json({
            success: true,
            url: `/uploads/temp/downloads/${filename}`,
            meta: { filename, type: isVideo ? "video" : "image" },
        });

    } catch (err) {
        console.error("❌ Download Error:", err.message);
        const partialFiles = fs.readdirSync(tempDir).filter((file) => file.startsWith(`${safeId}.`));
        await Promise.all(partialFiles.map(async (file) => {
            try {
                await fs.promises.unlink(path.join(tempDir, file));
            } catch (cleanupError) {
                if (cleanupError.code !== "ENOENT") {
                    console.error(`Failed to remove partial Pinterest download ${file}:`, cleanupError);
                }
            }
        }));
        res.status(500).json({ success: false, error: "Download failed. Ensure content is Public." });
    }
});

/* -------------------------------------------------------------------------- */
/* 🌐 GET /proxy — For Frontend Preview (Hotlink Fix)                         */
/* -------------------------------------------------------------------------- */
router.get("/proxy", requireAuth, async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).send("Missing URL");
        if (!isPinterestMediaUrl(url)) return res.status(403).send("Forbidden Source");

        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            timeout: 30000,
            maxRedirects: 0,
            maxContentLength: maxPinterestDownloadBytes,
        });

        const contentType = response.headers["content-type"] || "";
        if (!/^(image|video)\//i.test(contentType)) {
            response.data.destroy();
            return res.status(415).send("Unsupported media type");
        }
        const contentLength = Number(response.headers["content-length"]);
        if (Number.isFinite(contentLength) && contentLength > maxPinterestDownloadBytes) {
            response.data.destroy();
            return res.status(413).send("Pinterest media exceeds the download size limit");
        }

        const requestedFilename = typeof req.query.filename === "string"
            ? path.basename(req.query.filename).slice(0, 120)
            : "";
        const safeFilename = requestedFilename || `pinterest-${Date.now()}`;
        const utf8Filename = encodeURIComponent(safeFilename);
        const asciiFilename = safeFilename.replace(/[^a-zA-Z0-9_\-\.]/g, "_");

        res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`);
        res.setHeader('Content-Type', contentType);

        let bytesSent = 0;
        const sizeLimit = new Transform({
            transform(chunk, encoding, callback) {
                bytesSent += chunk.length;
                if (bytesSent > maxPinterestDownloadBytes) {
                    callback(new Error("Pinterest media exceeds the download size limit"));
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
        res.status(500).send("Proxy Failed");
    }
});

module.exports = router;
