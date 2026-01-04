
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
 * @param {object} options - { pitchShift: boolean, flip: boolean, speedChange: boolean, noise: boolean }
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

        console.log("🎨 [AI Randomizer] Processing:", inputPath);
        console.log("⚙️ [AI Randomizer] Options:", options);

        // 1. Mirror/Flip (Horizontal)
        if (options.flip) {
            videoFilters.push("hflip");
        }

        // 2. Audio Pitch Shift (Slightly higher/sharp or lower/deep)
        // We'll randomize slightly between 0.95 (Deep) and 1.05 (Sharp) if pitchShift is true
        if (options.pitchShift) {
            // Randomize factor: 0.95 to 1.05 (excluding 1.0)
            const factor = Math.random() > 0.5 ? 1.05 : 0.95;
            // asetrate changes pitch AND speed. To keep speed, we'd need atempo.
            // But usually "Pitch Shifter" implies changing the character.
            // Let's use 'rubberband' if possible? No, requires extra lb.
            // Simple approach: asetrate=44100*factor,aresample=44100
            // This changes duration. To keep duration sync, we need complex filter or just accept speed change.
            // User asked for "Sharp" or "Deep" (Robot voice).
            // Let's try simple 'asetrate' -> this changes speed too.
            // If we want ONLY pitch: 'asetrate=44100*1.1,atempo=1/1.1'
            // We assume 44100Hz base.
            audioFilters.push(`asetrate=44100*${factor},atempo=${1 / factor},aresample=44100`);
        }

        // 3. Hash Changer (Metadata Noise / Ghost Frame equivalent)
        // We adding a very subtle noise and slight brightness change to alter frame data
        if (options.safeMode || options.noise) {
            // eq=brightness=0.01 (Very subtle brightness boost)
            videoFilters.push("eq=brightness=0.01:contrast=1.01");
            // Add metadata to ensure file hash changes
            command.outputOptions("-metadata", `comment=Randomized_${Date.now()}`);
        }

        // 4. Slight Speed Change (Avoiding Content ID Match)
        if (options.speedChange) {
            // 1.02x speed (Video)
            videoFilters.push("setpts=0.98*PTS");
            // Audio must match (atempo=1.02)
            audioFilters.push("atempo=1.02");
        }

        if (videoFilters.length > 0) {
            command.videoFilters(videoFilters);
        }

        if (audioFilters.length > 0) {
            command.audioFilters(audioFilters);
        }

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
