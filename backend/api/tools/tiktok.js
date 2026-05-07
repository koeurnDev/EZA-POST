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
const crypto = require("crypto"); // 🔐 Added for Cache Hashing
const { requireAuth } = require("../../utils/auth");
const cheerio = require("cheerio"); // ✅ Required for fallback scraper
const { createSlideshow } = require("../../services/videoGenerator");

// 🗂️ Temp directory
const tempDir = path.join(__dirname, "../../temp/videos");
const slideDir = path.join(__dirname, "../../temp/slideshows");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
if (!fs.existsSync(slideDir)) fs.mkdirSync(slideDir, { recursive: true });

// ⚙️ Helper: Get Binary Path
const getBinaryPath = () => {
    const prodPath = path.join(__dirname, '../../bin/yt-dlp');
    if (process.env.NODE_ENV === 'production' && fs.existsSync(prodPath)) {
        return prodPath;
    }
    return undefined; // Falls back to system PATH (e.g. yt-dlp installed via pip)
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

    const images = rawImages.map(img => {
        if (typeof img === 'string') return img;
        return img.display_image?.url_list?.[0] || img.url_list?.[0] || img.image_url?.url_list?.[0];
    }).filter(Boolean);

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
    // NOTE: Removed v.web_url from fallback. Downloading the HTML page as a video results in a "Black Video" / Corrupt file.
    // If no video URL exists, it should be empty so the frontend knows there is no video track.
    let noWatermark = v.hdplay || v.play || v.download_addr || "";

    return {
        id: v.video_id || v.id,
        title: v.title || "",
        cover: v.cover,
        no_watermark_url: noWatermark,
        playUrl: v.play || v.hdplay || "", // Preview URL should also be media, not web_url
        music: v.music || v.music_info?.play || "", // 🎵 NEW: Audio URL

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

        // 1️⃣ yt-dlp (Internal First)
        try {
            console.log("    👉 Attempting yt-dlp (Internal Scraper)...");
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
            console.log("    ✅ yt-dlp Success!");
        } catch (e) {
            console.warn("    ⚠️ yt-dlp failed:", e.message || "Unknown error", e.stderr || "");
        }

        // 2️⃣ TikWM Fallback
        if (!videoData) {
            try {
                console.log("    👉 Attempting TikWM API...");
                const response = await axios.post("https://www.tikwm.com/api/",
                    new URLSearchParams({ url: cleanUrl, hd: 1 }),
                    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 8000 }
                );
                if (response.data.code === 0) {
                    videoData = formatTikTokVideo(response.data.data);
                    console.log("    ✅ TikWM Success!");
                }
            } catch (e) { console.warn("    ⚠️ TikWM failed"); }
        }

        // 3️⃣ Last Resort: LoveTik API (Best for Slideshows/Photos when TikWM is down)
        // TikWM often fails 403, and yt-dlp doesn't support photos. LoveTik is our savior.
        if (!videoData) {
            try {
                console.log("    👉 Attempting LoveTik API (Slideshow/Video Fallback)...");
                const loveRes = await axios.post('https://lovetik.com/api/ajax/search',
                    new URLSearchParams({ query: cleanUrl }).toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        },
                        timeout: 10000
                    }
                );

                if (loveRes.data.status === 'ok') {
                    const d = loveRes.data;
                    const isSlideshow = d.images && d.images.length > 0;

                    console.log(`    ✅ LoveTik Success: ${isSlideshow ? 'Slideshow (' + d.images.length + ' imgs)' : 'Video'}`);

                    videoData = {
                        id: d.vid || `tk_${Date.now()}`,
                        title: d.desc || "TikTok Media",
                        cover: d.cover,
                        no_watermark_url: d.links ? d.links[0].a : "", // Video URL
                        playUrl: d.links ? d.links[0].a : "",
                        images: d.images || [], // Full Slideshow Support!
                        type: isSlideshow ? 'slideshow' : 'video',
                        author: {
                            nickname: d.author_name || "Unknown",
                            avatar: d.author_a || ""
                        },
                        stats: { plays: 0, likes: 0 }
                    };
                }
            } catch (e) {
                console.warn("    ⚠️ LoveTik failed:", e.message);
            }
        }

        if (!videoData) {
            return res.status(404).json({ success: false, error: "Media not found or unsupported URL" });
        }

        return res.json({ success: true, video: videoData });
    } catch (err) {
        console.error("Lookup Route Error:", err.message);
        return res.status(500).json({ success: false, error: "Lookup Failed" });
    }
});

/* -------------------------------------------------------------------------- */
/* 🔧 POST /compatible — Force H.264 / SD Video via Local FFmpeg              */
/* -------------------------------------------------------------------------- */
router.post("/compatible", requireAuth, async (req, res) => {
    let inputPath = null;
    let outputPath = null;
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: "URL required" });
        const cleanUrl = (url.match(/https?:\/\/[^\s]+/) || [url])[0];

        console.log(`    👉 Requesting Local FFmpeg H.264 version for: ${cleanUrl}`);
        
        // 1. Download original video temporarily
        const fileId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
        inputPath = path.join(tempDir, `input_${fileId}.mp4`);
        outputPath = path.join(tempDir, `compatible_${fileId}.mp4`);

        let videoUrlToDownload = cleanUrl;
        
        // If it's a web URL, get the direct media link via yt-dlp
        if (cleanUrl.includes('tiktok.com/@') || cleanUrl.includes('vt.tiktok.com')) {
             const youtubedl = require("youtube-dl-exec");
             try {
                const output = await youtubedl(cleanUrl, { dumpSingleJson: true, noWarnings: true }, { execPath: getBinaryPath() });
                if (output && output.url) videoUrlToDownload = output.url;
             } catch(err) {
                 console.warn("       yt-dlp failed to resolve direct link, using original:", err.message);
             }
        }

        const writer = fs.createWriteStream(inputPath);
        const response = await axios({
            url: videoUrlToDownload,
            method: 'GET',
            responseType: 'stream',
            timeout: 30000,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': 'https://www.tiktok.com/'
            }
        });

        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // 2. Process with FFmpeg
        const { execSync } = require('child_process');
        const ffmpegPath = require('ffmpeg-static');
        
        try {
            console.log("       🎬 Starting FFmpeg re-encode (H.264 / Ultrafast)...");
            const startTime = Date.now();
            
            // Use ultrafast preset to minimize CPU usage and prevent timeouts on cloud platforms
            execSync(`"${ffmpegPath}" -y -i "${inputPath}" -c:v libx264 -preset ultrafast -crf 24 -c:a aac -b:a 128k "${outputPath}"`, { stdio: 'pipe' });
            
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`       ✅ FFmpeg re-encode complete in ${duration}s.`);
        } catch (err) {
            const errorMsg = err.stderr?.toString() || err.stdout?.toString() || err.message;
            console.error("       ❌ FFmpeg failed:", errorMsg);
            throw new Error(`FFmpeg processing failed: ${errorMsg}`);
        }

        // Cleanup input
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

        // Return local stream URL
        const streamUrl = `/api/tools/tiktok/stream?id=comp_${fileId}&url=${encodeURIComponent("local_merge")}&filename=compatible.mp4`;
        
        // Cache it for /stream
        const urlHash = crypto.createHash("md5").update("local_merge").digest("hex").slice(0, 8);
        const correctCacheFilename = `tiktok-comp_${fileId}-${urlHash}.mp4`;
        const correctCachePath = path.join(tempDir, correctCacheFilename);
        
        fs.renameSync(outputPath, correctCachePath);

        res.json({ success: true, url: streamUrl });

    } catch (e) {
        console.warn("    ⚠️ /compatible endpoint failed:", e.message);
        // Cleanup if error occurs
        try {
            if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        } catch (cleanupErr) {}
        
        res.status(500).json({ success: false, error: e.message || "Processing Failed" });
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
        } catch (e) { console.warn("⚠️ TikWM Profile API unreachable (403/Down), switching to backup engine (yt-dlp)..."); }

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
/* 📥 POST /download — Unify with /stream (Redirect/JSON)                     */
/* -------------------------------------------------------------------------- */
router.post("/download", requireAuth, async (req, res) => {
    try {
        const { url, title, type, images, id } = req.body;
        if (!url && (!images || images.length === 0)) return res.status(400).json({ error: "No content" });

        // 📸 SLIDESHOW (Images) - Keep existing logic for now (it works well)
        if (type === 'slideshow' && images && images.length > 0) {
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

            // Auto-delete slideshow folder after 10 mins
            setTimeout(() => fs.rm(targetFolder, { recursive: true, force: true }, () => { }), 600000);
            return res.json({ success: true, type: 'slideshow', files: downloadedFiles });
        }

        // 🎥 VIDEO: Unify with /stream logic
        // Instead of downloading here, we return the robust stream URL
        // This ensures One Source of Truth
        const safeId = (id || `video_${Date.now()}`).replace(/[^a-z0-9]/gi, "_");
        const safeTitle = (title || "tiktok").replace(/[^a-z0-9\u0080-\uffff]/gi, "_").substring(0, 50);
        const filename = `${safeTitle}.mp4`;

        // Construct Stream URL
        const streamUrl = `/api/tools/tiktok/stream?id=${safeId}&url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;

        return res.json({
            success: true,
            type: 'video',
            file: { name: filename, url: streamUrl },
            isStream: true
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Download Failed" });
    }
});

/* -------------------------------------------------------------------------- */
/* 🎬 POST /combine — Merge Photos + Audio into Video                        */
/* -------------------------------------------------------------------------- */
router.post("/combine", requireAuth, async (req, res) => {
    try {
        const { images, audio, id, title } = req.body;
        if (!images || images.length === 0) return res.status(400).json({ error: "No images provided" });
        if (!audio) return res.status(400).json({ error: "No audio provided" });

        console.log(`🎬 [Combine] Starting merger for ${id} (${images.length} images)`);

        const safeId = (id || `tk_${Date.now()}`).replace(/[^a-z0-9]/gi, "_");
        const folderName = `combine_${safeId}_${Date.now()}`;
        const targetFolder = path.join(slideDir, folderName);
        if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });

        const localImagePaths = [];
        const localAudioPath = path.join(targetFolder, "bgm.mp3");

        // 1. Download Images
        for (let i = 0; i < images.length; i++) {
            const imgPath = path.join(targetFolder, `img_${i + 1}.jpg`);
            const writer = fs.createWriteStream(imgPath);
            const resp = await axios({ url: images[i], method: 'get', responseType: 'stream', timeout: 10000 });
            resp.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
            localImagePaths.push(imgPath);
        }

        // 2. Download Audio
        const audioWriter = fs.createWriteStream(localAudioPath);
        const audioResp = await axios({ url: audio, method: 'get', responseType: 'stream', timeout: 15000 });
        audioResp.data.pipe(audioWriter);
        await new Promise((resolve, reject) => {
            audioWriter.on('finish', resolve);
            audioWriter.on('error', reject);
        });

        // 3. Generate Video
        const outputFilename = `combined_${safeId}.mp4`;
        const outputPath = path.join(targetFolder, outputFilename);
        
        // Calculate duration: if 1 image, make it 10s. If more, 5s per slide.
        const durationPerSlide = images.length === 1 ? 10 : 5;

        await createSlideshow(localImagePaths, localAudioPath, outputPath, durationPerSlide);

        // 4. Move output to tempDir for streaming
        const finalCacheFilename = `tiktok-combined-${safeId}-${Date.now()}.mp4`;
        const finalCachePath = path.join(tempDir, finalCacheFilename);
        fs.renameSync(outputPath, finalCachePath);

        // 5. Cleanup temp folder
        setTimeout(() => fs.rm(targetFolder, { recursive: true, force: true }, () => { }), 1000);

        const safeTitle = (title || "tiktok").replace(/[^a-z0-9\u0080-\uffff]/gi, "_").substring(0, 50);
        const streamUrl = `/api/tools/tiktok/stream?id=combined_${safeId}&url=${encodeURIComponent("local")}&filename=${encodeURIComponent(safeTitle + ".mp4")}&path=${encodeURIComponent(finalCachePath)}`;
        
        // Note: The /stream endpoint needs to handle the 'path' parameter if we want to serve local files directly easily,
        // or we just use the cache naming convention.
        // Let's check /stream logic. It expects 'id' and 'url' to find/create cachePath.
        
        // I'll update /stream to support a local file bypass or just use the cache naming convention.
        // Actually, /stream uses: const cacheFilename = `tiktok-${safeId}-${urlHash}.mp4`;
        // If I name it correctly, /stream will find it.
        
        const urlHash = crypto.createHash("md5").update("local_merge").digest("hex").slice(0, 8);
        const correctCacheFilename = `tiktok-combined_${safeId}-${urlHash}.mp4`;
        const correctCachePath = path.join(tempDir, correctCacheFilename);
        
        if (fs.existsSync(finalCachePath)) {
            fs.renameSync(finalCachePath, correctCachePath);
        }

        const finalStreamUrl = `/api/tools/tiktok/stream?id=combined_${safeId}&url=${encodeURIComponent("local_merge")}&filename=${encodeURIComponent(safeTitle + ".mp4")}`;

        res.json({
            success: true,
            url: finalStreamUrl
        });

    } catch (err) {
        console.error("❌ Combine Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* 🔄 GET /stream — Smart Caching Stream & Download                           */
/* -------------------------------------------------------------------------- */
router.get("/stream", async (req, res) => {
    try {
        const { id, url, filename } = req.query;
        if (!id || id === 'undefined' || !url) return res.status(400).send("Missing parameters: id or url");

        // 🔐 Security: Domain Allowlist
        if (!url.match(/(tiktokcdn|bytevc1|tikwm|douyin|muscdn|akamaized|local_merge)/i)) {
            return res.status(403).send("Forbidden Source");
        }

        const safeId = id.replace(/[^a-z0-9]/gi, "_");

        // 🔒 Cache Poisoning Fix: Hash the URL
        const urlHash = crypto.createHash("md5").update(url).digest("hex").slice(0, 8);
        const cacheFilename = `tiktok-${safeId}-${urlHash}.mp4`;
        const cachePath = path.join(tempDir, cacheFilename);

        // 🛡️ Header Setup
        const isDownload = !!filename;
        const setHeaders = (size) => {
            const rawName = filename || `tiktok_${safeId}.mp4`;
            // RFC 5987 Compliance
            const utf8Name = encodeURIComponent(rawName);
            const asciiName = rawName.replace(/[^a-zA-Z0-9_\-\.]/g, "_"); // ✅ Safe ASCII Fallback
            console.log(`[DEBUG] Stream Header: raw="${rawName}" ascii="${asciiName}" utf8="${utf8Name}"`);

            res.setHeader('Cache-Control', 'no-store'); // 🚫 Prevent Mobile Caching
            res.setHeader('Accept-Ranges', 'bytes');

            if (isDownload) {
                // ⬇️ Force Download Mode
                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`);
            } else {
                // 🎥 Preview Mode
                res.setHeader('Content-Type', 'video/mp4');
                res.setHeader('Content-Disposition', 'inline');
            }
            if (size) res.setHeader('Content-Length', size);
        };

        // 1️⃣ CACHE HIT: Serve from disk
        if (fs.existsSync(cachePath)) {
            const stat = fs.statSync(cachePath);
            const fileSize = stat.size;

            if (fileSize < 5 * 1024) {
                try { fs.unlinkSync(cachePath); } catch (e) { } // Corrupt
            } else {
                // Range Request Support
                const range = req.headers.range;
                if (range) {
                    const parts = range.replace(/bytes=/, "").split("-");
                    const start = parseInt(parts[0], 10);
                    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                    const chunksize = (end - start) + 1;
                    const file = fs.createReadStream(cachePath, { start, end });

                    res.writeHead(206, {
                        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                        'Accept-Ranges': 'bytes',
                        'Content-Length': chunksize,
                        'Content-Type': isDownload ? 'application/octet-stream' : 'video/mp4',
                        'Cache-Control': 'no-store'
                    });
                    file.pipe(res);
                } else {
                    setHeaders(fileSize);
                    res.status(200);
                    fs.createReadStream(cachePath).pipe(res);
                }
                return;
            }
        }

        // 2️⃣ CACHE MISS: Download & Stream (PassThrough)
        console.log(`📥 [Stream] Caching new video: ${safeId} [${urlHash}]`);

        // Setup Streams
        const { PassThrough } = require('stream');
        const passThrough = new PassThrough();

        // Temp Write Stream (prevent race conditions)
        const tempFilename = `tiktok-${safeId}-${urlHash}-${Date.now()}.tmp`;
        const tempFilePath = path.join(tempDir, tempFilename);
        const fileWriter = fs.createWriteStream(tempFilePath);

        try {
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            };
            if (/tiktokcdn\.com|bytevc1\.com|tiktokv\.com|akamaized\.net/i.test(url)) {
                headers['Referer'] = 'https://www.tiktok.com/';
            }

            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'stream',
                headers: headers,
                timeout: 15000,
                validateStatus: (status) => status < 400
            });

            // Set Headers immediately
            setHeaders(response.headers['content-length']);

            // 🚿 Pipe Logic: Response -> PassThrough -> (Res + File)
            response.data.pipe(passThrough);
            passThrough.pipe(res);
            passThrough.pipe(fileWriter);

            // 🛑 Client Abort Handling (Memory Leak Fix)
            req.on("close", () => {
                if (!res.writableEnded) {
                    // Client disconnected early
                    passThrough.destroy();
                    fileWriter.destroy();
                    // Optional: Delete partial temp file if we want strict atomic only
                    // fs.unlink(tempFilePath, () => {}); 
                }
            });

            // Cleanup on finish
            fileWriter.on('finish', () => {
                setTimeout(() => {
                    if (fs.existsSync(tempFilePath)) {
                        try {
                            // Atomic Rename
                            if (!fs.existsSync(cachePath)) fs.renameSync(tempFilePath, cachePath);
                            else fs.unlinkSync(tempFilePath);
                        } catch (e) { fs.unlink(tempFilePath, () => { }); }
                    }
                }, 100);
            });

            // Cleanup on Error
            fileWriter.on('error', () => fs.unlink(tempFilePath, () => { }));

        } catch (err) {
            console.error(`❌ [Stream] Fetch Failed: ${err.message}`);
            if (!res.headersSent) res.status(502).send("Upstream Error");
            fileWriter.close();
            fs.unlink(tempFilePath, () => { });
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
        let { url, web_url, filename, type } = req.query;

        // Handle potentially double-encoded URLs
        if (url && url.includes('%')) {
            try {
                url = decodeURIComponent(url);
            } catch (e) { }
        }

        // Logic: Trust the passed URL primarily. Only use web_url if it's explicitly requested as a fallback strategy (which we don't really use here).
        // The previous logic was swapping valid video URLs with the HTML page URL (web_url) if the domain wasn't tiktokcdn, which broke previews.
        if (type === 'video/mp4' && req.query.id) {
            // Redirect to new stream logic if it looks like a video request with ID
            return res.redirect(`/api/tools/tiktok/stream?id=${req.query.id}&url=${encodeURIComponent(url)}`);
        }

        const targetUrl = url;
        // ✅ URL Validation: Allow tiktokcdn (any variation), muscdn, douyin, tikwm, facebook, fbcdn.net, akamaized, bytevc
        if (!targetUrl || !targetUrl.match(/(tiktokcdn|bytevc1|tikwm|douyin|muscdn|akamaized|facebook\.com|fbcdn\.net)/i)) {
            console.warn(`⚠️ [Proxy] Forbidden Domain: ${targetUrl}`);
            return res.status(403).send("Forbidden Domain");
        }

        const safeFilename = (filename || `download-${Date.now()}`); // Allow raw for UTF-8 processing
        const utf8Filename = encodeURIComponent(safeFilename); // Encode for filename*
        const asciiFilename = safeFilename.replace(/[^a-zA-Z0-9_\-\.]/g, "_"); // Clean for filename

        const response = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.tiktok.com/',
                'Accept': '*/*'
            }
        });

        res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        response.data.pipe(res);

    } catch (e) {
        if (!res.headersSent) res.status(502).send("Proxy Error");
    }
});

/* -------------------------------------------------------------------------- */
/* 🧹 Auto Cache Cleanup (Disk-safe)                                          */
/* -------------------------------------------------------------------------- */
setInterval(() => {
    fs.readdir(tempDir, (err, files) => {
        if (err) return;
        files.forEach(f => {
            const p = path.join(tempDir, f);
            fs.stat(p, (err, stats) => {
                if (err) return;
                // Delete files older than 30 minutes
                if (Date.now() - stats.mtimeMs > 30 * 60 * 1000) {
                    fs.unlink(p, () => { });
                }
            });
        });
    });
}, 10 * 60 * 1000); // Check every 10 mins

module.exports = router;
