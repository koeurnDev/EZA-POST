const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Runs the Python label swap script.
 * @param {string} videoPath 
 * @param {string} logoPath 
 * @param {string} roi - "x,y,w,h" string
 * @param {string} tempOutputPath 
 * @returns {Promise<void>}
 */
const runPythonLabelSwap = (videoPath, logoPath, roi, tempOutputPath) => {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '../scripts/label_swap.py');
        const pythonProcess = spawn('python', [scriptPath, videoPath, logoPath, roi, tempOutputPath]);

        pythonProcess.stdout.on('data', (data) => {
            console.log(`[LabelSwap Python]: ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`[LabelSwap Python Error]: ${data}`);
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
                '-c:v copy',       // Copy video stream
                '-c:a aac',        // Encode audio to AAC
                '-map 0:v:0',      // Video from processed
                '-map 1:a:0?',     // Audio from original (optional)
                '-shortest'
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

exports.swapLabel = async (videoPath, logoPath, roi, outputDir) => {
    const filename = path.basename(videoPath, path.extname(videoPath));
    const tempVideoPath = path.join(outputDir, `${filename}_temp_swap.mp4`);
    const finalVideoPath = path.join(outputDir, `${filename}_label_swapped.mp4`);

    try {
        console.log(`Starting Label Swap for: ${videoPath} with ROI: ${roi}`);

        // 1. Run Python Script
        await runPythonLabelSwap(videoPath, logoPath, roi, tempVideoPath);

        // 2. Merge Audio
        await mergeAudio(videoPath, tempVideoPath, finalVideoPath);

        // 3. Cleanup Temp
        if (fs.existsSync(tempVideoPath)) {
            fs.unlinkSync(tempVideoPath);
        }

        return path.basename(finalVideoPath);
    } catch (error) {
        console.error("Label Swap Service Error:", error);
        throw error;
    }
};
