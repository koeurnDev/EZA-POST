/**
 * 🎬 Video Processor Utility
 * Uses FFmpeg to process videos (e.g., padding to 1:1 ratio).
 */

const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * 📏 Process media (video or image) to ensure it fits a 1:1 square ratio.
 * Adds black padding if necessary.
 * 
 * @param {string} inputPath - Path to the input file
 * @returns {Promise<string>} - Path to the processed file
 */
const processMediaToSquare = (inputPath) => {
    return new Promise((resolve, reject) => {
        const ext = path.extname(inputPath).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png'].includes(ext);

        const outputPath = path.join(
            path.dirname(inputPath),
            `processed_${path.basename(inputPath)}`
        );

        console.log(`🎬 Processing media (${isImage ? 'Image' : 'Video'}): ${inputPath} -> ${outputPath}`);

        let command = ffmpeg(inputPath)
            .complexFilter([
                // Scale to fit within 1080x1080, keeping aspect ratio
                "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:black"
            ]);

        if (!isImage) {
            // Video-specific settings
            command
                .videoCodec("libx264")
                .audioCodec("aac")
                .outputOptions([
                    "-preset fast", // Speed up encoding
                    "-crf 23"       // Reasonable quality
                ]);
        }

        command
            .on("end", () => {
                console.log("✅ Media processing complete");
                resolve(outputPath);
            })
            .on("error", (err) => {
                console.error("❌ FFmpeg Error:", err.message);
                reject(err);
            })
            .save(outputPath);
    });
};

/**
 * 🖼️ Generate a thumbnail from a video file.
 *
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<string>} - Path to the generated thumbnail
 */
const generateThumbnail = (videoPath) => {
    return new Promise((resolve, reject) => {
        const thumbnailPath = path.join(
            path.dirname(videoPath),
            `thumb_${path.basename(videoPath, path.extname(videoPath))}.jpg`
        );

        console.log(`🖼️ Generating thumbnail: ${videoPath} -> ${thumbnailPath}`);

        ffmpeg(videoPath)
            .screenshots({
                timestamps: ['00:00:01.000'],
                filename: path.basename(thumbnailPath),
                folder: path.dirname(thumbnailPath),
                size: '1080x1080' // Ensure thumbnail matches video dimensions
            })
            .on('end', () => {
                console.log("✅ Thumbnail generated");
                resolve(thumbnailPath);
            })
            .on('error', (err) => {
                console.error("❌ Thumbnail Generation Error:", err.message);
                reject(err);
            });
    });
};

module.exports = { processMediaToSquare, generateThumbnail };
