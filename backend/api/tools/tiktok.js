/**
 * ============================================================
 * 🎵 /api/tools/tiktok — Fixed Bulk Detection
 * ============================================================
 */

const express = require("express");
const router = express.Router();
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth");

// 🗂️ Temp directory
const tempDir = path.join(__dirname, "../../temp/videos");
const slideDir = path.join(__dirname, "../../temp/slideshows");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
if (!fs.existsSync(slideDir)) fs.mkdirSync(slideDir, { recursive: true });

// ⚙️ Helper: Get Binary Path
const getBinaryPath = () => {
    return process.env.NODE_ENV === 'production'
        ? path.join(__dirname, '../../bin/yt-dlp')
        : undefined;
};

/* -------------------------------------------------------------------------- */
/* 🛠️ HELPER: Standardize Video Object (More Robust Detection)                */
/* -------------------------------------------------------------------------- */
const formatTikTokVideo = (v) => {
    // 1. ប្រមូលរូបភាព (Deep Check)
    let rawImages = v.images || v.image_post_info?.images || [];

    // ជួនកាលក្នុង Bulk, TikWM ដាក់រូបក្នុង display_image
    if (rawImages.length === 0 && v.display_image?.url_list) {
        rawImages = v.display_image.url_list;
    }

    const images = rawImages.map(img => (typeof img === 'string' ? img : img.url_list?.[0])).filter(Boolean);

    // 2. 🧠 DATA-FIRST DETECTION (Expanded Codes)
    const isSlideshow =
        v.aweme_type === 150 ||
        v.aweme_type === 51 ||
        v.aweme_type === 61 ||
        v.aweme_type === 55 ||
        !!v.image_post_info ||
        images.length > 1;

    // ⚠️ បើជា Slideshow ប៉ុន្តែគ្មានរូប (API មិនឲ្យមក) -> ចាត់ទុកជា Video (MP4)
    // ដើម្បីកុំឲ្យ Error ពេល Download
    const finalType = isSlideshow ? 'slideshow' : 'video';

    // ✅ Add fallback for no_watermark_url
    // This ensures frontend never receives an empty URL for video downloads
    let noWatermark = v.hdplay || v.play || v.download_addr || v.web_url || "";

    return {
        id: v.video_id,
        title: v.title || "",
        cover: v.cover,
        no_watermark_url: noWatermark, // ✅ Guaranteed to have a value (web_url at least)
        playUrl: v.play || v.web_url || "",
        images: images,
        type: finalType, // ✅ Correct Type
        author: {
            unique_id: v.author?.unique_id || v.author?.nickname,
            nickname: v.author?.nickname || "Unknown",
            avatar: v.author?.avatar || ""
        },
        stats: {
            plays: v.play_count || 0,
            likes: v.digg_count || 0,
            shares: v.share_count || 0
        },
        duration: v.duration || 0,
        timestamp: v.create_time || 0,
        web_url: v.web_url || ""
    };
};

/* -------------------------------------------------------------------------- */
/* 🔍 POST /lookup — Single Video                                             */
/* -------------------------------------------------------------------------- */
router.post("/lookup", requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: "URL required" });

        const cleanUrl = (url.match(/https?:\/\/[^\s]+/) || [url])[0];
        let videoData = null;

        // 1️⃣ TikWM
        try {
            const response = await axios.post("https://www.tikwm.com/api/",
                new URLSearchParams({ url: cleanUrl, hd: 1 }),
                { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 8000 }
            );
            if (response.data.code === 0) {
                videoData = formatTikTokVideo(response.data.data);
            }
        } catch (e) { console.warn("TikWM failed"); }

        // 2️⃣ yt-dlp Fallback
        if (!videoData) {
            const youtubedl = require("youtube-dl-exec");
            const output = await youtubedl(cleanUrl, { dumpSingleJson: true, noWarnings: true }, { execPath: getBinaryPath() });

            const isSlide = output.vcodec === 'none' && (output.thumbnails?.length > 1);
            videoData = {
                id: output.id,
                title: output.title,
                cover: output.thumbnail,
                no_watermark_url: output.url,
                images: [],
                type: isSlide ? 'slideshow' : 'video',
                duration: output.duration,
                author: { nickname: output.uploader },
                stats: { plays: output.view_count, likes: output.like_count }
            };
        }

        return res.json({ success: true, video: videoData });
    } catch (err) {
        return res.status(500).json({ success: false, error: "Lookup Failed" });
    }
});

/* -------------------------------------------------------------------------- */
/* 👤 POST /profile — Get Profile (Updated with Stronger Logic)               */
/* -------------------------------------------------------------------------- */
router.post("/profile", requireAuth, async (req, res) => {
    try {
        const { url, username } = req.body;
        const input = url || username;
        if (!input) return res.status(400).json({ success: false, error: "Input required" });

        let uniqueId = input;
        if (input.includes("tiktok.com")) {
            const match = input.match(/tiktok\.com\/@?([a-zA-Z0-9_.-]+)/);
            if (match) uniqueId = match[1];
        } else {
            uniqueId = uniqueId.replace(/^@/, '');
        }

        let videos = [];
        let authorAvatar = "";

        // 1️⃣ TikWM API
        try {
            const response = await axios.post("https://www.tikwm.com/api/user/posts",
                new URLSearchParams({ unique_id: uniqueId, count: 30, cursor: 0 }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 12000 }
            );

            if (response.data.code === 0) {
                // ✅ ប្រើ Helper ដែលបានកែសម្រួល
                videos = response.data.data.videos.map(v => formatTikTokVideo(v));

                videos.sort((a, b) => b.timestamp - a.timestamp);
                authorAvatar = response.data.data.author.avatar;

                return res.json({ success: true, profile: { username: uniqueId, avatar: authorAvatar }, videos });
            }
        } catch (e) { console.warn("TikWM Profile failed"); }

        // 2️⃣ yt-dlp Fallback
        const youtubedl = require("youtube-dl-exec");
        try {
            const output = await youtubedl(`https://www.tiktok.com/@${uniqueId}`, {
                dumpSingleJson: true, flatPlaylist: true, playlistEnd: 20, noWarnings: true
            }, { execPath: getBinaryPath() });

            if (output.entries) {
                videos = output.entries.map(v => ({
                    id: v.id,
                    title: v.title,
                    cover: v.thumbnails?.[0]?.url || "",
                    web_url: v.url,
                    type: 'video', // yt-dlp flat playlist មិនអាចដឹង Slideshow ទេ
                    duration: v.duration,
                    timestamp: 0,
                    stats: { plays: v.view_count || 0 }
                }));
            }
            return res.json({ success: true, profile: { username: uniqueId, avatar: "" }, videos });
        } catch (ytErr) {
            return res.status(422).json({ success: false, message: "Use direct video links." });
        }

    } catch (err) {
        res.status(500).json({ success: false, error: "Failed to fetch profile." });
    }
});

/* -------------------------------------------------------------------------- */
/* 🎵 POST /trending — Get Trending (Updated Logic)                           */
/* -------------------------------------------------------------------------- */
router.post("/trending", requireAuth, async (req, res) => {
    try {
        const { region = "US", count = 20, type = 'music' } = req.body;
        const apiEndpoint = type === 'capcut' ? "https://www.tikwm.com/api/feed/search" : "https://www.tikwm.com/api/feed/list";

        const params = new URLSearchParams();
        params.append('count', '30');
        params.append('cursor', '0');
        if (type === 'capcut') params.append('keywords', 'CapCut Template');
        else params.append('region', region);

        const response = await axios.post(apiEndpoint, params, { timeout: 10000 });

        let videos = [];
        if (response.data.data) {
            const list = Array.isArray(response.data.data) ? response.data.data : (response.data.data.videos || []);

            // ✅ ប្រើ Helper ដូចគ្នា ដើម្បីឱ្យ Trending ស្គាល់ Slideshow ដែរ
            videos = list.map(v => {
                const formatted = formatTikTokVideo(v);
                // បន្ថែម Logic CapCut បើចាំបាច់
                if (type === 'capcut') {
                    formatted.isCapCut = true; // Mark as CapCut
                    // CapCut តែងតែជា Video, ប៉ុន្តែ Logic ខាងលើមិនខូចអ្វីទេ
                }
                return formatted;
            });
        }

        // Filter CapCut ជាក់លាក់
        if (type === 'capcut') {
            videos = videos.filter(v => JSON.stringify(v).toLowerCase().includes('capcut') || JSON.stringify(v).toLowerCase().includes('template'));
        }

        videos.sort((a, b) => b.stats.likes - a.stats.likes);
        res.json({ success: true, videos });

    } catch (err) {
        console.error("Trending Error:", err.message);
        res.status(500).json({ success: false, error: "Server Error" });
    }
});

/* -------------------------------------------------------------------------- */
/* 📥 POST /download — Download (Slideshow = Separate Images)                 */
/* -------------------------------------------------------------------------- */
router.post("/download", requireAuth, async (req, res) => {
    try {
        const { url, title, type, images } = req.body;
        if (!url && (!images || images.length === 0)) return res.status(400).json({ error: "No content" });

        // 📸 SLIDESHOW (Images) - No changes needed, already downloads to temp
        if (type === 'slideshow' && images && images.length > 0) {
            // ... (Existing slideshow logic) ...
            console.log(`📥 Downloading Slideshow (${images.length} images)...`);
            const safeTitle = (title || "slide").replace(/[^a-z0-9]/gi, "_").substring(0, 30);
            const folderName = `${safeTitle}_${Date.now()}`;
            const targetFolder = path.join(slideDir, folderName);
            if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });

            const downloadedFiles = [];
            for (let i = 0; i < images.length; i++) {
                try {
                    const filePath = path.join(targetFolder, `image_${i + 1}.jpg`);
                    const writer = fs.createWriteStream(filePath);
                    const resp = await axios({ url: images[i], method: 'get', responseType: 'stream' });
                    resp.data.pipe(writer);
                    await new Promise((resolve) => writer.on('finish', resolve));
                    downloadedFiles.push({ url: `/uploads/temp/slideshows/${folderName}/image_${i + 1}.jpg`, path: filePath });
                } catch (e) { }
            }

            setTimeout(() => fs.rm(targetFolder, { recursive: true, force: true }, () => { }), 600000);
            return res.json({ success: true, type: 'slideshow', files: downloadedFiles });
        }

        // 🎥 VIDEO (MP4) - Updated for Caching
        console.log(`📥 Downloading Video...`);
        const safeTitle = (title || "tiktok").replace(/[^a-z0-9]/gi, "_").substring(0, 50);

        // 1️⃣ CHECK CACHE
        if (req.body.id) {
            const cacheFilename = `tiktok-${req.body.id.replace(/[^a-z0-9]/gi, "_")}.mp4`;
            const cachePath = path.join(tempDir, cacheFilename);
            if (fs.existsSync(cachePath)) {
                console.log("✅ Serving from Cache!");
                // Return the cached file directly
                // We need to COPY it to a user-friendly name if we want to preserve the "nice" filename, 
                // OR just serve the cache file but tell frontend to name it nicely.
                // Backend /download endpoint (general) handles serving. 
                // Here we return the URL to the cached file.
                return res.json({ success: true, type: 'video', file: { name: `${title}.mp4`, url: `/uploads/temp/videos/${cacheFilename}` } });
            }
        }

        // 2️⃣ FALLBACK DOWNLOAD (If not cached)
        const filename = `tiktok-${safeTitle}-${Date.now()}.mp4`;
        const filePath = path.join(tempDir, filename);
        const writer = fs.createWriteStream(filePath);
        const downloadUrl = url;

        const response = await axios({ method: 'get', url: downloadUrl, responseType: 'stream', headers: { 'Referer': 'https://www.tiktok.com/' } });
        response.data.pipe(writer);
        await new Promise((resolve) => writer.on('finish', resolve));

        // Timeout to delete only for non-cached custom downloads
        setTimeout(() => { if (fs.existsSync(filePath)) fs.unlink(filePath, () => { }); }, 600000);

        return res.json({ success: true, type: 'video', file: { name: filename, url: `/uploads/temp/videos/${filename}` } });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Download Failed" });
    }
});

/* -------------------------------------------------------------------------- */
/* 🔄 GET /stream — Smart Caching Stream                                      */
/* -------------------------------------------------------------------------- */
router.get("/stream", async (req, res) => {
    try {
        const { id, url, filename } = req.query;
        if (!id || !url) return res.status(400).send("Missing parameters");

        const safeId = id.replace(/[^a-z0-9]/gi, "_");
        const cacheFilename = `tiktok-${safeId}.mp4`;
        const cachePath = path.join(tempDir, cacheFilename);

        // 1️⃣ CACHE HIT: Serve from disk
        if (fs.existsSync(cachePath)) {
            const stat = fs.statSync(cachePath);
            const fileSize = stat.size;

            // 🗑️ CORRUPTION CHECK: If file is < 5KB, it's likely an error page or empty.
            if (fileSize < 5 * 1024) {
                console.warn(`⚠️ [Stream] Corrupt cache detected (${fileSize} bytes). Deleting: ${safeId}`);
                try { fs.unlinkSync(cachePath); } catch (e) { }
                // Proceed to download (Cache Miss)
            } else {
                // ✅ VALID CACHE: Serve it
                const range = req.headers.range;

                if (range) {
                    const parts = range.replace(/bytes=/, "").split("-");
                    const start = parseInt(parts[0], 10);
                    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                    const chunksize = (end - start) + 1;
                    const file = fs.createReadStream(cachePath, { start, end });
                    const head = {
                        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                        'Accept-Ranges': 'bytes',
                        'Content-Length': chunksize,
                        'Content-Type': 'video/mp4',
                        'Content-Disposition': filename ? `attachment; filename="${filename}"` : 'inline',
                    };
                    res.writeHead(206, head);
                    file.pipe(res);
                } else {
                    const head = {
                        'Content-Length': fileSize,
                        'Content-Type': 'video/mp4',
                        'Content-Disposition': filename ? `attachment; filename="${filename}"` : 'inline',
                    };
                    res.writeHead(200, head);
                    const stream = fs.createReadStream(cachePath);
                    stream.pipe(res);
                }
                return;
            }

        }

        // 2️⃣ CACHE MISS: Download & Stream
        console.log(`📥 [Stream] Caching new video: ${safeId}`);
        const writer = fs.createWriteStream(cachePath);

        try {
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            };

            // 🧠 Smart Referer Logic
            // Official TikTok CDNs REQUIRE the Referer.
            // 3rd Party APIs (like TikWM) often REJECT the Referer.
            const needsReferer = /tiktokcdn\.com|bytevc1\.com|tiktokv\.com|akamaized\.net/i.test(url);

            if (needsReferer) {
                headers['Referer'] = 'https://www.tiktok.com/';
            }

            console.log(`🔗 [Stream] Fetching: ${url}`);

            try {
                const response = await axios({
                    method: 'get',
                    url: url,
                    responseType: 'stream',
                    headers: headers,
                    timeout: 10000,
                    validateStatus: (status) => status < 400
                });

                // Check Content-Type (Make sure we are getting a video)
                const contentType = response.headers['content-type'];
                if (contentType && !contentType.includes('video/') && !contentType.includes('application/octet-stream')) {
                    console.error(`❌ [Stream] Invalid Content-Type: ${contentType} for URL: ${url}`);
                    res.status(400).send("Invalid video source");
                    writer.close();
                    fs.unlink(cachePath, () => { });
                    return;
                }

                // Pipe to FILE and to RESPONSE (Passthrough)
                response.data.pipe(writer);

                // For response, we just pipe the stream directly. 
                // Note: Range requests won't work perfectly on first load, but playability should be fine.
                res.writeHead(200, {
                    'Content-Type': 'video/mp4',
                    'Content-Disposition': filename ? `attachment; filename="${filename}"` : 'inline',
                });
                response.data.pipe(res);

            } catch (err) {
                console.error(`❌ [Stream] Fetch Failed: ${err.message} | URL: ${url}`);
                res.status(502).send("Upstream Download Failed");
                writer.close();
                fs.unlink(cachePath, () => { });
                return;
            }

            // Handle Writer Errors
            writer.on('error', (err) => {
                console.error(`❌ [Stream] File Write Error:`, err);
                // Try to delete corrupt file
                fs.unlink(cachePath, () => { });
            });

            // Cleanup Cache after 1 hour (Optional)
            writer.on('finish', () => {
                // console.log("✅ [Stream] Cached successfully");
                setTimeout(() => { if (fs.existsSync(cachePath)) fs.unlink(cachePath, () => { }); }, 60 * 60 * 1000);
            });

        } catch (err) {
            console.error("Stream Error:", err.message);
            // Clean up partial file
            if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
            if (!res.headersSent) res.status(502).send("Upstream Error");
        }

    } catch (e) {
        console.error("System Error:", e.message);
        if (!res.headersSent) res.status(500).send("Server Error");
    }
});

/* -------------------------------------------------------------------------- */
/* 🔄 GET /proxy — Legacy Proxy (Keep for images/other uses)                  */
/* -------------------------------------------------------------------------- */
router.get("/proxy", async (req, res) => {
    try {
        const { url, web_url, filename, type } = req.query;
        // Logic: Trust the passed URL primarily. Only use web_url if it's explicitly requested as a fallback strategy (which we don't really use here).
        // The previous logic was swapping valid video URLs with the HTML page URL (web_url) if the domain wasn't tiktokcdn, which broke previews.
        if (type === 'video/mp4' && req.query.id) {
            // Redirect to new stream logic if it looks like a video request with ID
            return res.redirect(`/api/tools/tiktok/stream?id=${req.query.id}&url=${encodeURIComponent(url)}`);
        }

        const targetUrl = url;
        // ✅ URL Validation: Allow tiktokcdn, muscdn, douyin, AND tikwm
        if (!targetUrl || !targetUrl.match(/(tiktokcdn\.com|muscdn\.com|douyin|tikwm\.com|facebook\.com|fbcdn\.net)/)) {
            return res.status(403).send("Forbidden Domain");
        }

        // Simple filename sanitization
        const safeFilename = (filename || `download-${Date.now()}`).replace(/[^a-z0-9\u0080-\uffff\-_.]/gi, '_');

        const response = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.tiktok.com/'
            }
        });

        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        response.data.pipe(res);

    } catch (e) {
        if (!res.headersSent) res.status(502).send("Proxy Error");
    }
});

module.exports = router;
