const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");

ffmpeg.setFfmpegPath(ffmpegPath);

// Lazy Initialize Gemini
let genAI = null;
const getGeminiModel = () => {
    if (!process.env.GOOGLE_API_KEY) {
        throw new Error("Missing GOOGLE_API_KEY in .env file");
    }
    if (!genAI) {
        genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    }
    return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
};

/**
 * Extracts audio from video.
 */
const extractAudio = (videoPath) => {
    return new Promise((resolve, reject) => {
        const audioPath = videoPath.replace(path.extname(videoPath), '.mp3');
        ffmpeg(videoPath)
            .noVideo()
            .audioCodec('libmp3lame')
            .save(audioPath)
            .on('end', () => resolve(audioPath))
            .on('error', (err) => reject(new Error("FFmpeg Audio Extract Error: " + err.message)));
    });
};

/**
 * Generates SRT subtitles (Khmer) from Audio using Gemini 1.5 Flash.
 */
const generateSRT = async (audioPath) => {
    try {
        const model = getGeminiModel();

        // Read audio file
        const audioData = fs.readFileSync(audioPath);
        const audioPart = {
            inlineData: {
                data: audioData.toString("base64"),
                mimeType: "audio/mp3",
            },
        };

        const prompt = `
            Listen to this audio (English or Chinese). 
            Generate standard SRT (SubRip) subtitles. 
            TRANSLATE the content directly into KHMER (Cambodian).
            Ensure the timings are accurate.
            Do not include the original language, ONLY the Khmer translation in the subtitle text.
            Output ONLY the raw SRT content, no markdown code blocks.
        `;

        const result = await model.generateContent([prompt, audioPart]);
        const response = await result.response;
        let srtContent = response.text();

        // Cleanup markdown if present
        srtContent = srtContent.replace(/```srt/g, '').replace(/```/g, '').trim();

        return srtContent;

    } catch (err) {
        console.error("❌ Gemini Subtitle Error:", err);
        throw new Error("AI Generation Failed: " + err.message);
    }
};

/**
 * Burns SRT subtitles into video (Hardsub).
 */
const burnSubtitles = (videoPath, srtContent, outputDir) => {
    return new Promise((resolve, reject) => {
        // 1. Write SRT to temp file
        const srtPath = videoPath.replace(path.extname(videoPath), '.srt');
        fs.writeFileSync(srtPath, srtContent, 'utf8');

        const filename = `subbed-${Date.now()}.mp4`;
        const outputPath = path.join(outputDir, filename);

        // Path Formatting for Windows FFmpeg Filter
        const srtPathKick = srtPath.replace(/\\/g, '/').replace(':', '\\:');

        ffmpeg(videoPath)
            .outputOptions([
                `-vf subtitles='${srtPathKick}':force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=20'`
            ])
            .videoCodec('libx264')
            .outputOptions('-preset ultrafast') // ⚡ Optimize for speed/memory
            .audioCodec('copy')
            .save(outputPath)
            .on('end', () => {
                // Cleanup temp files (best effort)
                try {
                    if (fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
                } catch (e) { }
                resolve({ outputPath, filename });
            })
            .on('error', (err) => {
                console.error("Burning Error:", err);
                reject(new Error("FFmpeg Burn Error: " + err.message));
            });
    });
};

module.exports = { extractAudio, generateSRT, burnSubtitles };
