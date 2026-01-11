const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Runs the Python auto-blur script on the input video.
 * @param {string} inputPath - Absolute path to input video
 * @param {string} tempOutputPath - Absolute path for the intermediate video (no audio)
 * @returns {Promise<void>}
 */
const runPythonBlur = (inputPath, tempOutputPath) => {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '../scripts/auto_blur.py');
        const pythonCmd = process.env.NODE_ENV === 'production' ? 'python3' : 'python';
        const pythonProcess = spawn(pythonCmd, [scriptPath, inputPath, tempOutputPath]);

        pythonProcess.stdout.on('data', (data) => {
            console.log(`[AutoBlur Python]: ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`[AutoBlur Python Error]: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Python script exited with code ${code}`));
            }
        });
    });
};

/**
 * Merges audio from source video to the processed video.
 * @param {string} originalVideoPath 
 * @param {string} processedVideoPath 
 * @param {string} finalOutputPath 
 * @returns {Promise<void>}
 */
const mergeAudio = (originalVideoPath, processedVideoPath, finalOutputPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(processedVideoPath)
            .input(originalVideoPath)
            .outputOptions([
                '-c:v copy',       // Copy video stream (no re-encode)
                '-c:a aac',        // Encode audio to AAC
                '-map 0:v:0',      // Take video from input 0 (processed)
                '-map 1:a:0?',     // Take audio from input 1 (original), ? means optional if no audio
                '-shortest'        // Stop when shortest stream ends
            ])
            .save(finalOutputPath)
            .on('end', () => {
                console.log('Audio merge finished');
                resolve();
            })
            .on('error', (err) => {
                console.error('Audio merge error:', err);
                reject(err);
            });
    });
};

exports.censorVideo = async (inputPath, outputDir) => {
    const filename = path.basename(inputPath, path.extname(inputPath));
    const tempVideoPath = path.join(outputDir, `${filename}_blurred_no_audio.mp4`);
    const finalVideoPath = path.join(outputDir, `${filename}_censored.mp4`);

    try {
        console.log(`Starting Auto-Bluring for: ${inputPath}`);

        // 1. Run Python Script
        await runPythonBlur(inputPath, tempVideoPath);

        // 2. Merge Audio
        await mergeAudio(inputPath, tempVideoPath, finalVideoPath);

        // 3. Cleanup Temp
        if (fs.existsSync(tempVideoPath)) {
            fs.unlinkSync(tempVideoPath);
        }

        return path.basename(finalVideoPath);
    } catch (error) {
        console.error("Censorship Service Error:", error);
        throw error;
    }
};
