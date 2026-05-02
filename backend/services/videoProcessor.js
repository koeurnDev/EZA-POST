
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Process video with AI Randomizer features
 * @param {string} inputPath - Path to input video
 * @param {string} outputDir - Directory to save processed video
 * @param {object} options - { pitchShift: boolean, flip: boolean, speedChange: boolean, noise: boolean, squarePad: boolean }
 * @returns {Promise<string>} - Path to processed video
 */
exports.processVideo = (inputPath, outputDir, options = {}) => {
    return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const ext = path.extname(inputPath);
        const outputPath = path.join(outputDir, `processed_${timestamp}${ext}`);

        let command = ffmpeg(inputPath);
        const videoFilters = [];
        const audioFilters = [];

        console.log("🎨 [Video Processor] Processing:", inputPath);
        console.log("⚙️ [Video Processor] Options:", options);

        // 0. Square Padding (Critical for Facebook Carousel)
        if (options.squarePad) {
            // pad=max(iw\,ih):ow:(ow-iw)/2:(oh-ih)/2
            // This ensures 1:1 aspect ratio with black bars if needed
            videoFilters.push("pad=max(iw\\,ih):ow:(ow-iw)/2:(oh-ih)/2:black");
        }

        // 1. Mirror/Flip (Horizontal)
        if (options.flip) {
            videoFilters.push("hflip");
        }

        // 2. Audio Pitch Shift (Slightly higher/sharp or lower/deep)
        // We'll randomize slightly between 0.95 (Deep) and 1.05 (Sharp) if pitchShift is true
        if (options.pitchShift) {
            // Randomize factor: 0.95 to 1.05 (excluding 1.0)
            const factor = Math.random() > 0.5 ? 1.05 : 0.95;
            audioFilters.push(`asetrate=44100*${factor},atempo=${1 / factor},aresample=44100`);
        }

        // 3. Hash Changer (Metadata Noise / Ghost Frame equivalent)
        // We adding a very subtle noise and slight brightness change to alter frame data
        if (options.safeMode || options.noise) {
            videoFilters.push("eq=brightness=0.01:contrast=1.01");
            command.outputOptions("-metadata", `comment=Randomized_${Date.now()}`);
        }

        // 4. Slight Speed Change (Avoiding Content ID Match)
        if (options.speedChange) {
            videoFilters.push("setpts=0.98*PTS");
            audioFilters.push("atempo=1.02");
        }

        if (videoFilters.length > 0) {
            command.videoFilters(videoFilters);
        }

        if (audioFilters.length > 0) {
            command.audioFilters(audioFilters);
        }

        // ✅ Use H.264 for maximum compatibility
        command
            .outputOptions([
                "-c:v libx264",
                "-crf 23",
                "-preset medium",
                "-c:a aac",
                "-b:a 128k",
                "-movflags +faststart" // Enables web streaming
            ])

        command
            .on("start", (cmd) => console.log("🎬 FFMPEG Start:", cmd))
            .on("end", () => {
                console.log("✅ FFMPEG Processing Complete:", outputPath);
                resolve(outputPath);
            })
            .on("error", (err) => {
                console.error("❌ FFMPEG Error:", err);
                reject(err);
            })
            .save(outputPath);
    });
};
