/**
 * 🎵 tiktokController.js — Handle TikTok Video Fetching
 * 🚀 Internalized Downloader (yt-dlp primary)
 */

const tiktokDownloader = require("../utils/tiktokDownloader");

exports.fetchTikTokVideo = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: "URL is required" });

        console.log(`🔍 [Controller] Fetching TikTok Video: ${url}`);
        
        // Use the centralized downloader which prioritizes yt-dlp for metadata
        let videoData = null;
        try {
            const cleanUrl = (url.match(/https?:\/\/[^\s]+/) || [url])[0];
            const videoId = cleanUrl.match(/\/video\/(\d+)/)?.[1];
            
            console.log("    👉 Attempting Metadata Fetch (yt-dlp)...");
            const youtubedl = require("youtube-dl-exec");
            const path = require("path");
            const fs = require("fs");
            const axios = require("axios");
            
            const getBinaryPath = () => {
                const prodPath = path.join(__dirname, '../../bin/yt-dlp');
                const nodePath = path.join(__dirname, '../../node_modules/youtube-dl-exec/bin/yt-dlp.exe');
                if (fs.existsSync(prodPath)) return prodPath;
                if (fs.existsSync(nodePath)) return nodePath;
                return 'yt-dlp';
            };

            // 🚀 FAST PATH: Get H.264 URL from TikWM immediately for playback
            let compatibleUrl = "";
            let compatibleAudio = "";
            let tikwmData = null;
            try {
                const tikwmRes = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`, { timeout: 5000 });
                tikwmData = tikwmRes.data?.data;
                if (tikwmData) {
                    compatibleUrl = tikwmData.play || tikwmData.hdplay || "";
                    compatibleAudio = tikwmData.music || "";
                }
            } catch (e) {}

            try {
                // Get rich metadata from yt-dlp
                const output = await youtubedl(cleanUrl, { dumpSingleJson: true, noWarnings: true }, { execPath: getBinaryPath() });
                
                if (output) {
                    const isSlide = output.vcodec === 'none' && (output.thumbnails?.length > 1);
                    
                    // 🎵 Improved Audio Extraction for Slideshows
                    let bestAudio = output.url;
                    if (isSlide && output.formats) {
                        const audioOnly = output.formats.find(f => f.vcodec === 'none' && (f.ext === 'm4a' || f.ext === 'mp3' || f.acodec !== 'none'));
                        if (audioOnly) bestAudio = audioOnly.url;
                    }
                    
                    // If it's a video, we prefer the compatibleUrl we got from TikWM, otherwise use yt-dlp's url
                    const finalPlayUrl = (!isSlide && compatibleUrl) ? compatibleUrl : output.url;
                    
                    const isH265 = !isSlide && 
                                  (output.vcodec?.includes('hvc1') || output.vcodec?.includes('hev1') || 
                                   output.vcodec?.includes('hevc') || output.vcodec?.includes('h265') || 
                                   output.vcodec?.includes('bytevc')) && 
                                  !compatibleUrl; // Only true H.265 if no compatible fallback found

                    videoData = {
                        id: output.id || videoId || tikwmData?.id,
                        url: finalPlayUrl,
                        audio: isSlide ? (bestAudio || compatibleAudio || output.url) : (compatibleAudio || output.url),
                        cover: output.thumbnail || tikwmData?.cover,
                        title: output.title || tikwmData?.title,
                        author: output.uploader || tikwmData?.author?.nickname || "TikTok User",
                        type: isSlide ? 'slideshow' : 'video',
                        images: isSlide ? output.thumbnails.map(t => t.url) : (tikwmData?.images || []),
                        isH265: isH265
                    };
                    console.log(`    ✅ Success! [Type: ${videoData.type}, H.264 Compatible: ${!isH265}]`);
                }
            } catch (ytErr) {
                // Fallback to only TikWM if yt-dlp fails
                if (tikwmData) {
                    const isSlideshow = tikwmData.images && tikwmData.images.length > 0;
                    videoData = {
                        id: tikwmData.id || videoId,
                        url: compatibleUrl,
                        audio: compatibleAudio,
                        cover: tikwmData.cover,
                        title: tikwmData.title || "",
                        author: tikwmData.author?.nickname || "TikTok User",
                        type: isSlideshow ? 'slideshow' : 'video',
                        images: tikwmData.images || [],
                        isH265: false 
                    };
                }
            }
        } catch (e) {
            console.warn("    ⚠️ All internal methods failed:", e.message);
        }
        
        // Final Fallback: tiktokDownloader utility
        if (!videoData) {
            try {
                const proxyUrl = await tiktokDownloader.getPlayableUrl(url);
                const meta = await tiktokDownloader.getVideoMetadata(url);
                
                if (proxyUrl) {
                    videoData = {
                        id: meta.id || "tiktok",
                        url: proxyUrl,
                        cover: meta.thumbnail,
                        title: meta.title,
                        author: meta.author,
                        type: 'video',
                        isH265: false
                    };
                }
            } catch (e) {
                console.warn("    ⚠️ Utility fallback failed:", e.message);
            }
        }

        if (videoData) {
            let finalUrl = videoData.url;
            let finalRawPath = videoData.url;

            // 🚀 PROACTIVE TURBO TRANSCODE FOR H.265
            if (videoData.isH265) {
                console.log("       ⚡ H.265 Detected! Triggering Proactive Turbo Transcode...");
                try {
                    const ffmpegPath = require('ffmpeg-static');
                    const path = require("path");
                    const fs = require("fs");
                    const { execSync } = require("child_process");
                    const crypto = require("crypto");

                    const tempDir = path.join(__dirname, "../../temp/videos");
                    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

                    const fileId = videoData.id || `tk_${Date.now()}`;
                    const mobileUA = "com.zhiliaoapp.musically/2022605040 (Linux; U; Android 13; en_US; Pixel 7; Build/TQ3A.230605.012; Cronet/58.0.2991.0)";
                    
                    const urlHash = crypto.createHash("md5").update("proactive_fix").digest("hex").slice(0, 8);
                    const cacheFilename = `tiktok-fixed-${fileId}-${urlHash}.mp4`;
                    const cachePath = path.join(tempDir, cacheFilename);

                    if (!fs.existsSync(cachePath)) {
                        const turboCmd = `"${ffmpegPath}" -y -headers "User-Agent: ${mobileUA}\r\nReferer: https://www.tiktok.com/\r\n" -i "${videoData.url}" -t 60 -c:v libx264 -preset ultrafast -crf 28 -c:a copy -threads 0 "${cachePath}"`;
                        execSync(turboCmd, { stdio: 'pipe', timeout: 30000 });
                    }

                    if (fs.existsSync(cachePath)) {
                        finalUrl = `/api/tools/tiktok/stream?id=fixed_${fileId}&url=${encodeURIComponent(cachePath)}`;
                        finalRawPath = cachePath;
                        console.log("       ✅ Proactive Turbo Transcode Success!");
                    }
                } catch (err) {
                    console.warn("       ⚠️ Proactive Turbo Transcode failed:", err.message);
                }
            }

            return res.json({
                success: true,
                video: {
                    id: videoData.id,
                    url: finalUrl,
                    rawPath: finalRawPath,
                    cover: videoData.cover,
                    thumbnail: videoData.cover,
                    type: videoData.type || 'video',
                    images: videoData.images || [],
                    audio: videoData.audio || videoData.url,
                    isH265: false, // Mark as false because we've fixed it
                    meta: {
                        title: videoData.title || "TikTok Video",
                        author: videoData.author || "TikTok User"
                    }
                }
            });
        }

        return res.status(422).json({ success: false, error: "Unable to extract content. TikTok might be blocking direct access. Please try again later." });

    } catch (err) {
        console.error("❌ Fetch Error:", err.message);
        res.status(500).json({ success: false, error: "Internal processing error." });
    }
};
