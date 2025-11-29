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
 * 📏 Process video to ensure it fits a 1:1 square ratio.
 * Adds black padding if necessary.
 * 
 * @param {string} inputPath - Path to the input video
 * @returns {Promise<string>} - Path to the processed video
 */
const processVideoToSquare = (inputPath) => {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(
            path.dirname(inputPath),
            `processed_${path.basename(inputPath)}`
        );

        console.log(`🎬 Processing video: ${inputPath} -> ${outputPath}`);

        ffmpeg(inputPath)
            .videoCodec("libx264")
            .audioCodec("aac")
            .complexFilter([
                // Scale to fit within 1080x1080, keeping aspect ratio
                "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:black"
            ])
            .outputOptions([
                "-preset fast", // Speed up encoding
                "-crf 23"       // Reasonable quality
            ])
            .on("end", () => {
                console.log("✅ Video processing complete");
                resolve(outputPath);
            })
            .on("error", (err) => {
                console.error("❌ FFmpeg Error:", err.message);
                reject(err);
            })
            .save(outputPath);
    });
};

module.exports = { processVideoToSquare };
