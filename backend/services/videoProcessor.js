/**
 * 🎬 videoProcessor.js — FFmpeg worker for video transformations
 */

const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");

ffmpeg.setFfmpegPath(ffmpegStatic);

// Simple in-memory queue to prevent CPU saturation
const queue = [];
const activeProcesses = { count: 0, max: 2 };

const runNextInQueue = () => {
    if (queue.length > 0 && activeProcesses.count < activeProcesses.max) {
        const next = queue.shift();
        next();
    }
};

/**
 * Process a video with various transformations (Queued)
 */
exports.processVideo = (inputPath, outputDir, options = {}) => {
    return new Promise((resolve, reject) => {
        const execute = () => {
            activeProcesses.count++;
            internalProcessVideo(inputPath, outputDir, options)
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    activeProcesses.count--;
                    runNextInQueue();
                });
        };
        queue.push(execute);
        runNextInQueue();
    });
};

/**
 * Internal logic for processing video
 */
const internalProcessVideo = (inputPath, outputDir, options = {}) => {
    return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const ext = path.extname(inputPath);
        const outputPath = path.join(outputDir, `processed_${timestamp}${ext}`);

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // ✅ Security Check: Limit duration to 60 seconds
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) {
                console.error("❌ FFPROBE Error:", err);
                return reject(new Error("Could not analyze video duration."));
            }
            
            const duration = metadata.format.duration;
            if (duration > 91) { // 1s buffer
                return reject(new Error(`Video too long (${Math.round(duration)}s). Maximum allowed is 90s.`));
            }

            const command = ffmpeg(inputPath);
            const videoFilters = [];
            const audioFilters = [];

            console.log("🎨 [Video Processor] Processing:", inputPath);

            // 0. Center Crop to 1:1
            if (options.squarePad) {
                videoFilters.push("crop='min(iw,ih)':'min(iw,ih)'");
            }

            // 1. Mirror/Flip
            if (options.flip) {
                videoFilters.push("hflip");
            }

            // 2. Audio Pitch Shift
            if (options.pitchShift) {
                const factor = Math.random() > 0.5 ? 1.05 : 0.95;
                audioFilters.push(`asetrate=44100*${factor},atempo=${1 / factor},aresample=44100`);
            }

            // 3. Hash Changer / Noise
            if (options.safeMode || options.noise) {
                videoFilters.push("eq=brightness=0.01:contrast=1.01");
                command.outputOptions("-metadata", `comment=Randomized_${Date.now()}`);
            }

            // 4. Speed Change
            if (options.speedChange) {
                videoFilters.push("setpts=0.98*PTS");
                audioFilters.push("atempo=1.02");
            }

            if (videoFilters.length > 0) command.videoFilters(videoFilters);
            if (audioFilters.length > 0) command.audioFilters(audioFilters);

            command
                .outputOptions([
                    "-c:v libx264",
                    "-preset ultrafast",
                    "-crf 22",
                    "-c:a aac",
                    "-b:a 192k",
                    "-movflags +faststart"
                ])
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
    });
};

/**
 * Extract a thumbnail (Queued)
 */
exports.extractThumbnail = (videoPath, outputDir) => {
    return new Promise((resolve, reject) => {
        const execute = () => {
            activeProcesses.count++;
            internalExtractThumbnail(videoPath, outputDir)
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    activeProcesses.count--;
                    runNextInQueue();
                });
        };
        queue.push(execute);
        runNextInQueue();
    });
};

const internalExtractThumbnail = (videoPath, outputDir) => {
    return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const outputPath = path.join(outputDir, `thumb_${timestamp}.jpg`);

        ffmpeg(videoPath)
            .screenshots({
                timestamps: ["10%"],
                folder: outputDir,
                filename: `thumb_${timestamp}.jpg`,
                size: "720x?"
            })
            .on("end", () => resolve(outputPath))
            .on("error", (err) => reject(err));
    });
};

/**
 * Process image for 1:1 compatibility (Queued)
 */
exports.processImage = (inputPath, outputDir) => {
    return new Promise((resolve, reject) => {
        const execute = () => {
            activeProcesses.count++;
            internalProcessImage(inputPath, outputDir)
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    activeProcesses.count--;
                    runNextInQueue();
                });
        };
        queue.push(execute);
        runNextInQueue();
    });
};

const internalProcessImage = (inputPath, outputDir) => {
    return new Promise((resolve, reject) => {
        const timestamp = Date.now();
        const outputPath = path.join(outputDir, `processed_img_${timestamp}.jpg`);

        ffmpeg(inputPath)
            .complexFilter([
                "scale='if(gt(iw,ih),-1,1000)':'if(gt(iw,ih),1000,-1)'",
                "crop=1000:1000"
            ])
            .outputOptions("-vframes", "1")
            .on("end", () => resolve(outputPath))
            .on("error", (err) => reject(err))
            .save(outputPath);
    });
};
