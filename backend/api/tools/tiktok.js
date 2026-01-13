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

    return {
        id: v.video_id,
        title: v.title || "",
        cover: v.cover,
        no_watermark_url: v.hdplay || v.play,
        playUrl: v.play,
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
        timestamp: v.create_time || 0
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

        // 📸 SLIDESHOW (Images)
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

            setTimeout(() => fs.rm(targetFolder, { recursive: true, force: true }, () => { }), 600000);
            return res.json({ success: true, type: 'slideshow', files: downloadedFiles });
        }

        // 🎥 VIDEO (MP4) - Fallback for Slideshows detected as video or normal video
        console.log(`📥 Downloading Video...`);
        const safeTitle = (title || "tiktok").replace(/[^a-z0-9]/gi, "_").substring(0, 50);
        const filename = `tiktok-${safeTitle}-${Date.now()}.mp4`;
        const filePath = path.join(tempDir, filename);
        const writer = fs.createWriteStream(filePath);

        // Use no_watermark_url if available, else standard url
        const downloadUrl = url;

        const response = await axios({ method: 'get', url: downloadUrl, responseType: 'stream', headers: { 'Referer': 'https://www.tiktok.com/' } });
        response.data.pipe(writer);
        await new Promise((resolve) => writer.on('finish', resolve));
        setTimeout(() => { if (fs.existsSync(filePath)) fs.unlink(filePath, () => { }); }, 600000);

        return res.json({ success: true, type: 'video', file: { name: filename, url: `/uploads/temp/videos/${filename}` } });

    } catch (err) {
        res.status(500).json({ success: false, error: "Download Failed" });
    }
});

/* -------------------------------------------------------------------------- */
/* 🔄 GET /proxy — Proxy Stream                                               */
/* -------------------------------------------------------------------------- */
router.get("/proxy", async (req, res) => {
    try {
        const { url, web_url, filename, type } = req.query;
        // Logic: Use web_url (original) for videos if available to avoid 403 on some CDN links
        const targetUrl = (web_url && !url.includes("tiktokcdn.com")) ? web_url : url;

        if (!targetUrl || !targetUrl.match(/(tiktokcdn\.com|muscdn\.com|douyin)/)) return res.status(403).send("Forbidden");

        // Simple filename sanitization
        const safeFilename = (filename || `download-${Date.now()}`).replace(/[^a-z0-9\-_.]/gi, '_');

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
        // console.error("Proxy Error:", e.message);
        if (!res.headersSent) res.status(502).send("Proxy Error");
    }
});

module.exports = router;
