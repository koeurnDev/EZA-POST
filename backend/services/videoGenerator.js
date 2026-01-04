const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Generates a slideshow video from images with background music and effects.
 * @param {string[]} imagePaths - Array of absolute paths to images.
 * @param {string} audioPath - Absolute path to audio file (optional).
 * @param {string} outputPath - Path to save the final video.
 * @param {number} durationPerSlide - Duration in seconds for each image (default 3s).
 * @returns {Promise<string>} - Resolves with outputPath on success.
 */
const createSlideshow = (imagePaths, audioPath, outputPath, durationPerSlide = 3) => {
    return new Promise((resolve, reject) => {
        if (!imagePaths || imagePaths.length === 0) {
            return reject(new Error("No images provided"));
        }

        console.log(`🎬 Starting Video Generation: ${imagePaths.length} images -> ${outputPath}`);

        const command = ffmpeg();

        // 1. Add inputs (Images)
        // We will loop each image to create a "stream" for the complex filter
        imagePaths.forEach(img => {
            command.input(img).loop(durationPerSlide); // Loop strictly for duration
        });

        // 2. Add Audio Input (if strictly provided and exists)
        let hasAudio = false;
        if (audioPath && fs.existsSync(audioPath)) {
            command.input(audioPath);
            hasAudio = true;
        }

        // 3. Build Filter Complex for "ZoomPan" (Ken Burns Effect)
        // We need to scale images to a standard size (e.g., 720x1280 9:16 vertical) first.
        const filterComplex = [];
        const inputs = [];

        imagePaths.forEach((_, i) => {
            // Scale to 720x1280 (Vertical) -> ZoomPan -> FadeOut/In handled by 'concat' with crossfade?
            // Simple approach: ZoomPan + Concatenate.

            // ZoomPan: Zoom in up to 1.2x over 30*Duration frames
            // d=duration*25 (assuming 25fps)
            // s=720x1280
            filterComplex.push(`[${i}:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,zoompan=z='min(zoom+0.0015,1.5)':d=${durationPerSlide * 25}:s=720x1280[v${i}]`);
            inputs.push(`[v${i}]`);
        });

        // Concat all video streams
        filterComplex.push(`${inputs.join('')}concat=n=${imagePaths.length}:v=1:a=0[outv]`);

        command.complexFilter(filterComplex, ['outv']);

        // 4. Output Options
        command.outputOptions([
            '-c:v libx264',
            '-pix_fmt yuv420p', // Important for compatibility
            '-r 25',            // 25 fps
            '-t', `${imagePaths.length * durationPerSlide}`, // Strict total duration used for safety
            '-movflags +faststart'
        ]);

        if (hasAudio) {
            // Loop audio if shorter than video, or trim if longer
            // However, fluent-ffmpeg 'inputOptions' for audio loop is tricky with complex filter.
            // Simplest: Just map audio. If shorter, it stops. If longer, -t handles it.
            // To loop audio: -stream_loop -1 (before input).
            // But we can't easily inject options before specific inputs in this chain structure nicely without 'inputOption'.

            // We'll just map the audio stream.
            // command.outputOptions(['-map 1:a']); // Assuming audio is last input? No, index matches inputs order.
            // Audio is input #N (where N = imagePaths.length)
            command.outputOptions([`-map ${imagePaths.length}:a`, '-c:a aac', '-b:a 128k', '-shortest']);
        }

        // Map final video
        command.outputOptions(['-map [outv]']);

        command
            .on('start', (cmdLine) => {
                console.log('⚡ FFmpeg Command:', cmdLine);
            })
            .on('error', (err, stdout, stderr) => {
                console.error('❌ FFmpeg Error:', err.message);
                console.error('Stderr:', stderr);
                reject(err);
            })
            .on('end', () => {
                console.log('✅ Video created successfully:', outputPath);
                resolve(outputPath);
            })
            .save(outputPath);
    });
};

module.exports = { createSlideshow };
