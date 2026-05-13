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
const { PassThrough } = require("stream");
const { requireAuth } = require("../../utils/auth");
const cheerio = require("cheerio"); // ✅ Required for fallback scraper
const { createSlideshow } = require("../../services/videoGenerator");
const { execSync, exec } = require("child_process");

// 🗂️ Temp directory
const tempDir = path.join(__dirname, "../../temp/videos");
const slideDir = path.join(__dirname, "../../temp/slideshows");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
if (!fs.existsSync(slideDir)) fs.mkdirSync(slideDir, { recursive: true });

// ⚙️ Helper: Get Binary Path
const getBinaryPath = () => {
    let finalPath = 'yt-dlp';
    try {
        const possiblePath = path.join(__dirname, '../../node_modules/youtube-dl-exec/bin/yt-dlp');
        const winPath = possiblePath + '.exe';
        
        if (fs.existsSync(winPath)) {
            finalPath = winPath;
        } else if (fs.existsSync(possiblePath)) {
            finalPath = possiblePath;
        } else {
            // Check in different possible locations for node_modules
            const altPath = path.join(process.cwd(), 'node_modules/youtube-dl-exec/bin/yt-dlp.exe');
            if (fs.existsSync(altPath)) finalPath = altPath;
        }
    } catch (e) {}
    
    if (finalPath === 'yt-dlp') {
        const prodPath = path.join(__dirname, '../../bin/yt-dlp');
        if (fs.existsSync(prodPath)) finalPath = prodPath;
        else if (fs.existsSync(prodPath + '.exe')) finalPath = prodPath + '.exe';
    }

    console.log(`       🔍 Using yt-dlp binary at: ${finalPath}`);
    return finalPath;
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
        return img.display_image?.url_list?.[0] || img.url_list?.[0] || img.image_url?.url_list?.[0] || img.imageURL?.urlList?.[0];
    }).filter(Boolean);

    const musicUrl =
        v.music?.playUrl ||
        v.music?.play ||
        v.music?.url ||
        v.music_info?.playUrl ||
        v.music_info?.play ||
        v.music_info?.music?.playUrl ||
        v.music_info?.music?.play ||
        v.music_info?.music?.url ||
        "";

    // 2. 🧠 DATA-FIRST DETECTION (Expanded Codes)
    const isSlideshow =
        v.aweme_type === 150 ||
        v.aweme_type === 51 ||
        v.aweme_type === 61 ||
        v.aweme_type === 55 ||
        !!v.image_post_info ||
        !!v.imagePost ||
        images.length > 0;

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
        music: musicUrl,

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

const createSlideshowPreview = async ({ images, musicUrl, id, title }) => {
    if (!images || images.length === 0) return null;
    const safeId = (id || `slideshow_${Date.now()}`).replace(/[^a-z0-9]/gi, "_");
    const previewKey = `local_slideshow_${crypto.createHash("md5").update(images.join("|") + "|" + (musicUrl || "")).digest("hex").slice(0, 8)}`;
    const urlHash = crypto.createHash("md5").update(previewKey).digest("hex").slice(0, 8);
    const cacheFilename = `tiktok-${safeId}-${urlHash}.mp4`;
    const cachePath = path.join(tempDir, cacheFilename);
    const publicPreviewUrl = `/uploads/temp/videos/${cacheFilename}`;

    if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 100 * 1024) {
        return publicPreviewUrl;
    }

    const folderName = `preview_${safeId}_${Date.now()}`;
    const targetFolder = path.join(slideDir, folderName);
    if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });

    try {
        const localImages = [];
        const downloadHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.tiktok.com/',
            'Accept': '*/*'
        };

        for (let i = 0; i < images.length; i++) {
            const imageUrl = images[i];
            const imagePath = path.join(targetFolder, `img_${i + 1}.jpg`);
            const writer = fs.createWriteStream(imagePath);
            const resp = await axios({ url: imageUrl, method: 'get', responseType: 'stream', timeout: 20000, headers: downloadHeaders });
            resp.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
            localImages.push(imagePath);
        }

        let audioPath = null;
        if (musicUrl) {
            try {
                audioPath = path.join(targetFolder, 'bgm.mp3');
                const audioWriter = fs.createWriteStream(audioPath);
                const audioResp = await axios({
                    url: musicUrl,
                    method: 'get',
                    responseType: 'stream',
                    timeout: 20000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://www.tiktok.com/',
                        'Accept': '*/*'
                    }
                });
                audioResp.data.pipe(audioWriter);
                await new Promise((resolve, reject) => {
                    audioWriter.on('finish', resolve);
                    audioWriter.on('error', reject);
                });
            } catch (audioErr) {
                console.warn(`⚠️ Audio download failed for slideshow preview: ${audioErr.message}. Generating silent slideshow instead.`);
                audioPath = null;
            }
        }

        const durationPerSlide = images.length === 1 ? 10 : 5;
        await createSlideshow(localImages, audioPath, cachePath, durationPerSlide);

        return publicPreviewUrl;
    } catch (err) {
        console.warn(`⚠️ Slideshow preview generation failed: ${err.message}`);
        return null;
    } finally {
        setTimeout(() => fs.rm(targetFolder, { recursive: true, force: true }, () => { }), 10 * 60 * 1000);
    }
};

/* -------------------------------------------------------------------------- */
/* 🔍 POST /lookup — Single Video                                             */
/* -------------------------------------------------------------------------- */
router.post("/lookup", requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: "URL required" });

        const youtubedl = require("youtube-dl-exec");
        let cleanUrl = (url.match(/https?:\/\/[^\s]+/) || [url])[0];
        
        // 🔄 Handle Short URLs (vt.tiktok.com) - Resolve redirects manually
        if (cleanUrl.includes("vt.tiktok.com") || cleanUrl.includes("vm.tiktok.com")) {
            try {
                const headRes = await axios.head(cleanUrl, { 
                    maxRedirects: 5,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                cleanUrl = headRes.request.res.responseUrl || cleanUrl;
            } catch (e) {
                console.warn("    ⚠️ Redirect resolution failed, continuing with original URL");
            }
        }

        let videoData = null;
        const videoIdMatch = cleanUrl.match(/\/video\/(\d+)/) || cleanUrl.match(/\/v\/(\d+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;

        // 1️⃣ yt-dlp (Internal Scraper)
        try {
            console.log("    👉 Attempting yt-dlp (Local Engine)...");
            const proxy = process.env.TIKTOK_PROXY;
            const mobileUA = "com.zhiliaoapp.musically/2022605040 (Linux; U; Android 13; en_US; Pixel 7; Build/TQ3A.230605.012; Cronet/58.0.2991.0)";
            
            const args = { 
                dumpSingleJson: true, 
                noWarnings: true,
                noCheckCertificates: true,
                userAgent: mobileUA,
                addHeader: ['Referer:https://www.tiktok.com/']
            };
            if (proxy) args.proxy = proxy;

            const output = await youtubedl(cleanUrl, args, { execPath: getBinaryPath() });

            const isSlide = output.vcodec === 'none' && (output.thumbnails?.length > 1);
            const isH265 = output.vcodec?.includes('hvc1') || output.vcodec?.includes('hev1') || output.vcodec?.includes('hevc');

            videoData = {
                id: output.id,
                title: output.title,
                cover: output.thumbnail,
                no_watermark_url: output.url,
                playUrl: output.url,
                images: isSlide ? output.thumbnails.map(t => t.url) : [],
                type: isSlide ? 'slideshow' : 'video',
                duration: output.duration,
                isH265: isH265, // 🛡️ Flag for frontend auto-fix
                author: { 
                    nickname: output.uploader || output.uploader_id || "TikTok User",
                    unique_id: output.uploader_id,
                    avatar: "" 
                },
                stats: { 
                    plays: output.view_count || 0, 
                    likes: output.like_count || 0,
                    shares: output.repost_count || 0
                },
                web_url: output.webpage_url || cleanUrl
            };
            console.log("    ✅ Local Engine Success!");
        } catch (e) {
            const errorMsg = e.stderr?.toString() || e.message;
            console.warn("    ⚠️ yt-dlp failed:", errorMsg.slice(0, 50));
            const logPath = path.join(__dirname, "../../temp/yt-dlp-error.log");
            fs.appendFileSync(logPath, `\n\n[LOOKUP] URL: ${cleanUrl}\nERROR: ${errorMsg}\nTIME: ${new Date().toISOString()}`);
            
            console.warn("    👉 Attempting Stealth Scraper (Local HTML Parser)...");
            
            // 2️⃣ Stealth Scraper (GitHub 2026 Method: Node Share + RENDER_DATA)
            try {
                console.log("    👉 Attempting Stealth Scraper (GitHub 2026 Method)...");
                const videoId = cleanUrl.match(/\/video\/(\d+)/)?.[1];
                
                // Try Node Share API first (Often less protected)
                if (videoId) {
                    try {
                        const nodeUrl = `https://www.tiktok.com/node/share/video/${videoId}`;
                        const nodeRes = await axios.get(nodeUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Referer': 'https://www.tiktok.com/'
                            },
                            timeout: 5000
                        });
                        if (nodeRes.data?.itemInfo?.itemStruct) {
                            const item = nodeRes.data.itemInfo.itemStruct;
                            videoData = {
                                id: item.id,
                                title: item.desc,
                                cover: item.video?.cover,
                                no_watermark_url: item.video?.playAddr,
                                playUrl: item.video?.playAddr,
                                type: 'video',
                                isH265: item.video?.codecType === 'h265',
                                author: { nickname: item.author?.nickname, unique_id: item.author?.uniqueId },
                                stats: { plays: item.stats?.playCount, likes: item.stats?.diggCount },
                                web_url: cleanUrl
                            };
                            console.log("    ✅ Node Share Success!");
                            return res.json({ success: true, video: videoData });
                        }
                    } catch (e) { console.warn("    ⚠️ Node Share failed, trying HTML parse..."); }
                }

                // Fallback to HTML RENDER_DATA parsing
                const response = await axios.get(cleanUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                        'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-ch-ua-platform': '"Windows"',
                        'Referer': 'https://www.google.com/'
                    },
                    timeout: 10000
                });

                const $ = cheerio.load(response.data);
                const scriptData = $('#SIGI_STATE').html() || $('#__UNIVERSAL_DATA_FOR_REHYDRATION__').html() || $('script[id="sigi-data"]').html();
                
                if (scriptData) {
                    const json = JSON.parse(scriptData);
                    
                    // 🔍 Try multiple JSON paths (TikTok changes these constantly)
                    const item = json.ItemModule ? Object.values(json.ItemModule)[0] : 
                                 (json.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct || 
                                  json.__DEFAULT_SCOPE__?.["webapp.video-detail-v2"]?.itemInfo?.itemStruct ||
                                  json.webappItem?.[videoId]);
                    
                    if (item) {
                        // 🛠️ FIX: Author extraction (Ensure strings, not objects)
                        const authorObj = typeof item.author === 'object' ? item.author : { nickname: item.author, uniqueId: item.author };
                        
                        const musicUrl = item.music?.playUrl || item.music?.play || item.music?.url || item.music_info?.playUrl || item.music_info?.play || item.music_info?.music?.playUrl || item.music_info?.music?.play || item.music_info?.music?.url || "";
                        videoData = {
                            id: item.id || videoId,
                            title: item.desc || item.title || "",
                            cover: item.video?.cover || item.imagePost?.cover?.url_list?.[0] || item.imagePost?.cover?.urlList?.[0],
                            no_watermark_url: item.video?.playAddr || item.video?.downloadAddr || "",
                            playUrl: item.video?.playAddr || "",
                            music: musicUrl,
                            images: item.imagePost?.images?.map(img => img.imageURL?.urlList?.[0] || img.image_url?.url_list?.[0]) || [],
                            type: (item.imagePost || item.image_post_info) ? 'slideshow' : 'video',
                            author: {
                                nickname: String(authorObj.nickname || authorObj.uniqueId || "TikTok User"),
                                unique_id: String(authorObj.uniqueId || authorObj.nickname || ""),
                                avatar: item.authorIcon || authorObj.avatarThumb || ""
                            },
                            stats: {
                                plays: item.stats?.playCount || 0,
                                likes: item.stats?.diggCount || 0
                            },
                            web_url: cleanUrl,
                            originalUrl: cleanUrl
                        };
                        console.log("    ✅ Stealth Scraper Success!");
                    }
                }
            } catch (stealthErr) {
                console.error("    ❌ Stealth Scraper also failed:", stealthErr.message);
            }
        }

        // 3️⃣ Embed Scraper (Final Local Fallback)
        if (!videoData && videoId) {
            try {
                console.log(`    👉 Attempting Embed Scraper (Local) for ID: ${videoId}...`);
                const embedUrl = `https://www.tiktok.com/embed/v2/${videoId}`;
                const response = await axios.get(embedUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://www.tiktok.com/'
                    }
                });
                
                const $ = cheerio.load(response.data);
                const scriptData = $('#__UNIVERSAL_DATA_FOR_REHYDRATION__').html() || $('#SIGI_STATE').html();
                
                if (scriptData) {
                    const json = JSON.parse(scriptData);
                    const item = json.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct || 
                                 json.ItemModule?.[videoId] || 
                                 json.webappItem?.[videoId];
                    
                    if (item) {
                        const musicUrl = item.music?.playUrl || item.music?.play || item.music?.url || item.music_info?.playUrl || item.music_info?.play || item.music_info?.music?.playUrl || item.music_info?.music?.play || item.music_info?.music?.url || "";
                        const isH265 = item.video?.codecType === 'h265' || item.video?.definition === '720p' && !item.video?.playAddr?.includes('h264');

                        videoData = {
                            id: item.id || videoId,
                            title: item.desc || "TikTok Video",
                            cover: item.video?.cover || item.imagePost?.cover?.url_list?.[0] || "",
                            no_watermark_url: item.video?.playAddr || item.video?.downloadAddr || "",
                            playUrl: item.video?.playAddr || "",
                            music: musicUrl,
                            images: item.imagePost?.images?.map(img => img.imageURL?.urlList?.[0]) || [],
                            type: item.imagePost ? 'slideshow' : 'video',
                            isH265: isH265, // 🛡️ Flag for frontend auto-fix
                            author: {
                                nickname: String(item.author?.nickname || item.author || "TikTok User"),
                                unique_id: String(item.author?.uniqueId || item.author || ""),
                                avatar: item.author?.avatarThumb || ""
                            },
                            stats: {
                                plays: item.stats?.playCount || 0,
                                likes: item.stats?.diggCount || 0
                            },
                            web_url: cleanUrl,
                            originalUrl: cleanUrl
                        };
                        console.log("    ✅ Embed Scraper Success!");
                    }
                }
            } catch (embedErr) {
                console.error("    ❌ Embed Scraper also failed:", embedErr.message);
            }
        }

        // 4️⃣ TikWM API Fallback (Stage 4)
        if (!videoData) {
            try {
                console.log("    👉 Attempting TikWM API Fallback (Lookup)...");
                const tikwmRes = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`);
                const v = tikwmRes.data?.data;
                if (v) {
                    videoData = formatTikTokVideo(v);
                    console.log("    ✅ TikWM API Success!");
                }
            } catch (tikwmErr) {
                console.error("    ❌ TikWM API also failed:", tikwmErr.message);
            }
        }

        if (!videoData) {
            return res.status(422).json({ 
                success: false, 
                error: "Local engines blocked. Please try again later or provide the direct media link if you have it." 
            });
        }

        if (videoData.type === 'slideshow' && videoData.images?.length > 0) {
            const previewUrl = await createSlideshowPreview({
                images: videoData.images,
                musicUrl: videoData.music,
                id: videoData.id,
                title: videoData.title
            });
            if (previewUrl) {
                videoData.previewUrl = previewUrl;
            }
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
        
        // 🛠️ SMART RESOLUTION: If it's already a direct CDN link, use it. Otherwise, resolve.
        const isDirectLink = cleanUrl.match(/(tiktokcdn|bytevc1|muscdn|akamaized|ibyteimg|tiktok\.com\/video\/tos|v19-webapp)/i);
        
        if (!isDirectLink) {
            console.log("       🔍 Resolving direct media link...");
            
            // Try local yt-dlp
            const youtubedl = require("youtube-dl-exec");
            try {
                const output = await youtubedl(cleanUrl, { 
                    dumpSingleJson: true, 
                    noWarnings: true,
                    addHeader: ['Referer:https://www.tiktok.com/', 'User-Agent:Mozilla/5.0']
                }, { execPath: getBinaryPath() });
                if (output && output.url) videoUrlToDownload = output.url;
            } catch(err) {
                console.error("       ❌ Local Engine failed to resolve link:", err.message);
                throw new Error("Local scraper failed. TikTok might be blocking the request.");
            }
        }
        // 📥 Improved Download Strategy
        const downloadUrl = url || videoUrlToDownload;
        const videoId = downloadUrl.match(/\/video\/(\d+)/)?.[1];
        
        console.log(`       📥 Downloading video: ${downloadUrl} (ID: ${videoId})`);
        
        const ytDlpPath = getBinaryPath() || 'yt-dlp';
        const proxy = process.env.TIKTOK_PROXY;
        const proxyArg = proxy ? `--proxy "${proxy}"` : "";
        const mobileUA = "com.zhiliaoapp.musically/2022605040 (Linux; U; Android 13; en_US; Pixel 7; Build/TQ3A.230605.012; Cronet/58.0.2991.0)";
        const ffmpegPath = require('ffmpeg-static');

        let downloadSuccess = false;
        let transcodeDone = false;

        // 🚀 ⚡ STAGE 0: Turbo Transcode (Stream direct from URL to FFmpeg)
        // This is the fastest method because it skips downloading to disk first.
        try {
            console.log("       ⚡ Stage 0: Attempting Turbo Transcode (Direct Stream)...");
            const startTime = Date.now();
            // We use -t 60 to prevent infinite loops and limit processing to 60s
            // -headers passes necessary TikTok auth headers
            const turboCmd = `"${ffmpegPath}" -y -headers "User-Agent: ${mobileUA}\r\nReferer: https://www.tiktok.com/\r\n" -i "${downloadUrl}" -t 90 -c:v libx264 -preset ultrafast -crf 28 -c:a copy -threads 0 "${outputPath}"`;
            
            execSync(turboCmd, { stdio: 'pipe', timeout: 45000 }); // 45s timeout for transcode
            
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 100 * 1024) {
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`       ✅ Turbo Transcode success in ${duration}s!`);
                downloadSuccess = true;
                transcodeDone = true;
            }
        } catch (turboErr) {
            console.warn("       ⚠️ Turbo Transcode failed or timed out. Falling back to Stage 1...");
        }

        // 🚀 Stage 1: Try yt-dlp Direct (Fallback)
        if (!downloadSuccess) {
            try {
                console.log("       👉 Stage 1: Attempting yt-dlp Direct...");
                const cmd = `"${ytDlpPath}" -y ${proxyArg} -o "${inputPath}" "${downloadUrl}" --no-playlist --no-warnings --user-agent "${mobileUA}" --no-check-certificates --add-header "Referer:https://www.tiktok.com/"`;
                execSync(cmd, { stdio: 'pipe' });
                if (fs.existsSync(inputPath) && fs.statSync(inputPath).size > 100 * 1024) {
                    downloadSuccess = true;
                }
            } catch (e1) {
                console.warn("       ⚠️ Stage 1 Failed, trying Stage 2 (Embed Link extraction)...");
            }
        }

        // 🚀 Stage 2: Embed Fallback
        if (!downloadSuccess && videoId) {
            try {
                console.log("       👉 Stage 2: Fetching via Embed API...");
                const embedUrl = `https://www.tiktok.com/embed/v2/${videoId}`;
                const res = await axios.get(embedUrl, { headers: { 'User-Agent': mobileUA } });
                const $ = cheerio.load(res.data);
                const scriptData = $('#SIGI_STATE').html() || $('#__UNIVERSAL_DATA_FOR_REHYDRATION__').html() || $('script[id="sigi-data"]').html();
                
                let playAddr = "";
                if (scriptData) {
                    try {
                        const json = JSON.parse(scriptData);
                        playAddr = json.webappItem?.[videoId]?.video?.playAddr || 
                                   json.ItemModule?.[videoId]?.video?.playAddr;
                    } catch (e) {}
                }

                if (playAddr) {
                    console.log("       ✅ Embed Link Found, downloading...");
                    const cmd = `"${ytDlpPath}" -y ${proxyArg} -o "${inputPath}" "${playAddr}" --no-playlist --no-warnings --user-agent "${mobileUA}" --no-check-certificates --add-header "Referer:https://www.tiktok.com/"`;
                    execSync(cmd, { stdio: 'pipe' });
                    if (fs.existsSync(inputPath)) downloadSuccess = true;
                }
            } catch (e2) {
                console.error("       ❌ Stage 2 Failed:", e2.message);
            }
        }

        // 🚀 Stage 3: TikWM API Fallback (Final Absolute Fallback)
        if (!downloadSuccess) {
            try {
                console.log("       👉 Stage 3: Attempting TikWM API Fallback...");
                const tikwmRes = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(downloadUrl)}`);
                if (tikwmRes.data?.data?.play) {
                    const playUrl = tikwmRes.data.data.play;
                    console.log("       ✅ TikWM Link Found, downloading...");
                    const cmd = `"${ytDlpPath}" -y ${proxyArg} -o "${inputPath}" "${playUrl}" --no-playlist --no-warnings --user-agent "${mobileUA}" --no-check-certificates`;
                    execSync(cmd, { stdio: 'pipe' });
                    if (fs.existsSync(inputPath)) downloadSuccess = true;
                }
            } catch (e3) {
                console.error("       ❌ Stage 3 Failed:", e3.message);
            }
        }

        if (!downloadSuccess) {
            throw new Error("All local and API download methods failed. TikTok is heavily blocking this content.");
        }

        console.log("       ✅ Download complete.");

        // 2. Codec Detection & Optimized Processing
        let skipTranscode = transcodeDone; 

        if (!skipTranscode) {
            try {
                console.log("       🔍 Checking codec for optimization skip...");
                // Run a quick probe using ffmpeg (since ffprobe might not be in path)
                // Note: ffmpeg -i always returns non-zero if no output is specified, so we catch the error to get the output
                let probe = "";
                try {
                    execSync(`"${ffmpegPath}" -i "${inputPath}"`, { stdio: 'pipe' });
                } catch (e) {
                    probe = e.stderr?.toString() || e.stdout?.toString() || "";
                }
                
                if (probe.includes("Video: h264") || probe.includes("Video: avc1")) {
                    console.log("       ⚡ Video is already H.264! Skipping transcode for maximum speed.");
                    skipTranscode = true;
                }
            } catch (e) {
                console.log("       ⚠️ Codec probe failed, falling back to full transcode.");
            }
        }

        try {
            if (skipTranscode) {
                fs.renameSync(inputPath, outputPath);
            } else {
                console.log("       🎬 Starting FFmpeg re-encode (H.264 / Ultrafast)...");
                const startTime = Date.now();
                
                // Optimized FFmpeg command: ultrafast, low quality penalty for speed, copy audio to save time
                execSync(`"${ffmpegPath}" -y -i "${inputPath}" -c:v libx264 -preset ultrafast -crf 28 -c:a copy -threads 0 "${outputPath}"`, { stdio: 'pipe' });
                
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`       ✅ FFmpeg re-encode complete in ${duration}s.`);
            }
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

        // yt-dlp Local Profile Scraper
        const youtubedl = require("youtube-dl-exec");
        try {
            const output = await youtubedl(`https://www.tiktok.com/@${uniqueId}`, {
                dumpSingleJson: true, 
                flatPlaylist: true, 
                playlistEnd: 20, 
                noWarnings: true,
                addHeader: ['Referer:https://www.tiktok.com/', 'User-Agent:Mozilla/5.0']
            }, { execPath: getBinaryPath() });

            if (output.entries) {
                videos = output.entries.map(v => ({
                    id: v.id,
                    title: v.title,
                    cover: v.thumbnails?.[0]?.url || "",
                    web_url: v.url,
                    type: 'video', 
                    duration: v.duration,
                    timestamp: 0,
                    stats: { plays: v.view_count || 0 }
                }));
            }
            return res.json({ success: true, profile: { username: uniqueId, avatar: "" }, videos });
        } catch (ytErr) {
            console.error("Local Profile Scraper Error:", ytErr.message);
            return res.status(422).json({ success: false, message: "Profile lookup failed locally. Please use direct video links." });
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
        console.log(`🔍 Fetching TikTok Trends for region: ${region} (Count: ${count})`);

        // Use TikWM Feed API to get real trending content
        // This restores functionality to Viral Finder and TikTok Trends pages
        const tikwmRes = await axios.get(`https://www.tikwm.com/api/feed/list?region=${region}&count=${count}`, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        if (tikwmRes.data && tikwmRes.data.data) {
            const formattedVideos = tikwmRes.data.data.map(v => formatTikTokVideo(v));
            console.log(`   ✅ Successfully fetched ${formattedVideos.length} trending items.`);
            return res.json({ 
                success: true, 
                videos: formattedVideos 
            });
        }

        res.json({ 
            success: true, 
            videos: [], 
            message: "No trending videos found for this region." 
        });
    } catch (err) {
        console.error("❌ Trending Route Error:", err.message);
        res.status(500).json({ success: false, error: "Failed to fetch trending feed. Please try again later." });
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
        const mobileUA = "com.zhiliaoapp.musically/2022605040 (Linux; U; Android 13; en_US; Pixel 7; Build/TQ3A.230605.012; Cronet/58.0.2991.0)";
        const commonHeaders = {
            'User-Agent': mobileUA,
            'Referer': 'https://www.tiktok.com/'
        };

        for (let i = 0; i < images.length; i++) {
            try {
                console.log(`       📸 Downloading image ${i + 1}/${images.length}...`);
                const imgPath = path.join(targetFolder, `img_${i + 1}.jpg`);
                const writer = fs.createWriteStream(imgPath);
                const resp = await axios({ 
                    url: images[i], 
                    method: 'get', 
                    responseType: 'stream', 
                    timeout: 15000,
                    headers: commonHeaders
                });
                resp.data.pipe(writer);
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
                localImagePaths.push(imgPath);
            } catch (imgErr) {
                console.warn(`       ⚠️ Failed to download image ${i + 1}, skipping...`);
            }
        }

        if (localImagePaths.length === 0) throw new Error("Failed to download any images for slideshow.");

        // 2. Download Audio
        console.log(`       🎵 Downloading audio...`);
        const audioWriter = fs.createWriteStream(localAudioPath);
        const audioResp = await axios({ 
            url: audio, 
            method: 'get', 
            responseType: 'stream', 
            timeout: 20000,
            headers: commonHeaders
        });
        audioResp.data.pipe(audioWriter);
        await new Promise((resolve, reject) => {
            audioWriter.on('finish', resolve);
            audioWriter.on('error', reject);
        });

        // 3. Generate Video
        const outputFilename = `combined_${safeId}.mp4`;
        const outputPath = path.join(targetFolder, outputFilename);
        const durationPerSlide = images.length === 1 ? 10 : 5;

        try {
            await createSlideshow(localImagePaths, localAudioPath, outputPath, durationPerSlide);
            // ⏳ Small delay to ensure FFmpeg releases file handles (Crucial for Windows EPERM)
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (genErr) {
            console.error("       ❌ Slideshow FFmpeg Error:", genErr.message);
            throw new Error(`FFmpeg Failed: ${genErr.message}`);
        }

        // 4. Move output to tempDir for streaming
        const urlHash = crypto.createHash("md5").update("local_merge").digest("hex").slice(0, 8);
        const finalCacheFilename = `tiktok-combined_${safeId}-${urlHash}.mp4`;
        const finalCachePath = path.join(tempDir, finalCacheFilename);
        
        if (fs.existsSync(outputPath)) {
            try {
                // Try rename first (fastest)
                fs.renameSync(outputPath, finalCachePath);
            } catch (moveErr) {
                console.warn("       ⚠️ Rename failed, trying copy-and-delete...");
                fs.copyFileSync(outputPath, finalCachePath);
                fs.unlinkSync(outputPath);
            }
        } else {
            throw new Error("FFmpeg output file missing after generation.");
        }

        // 5. Cleanup temp folder
        setTimeout(() => fs.rm(targetFolder, { recursive: true, force: true }, () => { }), 1000);

        const safeTitle = (title || "tiktok").replace(/[^a-z0-9\u0080-\uffff]/gi, "_").substring(0, 50);
        const finalStreamUrl = `/api/tools/tiktok/stream?id=combined_${safeId}&url=${encodeURIComponent("local_merge")}&filename=${encodeURIComponent(safeTitle + ".mp4")}`;

        res.json({
            success: true,
            url: finalStreamUrl,
            streamUrl: finalStreamUrl,
            path: finalCachePath      
        });

    } catch (err) {
        console.error("🎬 [Combine] Error:", err.message);
        res.status(500).json({ 
            success: false, 
            error: err.message || "Failed to generate HD Slideshow" 
        });
    }
});

/* -------------------------------------------------------------------------- */
/* 🔄 GET /stream — Smart Caching Stream & Download                           */
/* -------------------------------------------------------------------------- */
router.get("/stream", async (req, res) => {
    try {
        const { id, url, filename } = req.query;
        if (!id || id === 'undefined' || !url) return res.status(400).send("Missing parameters: id or url");

        // 🔐 Security: Domain Allowlist (Updated to allow local absolute paths from transcoding)
        const isLocalPath = path.isAbsolute(url) && fs.existsSync(url);
        if (!isLocalPath && !url.match(/(tiktokcdn|tiktokv|tiktok|bytevc|tikwm|douyin|muscdn|akamaized|v19-webapp|local_|local_merge)/i)) {
            return res.status(403).send("Forbidden Source: " + url);
        }

        const safeId = id.replace(/[^a-z0-9]/gi, "_");

        // 🔒 Cache Poisoning Fix: Hash the URL
        const urlHash = crypto.createHash("md5").update(url).digest("hex").slice(0, 8);
        const cacheFilename = `tiktok-${safeId}-${urlHash}.mp4`;
        const cachePath = path.join(tempDir, cacheFilename);

        // 🛡️ Header Setup
        const isDownload = !!filename;
        const rawName = filename || `tiktok_${safeId}.mp4`;
        const utf8Name = encodeURIComponent(rawName);
        const asciiName = rawName.replace(/[^a-zA-Z0-9_\-\.]/g, "_");

        const getCommonHeaders = (size) => {
            const headers = {
                'Cache-Control': 'no-store',
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Range',
                'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
            };

            if (isDownload) {
                headers['Content-Type'] = 'application/octet-stream';
                headers['Content-Disposition'] = `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;
            } else {
                headers['Content-Type'] = 'video/mp4';
                headers['Content-Disposition'] = 'inline';
            }

            if (size) headers['Content-Length'] = size;
            return headers;
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
                        ...getCommonHeaders(),
                        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                        'Content-Length': chunksize,
                    });
                    file.pipe(res);
                } else {
                    res.writeHead(200, getCommonHeaders(fileSize));
                    fs.createReadStream(cachePath).pipe(res);
                }
                return;
            }
        }

        
        // 2️⃣ CACHE MISS: Download & Stream (Try direct media first for speed)
        const mobileUA = "com.zhiliaoapp.musically/2022605040 (Linux; U; Android 13; en_US; Pixel 7; Build/TQ3A.230605.012; Cronet/58.0.2991.0)";
        
        // Handle local transcoded files immediately
        if (isLocalPath) {
            console.log(`🎬 [Stream] Serving local transcoded file: ${url}`);
            const stat = fs.statSync(url);
            const range = req.headers.range;
            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                const chunksize = (end - start) + 1;
                const file = fs.createReadStream(url, { start, end });
                res.writeHead(206, {
                    ...getCommonHeaders(),
                    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                    'Content-Length': chunksize,
                });
                return file.pipe(res);
            } else {
                res.writeHead(200, getCommonHeaders(stat.size));
                return fs.createReadStream(url).pipe(res);
            }
        }

        const isDirectMedia = url.match(/(tiktokcdn|tiktokv|bytevc|muscdn|akamaized|douyin|v19-webapp-prime\.tiktok\.com|v16-webapp\.tiktok\.com|playAddr)/i);

        if (isDirectMedia) {
            console.log(`📥 [Stream] Direct media URL detected: ${url}`);
            try {
                const sourceRes = await axios({
                    url,
                    method: 'GET',
                    responseType: 'stream',
                    headers: {
                        'User-Agent': mobileUA,
                        'Referer': 'https://www.tiktok.com/'
                    },
                    timeout: 60000,
                });

                const contentLength = parseInt(sourceRes.headers['content-length'], 10);
                res.writeHead(200, getCommonHeaders(isNaN(contentLength) ? null : contentLength));

                const pass = new PassThrough();
                sourceRes.data.pipe(pass);
                pass.pipe(res);

                const writer = fs.createWriteStream(cachePath);
                pass.pipe(writer);
                writer.on('finish', () => console.log(`✅ [Stream] Cached direct media: ${cacheFilename}`));
                writer.on('error', (err) => console.warn(`❌ [Stream] Cache write failed: ${err.message}`));
                return;
            } catch (err) {
                console.warn(`⚠️ [Stream] Direct media download failed: ${err.message}`);
                // fallback to yt-dlp below
            }
        }

        console.log(`📥 [Stream] Downloading via yt-dlp: ${safeId} [${urlHash}]`);
        try {
            const ytDlpPath = getBinaryPath() || 'yt-dlp';
            const proxy = process.env.TIKTOK_PROXY;
            const proxyArg = proxy ? `--proxy "${proxy}"` : "";
            
            // Start yt-dlp download in background
            const cmd = `"${ytDlpPath}" -y ${proxyArg} -o "${cachePath}" "${url}" --no-playlist --no-warnings --user-agent "${mobileUA}"`;
            
            let downloadDone = false;
            exec(cmd, async (error, stdout, stderr) => {
                if (error) {
                    console.error(`❌ [Stream] yt-dlp failed: ${error.message}`);
                    
                    // 🚀 Fallback to Axios download if it's a direct media link
                    if (url.match(/(tiktokcdn|tiktokv|bytevc|muscdn|akamaized)/i)) {
                        console.log("    👉 Attempting Axios Fallback Download...");
                        try {
                            const writer = fs.createWriteStream(cachePath);
                            const response = await axios({
                                url: url,
                                method: 'GET',
                                responseType: 'stream',
                                headers: {
                                    'User-Agent': mobileUA,
                                    'Referer': 'https://www.tiktok.com/'
                                }
                            });
                            response.data.pipe(writer);
                            await new Promise((resolve, reject) => {
                                writer.on('finish', resolve);
                                writer.on('error', reject);
                            });
                            console.log("    ✅ Axios Fallback Success!");
                            downloadDone = true;
                        } catch (axiosErr) {
                            console.error(`    ❌ Axios Fallback also failed: ${axiosErr.message}`);
                        }
                    }
                    return;
                }
                console.log(`✅ [Stream] Download complete: ${cacheFilename}`);
                downloadDone = true;
            });

            // While downloading, we wait for the file to exist
            let attempts = 0;
            const checkFile = setInterval(() => {
                attempts++;
                if (fs.existsSync(cachePath)) {
                    const stat = fs.statSync(cachePath);
                    // Wait for at least 100KB to start streaming or if download is done
                    if (stat.size > 100 * 1024 || downloadDone) {
                        clearInterval(checkFile);
                        res.writeHead(200, getCommonHeaders(downloadDone ? stat.size : null));
                        fs.createReadStream(cachePath).pipe(res);
                    }
                } else if (attempts > 90) { // 90 seconds timeout (increased for reliability)
                    clearInterval(checkFile);
                    if (!res.headersSent) res.status(504).send("Streaming Timeout: TikTok source is responding too slowly.");
                }
            }, 1000);

        } catch (err) {
            console.error(`❌ [Stream] Setup Failed: ${err.message}`);
            if (!res.headersSent) res.status(500).send("Stream Setup Error");
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
