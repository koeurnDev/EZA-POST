/**
 * ============================================================
 * 🎵 /api/tools/tiktok — TikTok Downloader (No Watermark)
 * ============================================================
 * Uses public API (tikwm.com) to resolve video data.
 */

const express = require("express");
const router = express.Router();
const axios = require("axios");
const youtubedl = require("youtube-dl-exec");
const path = require("path");
const fs = require("fs");
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
                videoData = {
                    title: response.data.data.title,
                    cover: response.data.data.cover,
                    author: response.data.data.author.nickname,
                    no_watermark_url: response.data.data.play,
                    images: response.data.data.images || [],
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
                const output = await youtubedl(url, {
                    dumpSingleJson: true,
                    noWarnings: true,
                    noCheckCertificate: true
                });

                videoData = {
                    title: output.title || "TikTok Video",
                    cover: output.thumbnail,
                    author: output.uploader,
                    no_watermark_url: output.url, // Direct stream
                    images: [], // yt-dlp slideshow support varies, assume video for now
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
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/json, text/javascript, */*; q=0.01',
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'Origin': 'https://www.tikwm.com',
                        'Referer': 'https://www.tikwm.com/'
                    },
                    timeout: 5000 // 5s timeout
                }
            );

            if (response.data.code === 0) {
                videos = response.data.data.videos.map(v => ({
                    id: v.video_id,
                    title: v.title,
                    cover: v.cover,
                    no_watermark_url: v.play,
                    images: v.images || [],
                    duration: v.duration,
                    stats: { plays: v.play_count, likes: v.digg_count, shares: v.share_count }
                }));
                authorAvatar = response.data.data.author.avatar;

                return res.json({
                    success: true,
                    profile: { username: uniqueId, avatar: authorAvatar },
                    videos
                });
            }
            console.warn("⚠️ TikWM API response code not 0. Falling back...");

        } catch (tikErr) {
            console.warn(`⚠️ TikWM failed (${tikErr.message}), falling back to yt-dlp...`);
        }

        // 2️⃣ Fallback: yt-dlp (Slower, limit to 30 videos)
        console.log("🐢 Running yt-dlp fallback (limit 30)...");
        const profileUrl = `https://www.tiktok.com/@${uniqueId}`;

        try {
            const output = await youtubedl(profileUrl, {
                dumpSingleJson: true,
                playlistEnd: 30, // Increased limit to 30
                noWarnings: true,
                noCheckCertificate: true,
                flatPlaylist: false // Need full details for urls
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
                    title: v.title || v.description || "No Title",
                    cover: v.thumbnail,
                    no_watermark_url: v.url, // Direct link
                    images: [],
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
            throw new Error("Could not fetch profile videos via API or Scraper.");
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
                    // Return local path (served via static)
                    res.json({
                        success: true,
                        message: "Downloaded successfully",
                        file: {
                            name: filename,
                            url: `/uploads/temp/videos/${filename}`, // Needs static serve setup or upload to cloudinary later
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
        const { url, filename } = req.query;
        if (!url) return res.status(400).send("URL required");

        const safeFilename = (filename || `tiktok-${Date.now()}`).replace(/[^a-z0-9\-_]/gi, '_') + '.mp4';

        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.setHeader('Content-Type', 'video/mp4');

        https.get(url, (stream) => {
            stream.pipe(res);
        }).on('error', (err) => {
            console.error("Proxy Stream Error:", err.message);
            res.status(500).end();
        });

    } catch (err) {
        console.error("Proxy Error:", err.message);
        res.status(500).send("Server Error");
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
                    const videos = response.data.data.map(v => ({
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
                        duration: v.duration || 0
                    }));
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
