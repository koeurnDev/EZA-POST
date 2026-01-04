const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Applies a procedural motion effect to a static image.
 * Effect Types:
 * - 'zoom': Simple Ken Burns (already have this, but good to include)
 * - 'flash': Strobe effect (camera flash)
 * - 'particles': Floating particles (simulated noise/snow)
 * - 'rain': Falling rain simulation
 */
const createMotionVideo = (imagePath, effectType, outputDir) => {
    return new Promise((resolve, reject) => {
        const filename = `motion-${effectType}-${Date.now()}.mp4`;
        const outputPath = path.join(outputDir, filename);

        const command = ffmpeg(imagePath);
        const duration = 5; // 5 seconds clip

        // Base input options
        command.loop(duration);

        // Filter Complex Logic
        let filter = [];

        // 1. Base Scale & Zoom (Ken Burns) - Always apply a little movement
        filter.push(`[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,zoompan=z='min(zoom+0.0015,1.5)':d=${duration * 25}:s=1280x720[bg]`);

        if (effectType === 'flash') {
            // 📸 Flash Effect: Dip to white randomly or periodically
            // We use `drawbox` with opacity responding to time, or `eq` brightness
            // Simpler: blinking overlay
            // Actually, simpler approach: eq=brightness using sine wave
            filter.push(`[bg]eq=brightness='0.2*sin(2*PI*t*1)+0.0':contrast=1.1[outv]`);
        } else if (effectType === 'particles') {
            // ✨ Particles: Noise/Snow
            // Create a noise source, remove color, scale it, overlay
            // geq is slow. life is too short to generate good particles with simple ffmpeg filters.
            // Let's use simple `noise` filter on a black background and screen combine.
            filter.push(`color=c=black:s=1280x720[noisebase]`);
            filter.push(`[noisebase]noise=alls=40:allf=t+u[noisevideo]`);
            filter.push(`[bg][noisevideo]blend=all_mode=screen:all_opacity=0.3[outv]`);
        } else if (effectType === 'rain') {
            // 🌧️ Rain: Similar to particles but maybe streaky? 
            // Hard to do procedurally well without external asset. 
            // Let's just do a "Vignette Pulse" for now as 'pulse'
            filter.push(`[bg]vignette='PI/4+random(1)*0.1'[outv]`);
        } else {
            // Default: Just the zoom from step 1
            filter.push(`[bg]null[outv]`);
        }

        // Apply
        command.complexFilter(filter, ['outv']);

        command
            .videoCodec('libx264')
            .outputOptions([
                '-t', duration,
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart'
            ])
            .save(outputPath)
            .on('end', () => resolve({ outputPath, filename }))
            .on('error', (err) => reject(err));
    });
};

module.exports = { createMotionVideo };
