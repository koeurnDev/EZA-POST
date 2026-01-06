/**
 * 🎵 tiktokController.js — Handle TikTok Video Fetching & Processing
 */


const path = require("path");
const fs = require("fs");
const tiktokDownloader = require("../utils/tiktokDownloader");

const cloudinary = require("../utils/cloudinary");

// ✅ Fetch TikTok Video
exports.fetchTikTokVideo = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: "TikTok URL is required" });

        console.log(`🎵 Fetching TikTok: ${url}`);

        // 1. Get Metadata
        const metadata = await tiktokDownloader.getVideoMetadata(url);

        // 2. Download Video
        const result = await tiktokDownloader.downloadTiktokVideo(url);

        if (!result || !result.buffer) {
            throw new Error("Failed to download video");
        }

        // 3. Save to Temp File (Required for Cloudinary Upload)
        const filename = `tiktok_${Date.now()}.mp4`;
        const tempPath = path.join(__dirname, "../../temp/videos", filename);

        // Ensure directory exists
        const dir = path.dirname(tempPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(tempPath, result.buffer);

        // 4. Upload to Cloudinary (with 1:1 transformation)
        console.log(`☁️ Uploading to Cloudinary: ${filename}`);
        const uploadResult = await cloudinary.uploadFile(
            tempPath,
            "eza-post/videos",
            "video",
            true, // Delete local file after upload
            true  // Apply 1:1 transformation
        );

        // 5. Return Response
        const mp3Url = uploadResult.url.replace(/\.[^/.]+$/, ".mp3");
        const downloadUrl = uploadResult.url.replace("/upload/", "/upload/fl_attachment/");
        const downloadMp3Url = mp3Url.replace("/upload/", "/upload/fl_attachment/");

        res.json({
            success: true,
            video: {
                url: uploadResult.url, // Cloudinary URL (Stream)
                download: {
                    mp4: downloadUrl, // Force Download MP4
                    mp3: downloadMp3Url // Force Download MP3
                },
                publicId: uploadResult.publicId,
                meta: metadata,
                duration: uploadResult.duration,
                format: uploadResult.format
            }
        });

    } catch (err) {
        console.error("❌ TikTok Fetch Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};
