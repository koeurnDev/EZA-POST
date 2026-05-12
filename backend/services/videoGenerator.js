const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);

const { exec } = require('child_process');

/**
 * Gets duration of a media file in seconds.
 */
const getDuration = (filePath) => {
    return new Promise((resolve) => {
        exec(`"${ffmpegPath}" -i "${filePath}"`, (err, stdout, stderr) => {
            const output = stderr || stdout;
            const match = output.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
            if (match) {
                const hours = parseInt(match[1]);
                const minutes = parseInt(match[2]);
                const seconds = parseFloat(match[3]);
                resolve((hours * 3600) + (minutes * 60) + seconds);
            } else {
                resolve(0);
            }
        });
    });
};

/**
 * Generates a high-quality HD slideshow video with premium Ken Burns effect.
 */
const createSlideshow = (imagePaths, audioPath, outputPath, durationPerSlide = 5) => {
    return new Promise(async (resolve, reject) => {
        if (!imagePaths || imagePaths.length === 0) {
            return reject(new Error("No images provided"));
        }

        console.log(`🎬 Creating Premium HD Video: ${imagePaths.length} images -> ${outputPath}`);

        let totalDuration = imagePaths.length * durationPerSlide;
        let slideDuration = durationPerSlide;

        const hasAudioInput = audioPath && fs.existsSync(audioPath);
        if (hasAudioInput) {
            const audioDuration = await getDuration(audioPath);
            if (audioDuration > 0) {
                totalDuration = audioDuration;
                slideDuration = totalDuration / imagePaths.length;
                console.log(`🎵 Audio Sync: ${audioDuration}s total duration.`);
            }
        }

        const command = ffmpeg();

        // 1. Add Image Inputs
        imagePaths.forEach(img => {
            command.input(img).inputOptions(['-loop 1', `-t ${slideDuration}`]);
        });

        if (hasAudioInput) {
            command.input(audioPath);
        }

        // 2. Filter Complex for Premium Look (Ken Burns Effect)
        // We use a safe scaling method that works for all aspect ratios
        const filters = [];
        const concatLabel = [];

        imagePaths.forEach((_, i) => {
            const label = `v${i}`;

            // 📸 Static image slideshow without zoom
            filters.push(
                `[${i}:v]scale=1280:2276,crop=1080:1920,setsar=1,fps=25[${label}]`
            );
            concatLabel.push(`[${label}]`);
        });

        filters.push(`${concatLabel.join('')}concat=n=${imagePaths.length}:v=1:a=0[outv]`);

        command.complexFilter(filters);

        // 3. HD Output Settings (H.264 High Profile)
        command
            .outputOptions([
                '-map [outv]',
                hasAudioInput ? `-map ${imagePaths.length}:a` : '',
                '-c:v libx264',
                '-preset slow', // Slow encoding for maximum quality
                '-crf 18',      // High fidelity
                '-pix_fmt yuv420p',
                '-r 25',
                '-t', totalDuration,
                '-movflags +faststart'
            ].filter(Boolean));

        if (hasAudioInput) {
            command.outputOptions(['-c:a aac', '-b:a 192k', '-shortest']);
        }

        command
            .on('start', (cmd) => console.log('⚡ Premium HD Encoding:', cmd))
            .on('error', (err) => {
                console.error('❌ Encoding Failed:', err.message);
                reject(err);
            })
            .on('end', () => {
                console.log('✅ Premium HD Video Created');
                resolve(outputPath);
            })
            .save(outputPath);
    });
};

module.exports = { createSlideshow };
