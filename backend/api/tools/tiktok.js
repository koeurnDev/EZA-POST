/**
 * ============================================================
 * 🎵 /api/tools/tiktok — TikTok Downloader (No Watermark)
 * ============================================================
 * Uses public API (tikwm.com) to resolve video data.
 */

const express = require("express");
const router = express.Router();
const axios = require("axios");
const ytdlp = require("../../utils/ytdlp");
const path = require("path"); const fs = require("fs");
const { requireAuth } = require("../../utils/auth");
const https = require("https");

// 🗂️ Ensure temp videos directory exists
const tempDir = path.join(__dirname, "../../temp/videos");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

/* -------------------------------------------------------------------------- */
/* 🔍 POST /lookup — Get Video Info (No Watermark URL)                        */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* 🔍 POST /lookup — Get Video Info (No Watermark URL)                        */
/* -------------------------------------------------------------------------- */
router.post("/lookup", requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: "URL is required" });

        console.log(`🔎 Looking up TikTok: ${url}`);
        let videoData = null;

        // 1️⃣ Try TikWM API (HD, No Watermark)
        try {
            console.log("⚡ Trying TikWM API...");
            const response = await axios.post("https://www.tikwm.com/api/",
                new URLSearchParams({ url: url, hd: 1 }),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    timeout: 5000
                }
            );

            if (response.data.code === 0) {
                const rawImages = response.data.data.images || response.data.data.image_post_info?.images || [];
                // 🧹 Normalize: Ensure images is always an array of simple URL strings
                const images = rawImages.map(img => {
                    if (typeof img === 'string') return img;
                    if (img.display_image?.url_list?.[0]) return img.display_image.url_list[0];
                    if (img.url_list?.[0]) return img.url_list[0];
                    return null;
                }).filter(Boolean);

                const isSlideshow = response.data.data.aweme_type === 150 || response.data.data.aweme_type === 51 || !!response.data.data.image_post_info || (images.length > 1);
                const isPhoto = !isSlideshow && (images.length === 1 || response.data.data.duration === 0);

                videoData = {
                    title: response.data.data.title,
                    cover: response.data.data.cover,
                    author: response.data.data.author.nickname,
                    no_watermark_url: response.data.data.hdplay || response.data.data.play, // Prioritize HD
                    images: images,
                    type: isSlideshow ? 'slideshow' : (isPhoto ? 'photo' : 'video'),
                    duration: response.data.data.duration,
                    id: response.data.data.id
                };
            } else {
                console.warn("⚠️ TikWM Lookup failed, code:", response.data.code);
            }
        } catch (tikErr) {
            console.warn("⚠️ TikWM Request failed:", tikErr.message);
        }

        // 2️⃣ Fallback: yt-dlp
        if (!videoData) {
            console.log("🐢 Running yt-dlp lookup fallback...");
            try {
                const output = await ytdlp.lookup(url);

                videoData = {
                    title: output.title || "TikTok Video",
                    cover: output.thumbnail,
                    author: output.uploader,
                    no_watermark_url: output.url, // Direct stream
                    images: [],
                    type: (output.vcodec === 'none' || output.duration === 0) ? 'photo' : 'video',
                    duration: output.duration,
                    id: output.id
                };
            } catch (ytErr) {
                console.error("❌ yt-dlp Lookup Failed:", ytErr.message);
                throw new Error("Could not find video. Check URL/Privacy.");
            }
        }

        if (videoData) {
            return res.json({ success: true, video: videoData });
        } else {
            return res.status(400).json({ success: false, error: "Video processing failed." });
        }

    } catch (err) {
        console.error("❌ TikTok Lookup Failed:", err.message);
        return res.status(500).json({ success: false, error: "Failed to fetch video" });
    }
});

/* -------------------------------------------------------------------------- */
/* 👤 POST /profile — Get User Profile & Latest Videos                        */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* 👤 POST /profile — Get User Profile & Latest Videos                        */
/* -------------------------------------------------------------------------- */
router.post("/profile", requireAuth, async (req, res) => {
    try {
        const { url, username } = req.body;
        const input = url || username;
        if (!input) return res.status(400).json({ success: false, error: "Username or URL required" });

        let uniqueId = input;

        // 🧹 Extract username if input is a URL
        if (input.includes("tiktok.com")) {
            const match = input.match(/tiktok\.com\/@?([a-zA-Z0-9_.-]+)/);
            if (match) uniqueId = match[1];
        } else {
            uniqueId = uniqueId.replace(/^@/, '');
        }

        console.log(`👤 Fetching TikTok Profile: ${uniqueId}`);
        let videos = [];
        let authorAvatar = "";

        // 1️⃣ Try TikWM API (Fast, No Watermark)
        try {
            console.log("⚡ Trying TikWM API...");
            const response = await axios.post("https://www.tikwm.com/api/user/posts",
                new URLSearchParams({
                    unique_id: uniqueId,
                    count: 30, // Increased to 30
                    cursor: 0
                }),
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                        'Accept': 'application/json, text/javascript, */*; q=0.01',
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'Origin': 'https://www.tikwm.com',
                        'Referer': 'https://www.tikwm.com/',
                        'Sec-Fetch-Dest': 'empty',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Site': 'same-origin'
                    },
                    timeout: 10000 // Increased to 10s for stability
                }
            );

            if (response.data.code === 0) {
                // 🔍 DIAGNOSTIC: Log raw data to a fixed path
                try {
                    const logPath = 'd:/kr_post/tiktok_debug.log';
                    const sample = response.data.data.videos.slice(0, 5).map(v => ({
                        id: v.video_id,
                        aweme_type: v.aweme_type,
                        duration: v.duration,
                        has_images: !!v.images,
                        img_count: v.images?.length || 0,
                        has_ip_info: !!v.image_post_info,
                        video_type: v.video_type,
                        is_ad: v.is_ad
                    }));
                    fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] Profile: ${uniqueId}\nSample: ${JSON.stringify(sample, null, 2)}\nFull [0]: ${JSON.stringify(response.data.data.videos[0], null, 2)}\n`);
                } catch (e) {
                    console.error("Log failed", e);
                }
                videos = response.data.data.videos.map(v => {
                    const rawImages = v.images || v.image_post_info?.images || [];
                    const images = rawImages.map(img => {
                        if (typeof img === 'string') return img;
                        if (img.display_image?.url_list?.[0]) return img.display_image.url_list[0];
                        if (img.url_list?.[0]) return img.url_list[0];
                        return null;
                    }).filter(Boolean);

                    const isSlideshow = v.aweme_type === 150 || v.aweme_type === 51 || !!v.image_post_info || (images.length > 1);
                    const isPhoto = !isSlideshow && (images.length === 1 || v.duration === 0);

                    return {
                        id: v.video_id,
                        title: v.title,
                        cover: v.cover,
                        dynamic_cover: v.dynamic_cover, // Animated Preview
                        no_watermark_url: v.hdplay || v.play, // Prioritize HD
                        web_url: `https://www.tiktok.com/@${uniqueId}/video/${v.video_id}`,
                        images: images,
                        type: isSlideshow ? 'slideshow' : (isPhoto ? 'photo' : 'video'),
                        duration: v.duration,
                        timestamp: v.create_time || 0,
                        stats: { plays: v.play_count, likes: v.digg_count, shares: v.share_count }
                    };
                });

                // Enforce Newest First (TikWM usually returns newest, but good to ensure)
                videos.sort((a, b) => b.timestamp - a.timestamp);
                authorAvatar = response.data.data.author.avatar;

                return res.json({
                    success: true,
                    profile: { username: uniqueId, avatar: authorAvatar },
                    videos
                });
            }
            console.warn("⚠️ TikWM API response code:", response.data.code, "Message:", response.data.msg || "No message");
            console.log("🔍 TikWM Full Response:", JSON.stringify(response.data).substring(0, 500));

        } catch (tikErr) {
            console.warn(`⚠️ TikWM failed (${tikErr.message}), falling back to yt-dlp...`);
        }

        // 2️⃣ Fallback: yt-dlp (Slower, limit to 30 videos)
        console.log("🐢 Running yt-dlp fallback (limit 30)...");
        const profileUrl = `https://www.tiktok.com/@${uniqueId}`;

        try {
            const output = await ytdlp.lookup(profileUrl, {
                playlistEnd: 20,
                flatPlaylist: true
            });

            videos = (output.entries || []).map(v => {
                // 🕒 Normalize Timestamp (Handle yt-dlp missing timestamp but having upload_date)
                let ts = v.timestamp;
                if (!ts && v.upload_date) {
                    const y = v.upload_date.substring(0, 4);
                    const m = v.upload_date.substring(4, 6);
                    const d = v.upload_date.substring(6, 8);
                    ts = new Date(`${y}-${m}-${d}`).getTime() / 1000;
                }

                return {
                    id: v.id,
                    title: v.title || v.description || "TikTok Video",
                    cover: v.thumbnail || v.thumbnails?.[0]?.url || "",
                    no_watermark_url: v.url || `https://www.tiktok.com/@${uniqueId}/video/${v.id}`, // Fallback to web_url
                    web_url: `https://www.tiktok.com/@${uniqueId}/video/${v.id}`,
                    images: [],
                    type: (v.duration === 0 || !v.duration) ? 'image' : 'video',
                    duration: v.duration,
                    timestamp: ts || 0,
                    upload_date: v.upload_date,
                    stats: {
                        plays: v.view_count || 0,
                        likes: v.like_count || 0,
                        shares: v.repost_count || 0
                    }
                };
            });

            // 🐛 Debug Sorting
            if (videos.length > 0) {
                console.log(`🔍 First Video Date: ${videos[0].upload_date} | TS: ${videos[0].timestamp}`);
            }

            // ⚡ Enforce Newest First
            videos.sort((a, b) => b.timestamp - a.timestamp);

            // If we got videos, return success
            if (videos.length > 0) {
                return res.json({
                    success: true,
                    profile: { username: uniqueId, avatar: authorAvatar || "" },
                    videos
                });
            } else {
                throw new Error("No videos found by yt-dlp");
            }

        } catch (ytErr) {
            console.error("❌ yt-dlp Fallback Failed:", ytErr.message);

            // 💡 Specific hint for the "secondary user ID" error
            if (ytErr.message.includes("Unable to extract secondary user ID")) {
                return res.status(422).json({
                    success: false,
                    code: 'EXTRACT_ERROR',
                    message: "TikTok updated their profile structure. Please try again with a direct Video Link instead of a Profile Link."
                });
            }

            throw new Error(ytErr.message || "Could not fetch profile videos via API or Scraper.");
        }

    } catch (err) {
        console.error("❌ TikTok Profile Error:", err.message);
        res.status(500).json({
            success: false,
            code: 'SERVER_ERROR',
            message: "Failed to fetch profile. User might be private or blocked.",
            fullError: err.message
        });
    }
});

/* -------------------------------------------------------------------------- */
/* 📥 POST /download — Download Video to Server (for Scheduling)              */
/* -------------------------------------------------------------------------- */
router.post("/download", requireAuth, async (req, res) => {
    try {
        const { url, title } = req.body; // Expecting the NO-WATERMARK URL here
        if (!url) return res.status(400).json({ success: false, error: "URL is required" });

        const safeTitle = (title || "tiktok").replace(/[^a-z0-9]/gi, "_").substring(0, 50);
        const filename = `tiktok-${safeTitle}-${Date.now()}.mp4`;
        const filePath = path.join(tempDir, filename);

        console.log(`📥 Downloading TikTok to: ${filename}`);

        const file = fs.createWriteStream(filePath);

        // Stream download
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                return res.status(400).json({ success: false, error: "Failed to download stream." });
            }

            response.pipe(file);

            file.on("finish", () => {
                file.close(() => {
                    console.log(`✅ Download complete: ${filename}`);

                    // 🕒 Auto-Delete after 5 minutes
                    setTimeout(() => {
                        if (fs.existsSync(filePath)) {
                            fs.unlink(filePath, (err) => {
                                if (err) console.error(`❌ Failed to auto-delete ${filename}:`, err);
                                else console.log(`🗑️ Auto-deleted ${filename}`);
                            });
                        }
                    }, 5 * 60 * 1000);

                    // Return local path (served via static)
                    res.json({
                        success: true,
                        message: "Downloaded successfully",
                        file: {
                            name: filename,
                            url: `/uploads/temp/videos/${filename}`,
                            path: filePath, // Absolute path for internal use (Cloudinary upload)
                            originalName: title || "tiktok-video.mp4"
                        }
                    });
                });
            });
        }).on("error", (err) => {
            fs.unlink(filePath, () => { }); // Delete partial
            console.error("❌ Download Stream Error:", err.message);
            res.status(500).json({ success: false, error: "Download failed" });
        });

    } catch (err) {
        console.error("❌ Download Handler Error:", err.message);
        res.status(500).json({ success: false, error: "Server Error" });
    }
});

/* -------------------------------------------------------------------------- */
/* 🔄 GET /proxy — Proxy Stream for Direct Download (Bypass CORS)             */
/* -------------------------------------------------------------------------- */
router.get("/proxy", async (req, res) => {
    try {
        const { url, web_url, filename, type } = req.query;
        const contentType = type || 'video/mp4';

        // 🎯 FIX: Use web_url (original page) for videos if available, fallback to url (CDN link)
        // We check contentType instead of 'type' because 'type' might be undefined
        const targetUrl = (contentType.includes('video') && web_url) ? web_url : url;

        if (!targetUrl) return res.status(400).send("URL required");

        // Ensure filename matches extension if possible (simple heuristic)
        let safeFilename = (filename || `download-${Date.now()}`).replace(/[^a-z0-9\-_.]/gi, '_');

        // Add extension if missing and we know the type (basic fallback)
        if (!safeFilename.includes('.')) {
            if (contentType.includes('image')) safeFilename += '.jpg';
            else safeFilename += '.mp4';
        }

        // Set headers for download
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.setHeader('Content-Type', contentType);
        // The original Content-Type header setting is removed here, as it will be dynamically set by the proxy response.
        // res.setHeader('Content-Type', contentType);

        console.log(`📥 Proxying: ${safeFilename} -> ${targetUrl.substring(0, 50)}...`);

        try {
            // 🎬 Case A: It's a Video — Use yt-dlp for powerful bypass
            if (contentType.includes('video')) {
                console.log(`🎬 Streaming video via yt-dlp using: ${targetUrl.includes('tiktok.com') ? 'Official Extractor' : 'Direct Link'}`);

                // Set headers first
                res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
                res.setHeader('Content-Type', 'video/mp4');

                // Use the new util stream (returns the child process)
                const ytProcess = ytdlp.stream(targetUrl, res);

                // Cleanup on client disconnect
                req.on('close', () => ytProcess.kill());
                return;
            }

            // 📸 Case B: Media (Image/Audio) — Use refined Axios
            const isAudio = contentType.includes('audio') || contentType.includes('mpeg');
            const httpsAgent = new https.Agent({ rejectUnauthorized: false });
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'stream',
                timeout: 30000,
                httpsAgent: httpsAgent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    'Accept': isAudio ? 'audio/*,*/*;q=0.8' : 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'identity',
                    'Referer': 'https://www.tiktok.com/',
                    'Origin': 'https://www.tiktok.com',
                    'Sec-Fetch-Dest': isAudio ? 'audio' : 'image',
                    'Sec-Fetch-Mode': 'no-cors',
                    'Sec-Fetch-Site': 'cross-site'
                }
            });

            const upstreamType = response.headers['content-type'] || contentType;
            res.setHeader('Content-Type', upstreamType);

            // 🧠 Smart Extension: Match filename to actual content type
            let finalFilename = safeFilename;
            if (upstreamType.includes('webp') && !finalFilename.endsWith('.webp')) {
                finalFilename = finalFilename.replace(/\.[^.]+$/, '') + '.webp';
            } else if (upstreamType.includes('avif') && !finalFilename.endsWith('.avif')) {
                finalFilename = finalFilename.replace(/\.[^.]+$/, '') + '.avif';
            } else if ((upstreamType.includes('mpeg') || upstreamType.includes('mp3')) && !finalFilename.endsWith('.mp3')) {
                finalFilename = finalFilename.replace(/\.[^.]+$/, '') + '.mp3';
            } else if (upstreamType.includes('jpeg') && !finalFilename.endsWith('.jpg') && !finalFilename.endsWith('.jpeg')) {
                finalFilename = finalFilename.replace(/\.[^.]+$/, '') + '.jpg';
            }

            res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);

            response.data.pipe(res);

        } catch (err) {
            console.error("❌ Proxy Handler Error:", err.message);
            if (err.response) {
                console.error("🔍 Upstream Details:", {
                    status: err.response.status,
                    statusText: err.response.statusText,
                    headers: err.response.headers
                });
            }
            if (!res.headersSent) {
                const status = err.response?.status || 502;
                res.status(status).send(`Failed to fetch media: ${err.message}`);
            }
        }
    } catch (err) {
        console.error("❌ Proxy General Error:", err.message);
        if (!res.headersSent) res.status(500).send("Server Error");
    }
});

/* -------------------------------------------------------------------------- */
/* 📦 POST /zip-images — Download Multiple Images as ZIP                      */
/* -------------------------------------------------------------------------- */
router.post("/zip-images", async (req, res) => {
    const archiver = require("archiver");
    try {
        const { images, filename } = req.body;
        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ error: "No images provided" });
        }

        const safeFilename = (filename || `tiktok-images-${Date.now()}`).replace(/[^a-z0-9\-_]/gi, '_') + '.zip';

        console.log(`📦 Zipping ${images.length} images to ${safeFilename}`);

        // Set Headers
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => {
            console.error("Archiver Error:", err);
            if (!res.headersSent) res.status(500).send("Zip Error");
        });

        archive.pipe(res);

        // Process each image
        for (let i = 0; i < images.length; i++) {
            try {
                const imgUrl = images[i];
                const imgName = `${filename || 'image'}-${i + 1}.jpg`;

                const response = await axios({
                    method: 'get',
                    url: imgUrl,
                    responseType: 'stream',
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });

                archive.append(response.data, { name: imgName });

            } catch (imgErr) {
                console.warn(`⚠️ Failed to zip image ${i}:`, imgErr.message);
                // Continue to next image instead of failing entirely
            }
        }

        await archive.finalize();

    } catch (err) {
        console.error("Zip Endpoint Error:", err.message);
        if (!res.headersSent) res.status(500).json({ error: "Server Error" });
    }
});

/* -------------------------------------------------------------------------- */
/* 🎵 POST /trending — Get Trending Sounds (via Viral Videos)                 */
/* -------------------------------------------------------------------------- */
router.post("/trending", requireAuth, async (req, res) => {
    try {
        const { region = "US", count = 20, type = 'music' } = req.body;
        console.log(`🔥 Fetching TikTok Trends for Region: ${region} (${type})`);

        // Aggressive fetch for CapCut: specific regions are sparse, so we need a BIG pool.
        const targetCount = type === 'capcut' ? 300 : count;

        // For CapCut, we need to paginate manually because the API caps 'count' per request
        let accumulatedVideos = [];
        let cursor = 0;
        let pagedAttempts = 0;
        const maxPages = type === 'capcut' ? 10 : 1; // 10 pages for CapCut, 1 for others

        // DECISION: If type is 'capcut', we ignore 'trending' and use 'search' to guarantee results.
        // Regions like TH/KH often have no templates in the top 300 trending, but have thousands in search.
        const apiEndpoint = type === 'capcut' ? "https://www.tikwm.com/api/feed/search" : "https://www.tikwm.com/api/feed/list";

        while (accumulatedVideos.length < targetCount && pagedAttempts < maxPages) {
            pagedAttempts++;
            let response;
            let retry = 0;

            // Build Params
            const params = new URLSearchParams();
            params.append('count', '50');
            params.append('cursor', cursor);

            if (type === 'capcut') {
                params.append('keywords', 'CapCut Template'); // Search for templates specifically
            } else {
                params.append('region', region); // Valid for feed/list
            }

            // Retry loop for current page
            while (retry < 5) {
                try {
                    console.log(`📡 ${type === 'capcut' ? 'Searching' : 'Fetching'} Page ${pagedAttempts} (Cursor: ${cursor})...`);
                    response = await axios.post(apiEndpoint,
                        params,
                        {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                            },
                            timeout: 15000
                        }
                    );

                    if (response.data.code === -1) {
                        console.warn(`⏳ Rate Limit. Waiting...`);
                        await new Promise(r => setTimeout(r, 2000));
                        retry++;
                        continue;
                    }
                    break; // Success
                } catch (e) {
                    retry++;
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            // Unify response structure (Search returns {data: {videos: [...]}}, Feed returns {data: [...]})
            let newItems = [];
            if (response && response.data && response.data.data) {
                if (Array.isArray(response.data.data)) {
                    newItems = response.data.data; // Feed format
                } else if (response.data.data.videos && Array.isArray(response.data.data.videos)) {
                    newItems = response.data.data.videos; // Search format
                }
            }

            if (newItems.length > 0) {
                accumulatedVideos = [...accumulatedVideos, ...newItems];
                cursor = response.data.cursor || (response.data.data ? response.data.data.cursor : 0); // Update cursor

                if (!response.data.hasMore && !cursor) break; // No more data
                if (cursor === 0 && accumulatedVideos.length > 0) break;

                // Small delay to be nice to API
                if (type === 'capcut') await new Promise(r => setTimeout(r, 500));
            } else {
                break; // Failed to get data
            }
        }

        // Mock the response object for the existing logic
        response = { data: { code: 0, data: accumulatedVideos } };

        if (response && response.data.code === 0 && response.data.data) {
            const type = req.body.type || 'music'; // 'music' or 'video'

            try {
                if (type === 'video') {
                    if (!Array.isArray(response.data.data)) throw new Error("Data is not an array");
                    // Return Raw Videos
                    const videos = response.data.data.map(v => {
                        const rawImages = v.images || v.image_post_info?.images || [];
                        const images = rawImages.map(img => {
                            if (typeof img === 'string') return img;
                            if (img.display_image?.url_list?.[0]) return img.display_image.url_list[0];
                            if (img.url_list?.[0]) return img.url_list[0];
                            return null;
                        }).filter(Boolean);

                        const isSlideshow = v.aweme_type === 150 || v.aweme_type === 51 || !!v.image_post_info || (images.length > 1);
                        const isPhoto = !isSlideshow && (images.length === 1 || v.duration === 0);

                        return {
                            id: v.video_id,
                            title: v.title || "",
                            cover: v.cover,
                            playUrl: v.play,
                            images: images,
                            type: isSlideshow ? 'slideshow' : (isPhoto ? 'photo' : 'video'),
                            author: {
                                nickname: v.author?.nickname || "Unknown",
                                avatar: v.author?.avatar || ""
                            },
                            web_url: `https://www.tiktok.com/@${v.author?.unique_id || v.author?.nickname}/video/${v.video_id}`,
                            stats: {
                                plays: v.play_count || 0,
                                likes: v.digg_count || 0,
                                shares: v.share_count || 0
                            },
                            duration: v.duration || 0
                        };
                    });
                    // Sort by Likes (Viral)
                    videos.sort((a, b) => b.stats.likes - a.stats.likes);
                    return res.json({ success: true, videos });
                }

                if (type === 'capcut') {
                    if (!Array.isArray(response.data.data)) throw new Error("Data is not an array");

                    const rawData = response.data.data;
                    console.log(`🔍 Filtering CapCut from ${rawData.length} items...`);

                    // Return CapCut Templates (Hybrid Filter)
                    // Search API often returns null anchors, so we MUST check title/metadata too.
                    const videos = rawData
                        .filter(v => {
                            const str = JSON.stringify(v).toLowerCase();

                            // Check for Anchors (Best Signal)
                            if (v.anchors && JSON.stringify(v.anchors).toLowerCase().includes("template")) {
                                return true;
                            }

                            // Fallback: Check Title/Metadata for "CapCut" or "Template" (For Search Results)
                            // We are already searching for "CapCut Template", so simple keyword match is safe enough.
                            return str.includes("capcut") || str.includes("template");
                        })
                        .map(v => ({
                            id: v.video_id,
                            title: v.title || "",
                            cover: v.cover,
                            playUrl: v.play,
                            author: {
                                nickname: v.author?.nickname || "Unknown",
                                avatar: v.author?.avatar || ""
                            },
                            stats: {
                                plays: v.play_count || 0,
                                likes: v.digg_count || 0,
                                shares: v.share_count || 0
                            },
                            duration: v.duration || 0,
                            isCapCut: true
                        }));

                    console.log(`✅ Found ${videos.length} CapCut templates.`);

                    // DEBUG: If 0 found, log samples to see what we missed
                    if (videos.length === 0) {
                        const sample = rawData.slice(0, 3).map(v => ({ title: v.title, anchors: v.anchors }));
                        fs.appendFileSync(path.join(__dirname, '../../debug_errors.log'), `[${new Date().toISOString()}] No CapCut Found. Samples: ${JSON.stringify(sample)}\n`);
                    }

                    // Sort by Likes
                    videos.sort((a, b) => b.stats.likes - a.stats.likes);
                    return res.json({ success: true, videos });
                }
            } catch (mapErr) {
                fs.appendFileSync(path.join(__dirname, '../../debug_errors.log'), `[${new Date().toISOString()}] Map Error (${type}): ${mapErr.message}\n`);
                console.error("❌ Mapping Error:", mapErr);
                return res.status(500).json({ success: false, error: "Failed to process video data" });
            }

            // Extract Unique Music (Default Behavior)
            try {
                const musicMap = new Map();

                if (Array.isArray(response.data.data)) {
                    response.data.data.forEach(video => {
                        try {
                            if (video.music_info && video.music_info.play) {
                                const musicId = video.music_info.id;
                                if (!musicMap.has(musicId)) {
                                    musicMap.set(musicId, {
                                        id: musicId,
                                        title: video.music_info.title || "Unknown Track",
                                        author: video.music_info.author || "Unknown Artist",
                                        cover: video.music_info.cover || video.cover || "",
                                        playUrl: video.music_info.play,
                                        duration: video.music_info.duration,
                                        originalVideo: {
                                            cover: video.cover || "",
                                            plays: video.play_count || 0,
                                            likes: video.digg_count || 0
                                        }
                                    });
                                }
                            }
                        } catch (innerErr) {
                            console.warn("⚠️ Error processing video item:", innerErr.message, video.video_id);
                        }
                    });
                }

                const trendingMusic = Array.from(musicMap.values());
                // Sort by original video likes (proxy for viral status)
                trendingMusic.sort((a, b) => b.originalVideo.likes - a.originalVideo.likes);

                return res.json({ success: true, music: trendingMusic });

            } catch (processErr) {
                fs.appendFileSync(path.join(__dirname, '../../debug_errors.log'), `[${new Date().toISOString()}] Music Process Error: ${processErr.message}\n`);
                console.error("❌ Music Processing Error:", processErr);
                return res.status(500).json({ success: false, error: "Failed to process music data" });
            }
        } else {
            const apiMsg = response?.data ? JSON.stringify(response.data) : "No Response";
            fs.appendFileSync(path.join(__dirname, '../../debug_errors.log'), `[${new Date().toISOString()}] API Error: ${apiMsg}\n`);
            console.warn("⚠️ TikWM Feed Response:", response?.data);
            return res.status(500).json({ success: false, error: "Rate Limit or API Error. Please wait 5s.", details: response?.data });
        }

    } catch (err) {
        fs.appendFileSync(path.join(__dirname, '../../debug_errors.log'), `[${new Date().toISOString()}] Server Error: ${err.message}\nStack: ${err.stack}\n`);
        console.error("❌ Trending Sounds Error:", err.message);
        res.status(500).json({ success: false, error: "Server Error fetching trends" });
    }
});

module.exports = router;
