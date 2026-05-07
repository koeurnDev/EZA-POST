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
            // First try to get standard lookup data (which gives title, cover, duration, etc.)
            // We can use the logic from api/tools/tiktok.js lookup route here
            const cleanUrl = (url.match(/https?:\/\/[^\s]+/) || [url])[0];
            
            console.log("    👉 Attempting yt-dlp (Internal Scraper)...");
            const youtubedl = require("youtube-dl-exec");
            const path = require("path");
            const prodPath = path.join(__dirname, '../../bin/yt-dlp');
            const execPath = (process.env.NODE_ENV === 'production' && require('fs').existsSync(prodPath)) ? prodPath : undefined;
            
            const output = await youtubedl(cleanUrl, { dumpSingleJson: true, noWarnings: true }, { execPath });
            
            if (output && output.url) {
                videoData = {
                    url: output.url,
                    cover: output.thumbnail,
                    title: output.title,
                    author: output.uploader
                };
                console.log("    ✅ yt-dlp Success!");
            }
        } catch (e) {
            console.warn("    ⚠️ yt-dlp failed, falling back to downloader:", e.message);
        }
        
        // If yt-dlp fails to get rich metadata, use the proxy fallback
        if (!videoData) {
            try {
                const proxyUrl = await tiktokDownloader.getPlayableUrl(url);
                const meta = await tiktokDownloader.getVideoMetadata(url);
                
                if (proxyUrl) {
                    videoData = {
                        url: proxyUrl,
                        cover: meta.thumbnail,
                        title: meta.title,
                        author: meta.author
                    };
                }
            } catch (e) {
                console.warn("    ⚠️ Fallback failed:", e.message);
            }
        }

        if (videoData) {
            return res.json({
                success: true,
                video: {
                    url: videoData.url,
                    cover: videoData.cover, // Used by Post.jsx
                    thumbnail: videoData.cover,
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
