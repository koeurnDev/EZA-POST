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
        
        // Use the centralized downloader which prioritizes yt-dlp
        let videoData = null;
        try {
            const cleanUrl = (url.match(/https?:\/\/[^\s]+/) || [url])[0];
            const videoId = cleanUrl.match(/\/video\/(\d+)/)?.[1];
            
            console.log("    👉 Attempting yt-dlp (Internal Scraper)...");
            const youtubedl = require("youtube-dl-exec");
            const path = require("path");
            const fs = require("fs");
            
            // Helper to get binary
            const getBinaryPath = () => {
                const prodPath = path.join(__dirname, '../../bin/yt-dlp');
                const nodePath = path.join(__dirname, '../../node_modules/youtube-dl-exec/bin/yt-dlp.exe');
                if (fs.existsSync(prodPath)) return prodPath;
                if (fs.existsSync(nodePath)) return nodePath;
                return 'yt-dlp';
            };

            try {
                const output = await youtubedl(cleanUrl, { dumpSingleJson: true, noWarnings: true }, { execPath: getBinaryPath() });
                
                if (output && output.url) {
                    const isSlide = output.vcodec === 'none' && (output.thumbnails?.length > 1);
                    videoData = {
                        url: output.url,
                        cover: output.thumbnail,
                        title: output.title,
                        author: output.uploader || "TikTok User",
                        type: isSlide ? 'slideshow' : 'video',
                        images: isSlide ? output.thumbnails.map(t => t.url) : []
                    };
                    console.log("    ✅ yt-dlp Success!");
                }
            } catch (ytErr) {
                console.warn("    ⚠️ yt-dlp failed, trying TikWM fallback...");
                
                // TikWM Fallback (Direct in controller for speed)
                const axios = require("axios");
                const tikwmRes = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`);
                const v = tikwmRes.data?.data;
                
                if (v) {
                    const isSlideshow = v.images && v.images.length > 0;
                    videoData = {
                        url: v.play || v.hdplay || "",
                        cover: v.cover,
                        title: v.title || "",
                        author: v.author?.nickname || "TikTok User",
                        type: isSlideshow ? 'slideshow' : 'video',
                        images: v.images || []
                    };
                    console.log("    ✅ TikWM Fallback Success!");
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
                        url: proxyUrl,
                        cover: meta.thumbnail,
                        title: meta.title,
                        author: meta.author,
                        type: 'video'
                    };
                }
            } catch (e) {
                console.warn("    ⚠️ Utility fallback failed:", e.message);
            }
        }

        if (videoData) {
            return res.json({
                success: true,
                video: {
                    url: videoData.url,
                    cover: videoData.cover,
                    thumbnail: videoData.cover,
                    type: videoData.type || 'video',
                    images: videoData.images || [],
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
