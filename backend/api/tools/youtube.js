/**
 * ============================================================
 * 📺 /api/tools/youtube — YouTube Downloader (yt-dlp)
 * ============================================================
 * Uses youtube-dl-exec (yt-dlp wrapper) for reliable downloads.
 */

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth");
const youtubedl = require("youtube-dl-exec");
// const ffmpegPath = require("ffmpeg-static"); // Re-enabled dynamically below or here if needed at top level.
// Actually let's import it at top level to be safe.


// 🗂️ Temp directory
const tempDir = path.join(__dirname, "../../temp/videos");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

/* -------------------------------------------------------------------------- */
/* 🔍 POST /lookup — Get Video Info & Formats                                 */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* 🔍 POST /lookup — Get Video Info & Formats (Supports Single & Playlist)    */
/* -------------------------------------------------------------------------- */
router.post("/lookup", requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: "Invalid YouTube URL" });

        console.log(`📺 Lookup YouTube (yt-dlp): ${url}`);

        // 1. Fast Check: Is it a playlist/channel?
        const fastOutput = await youtubedl(url, {
            dumpSingleJson: true,
            flatPlaylist: true, // Key: Don't resolve every video immediately
            noWarnings: true,
            noCheckCertificate: true,
        });

        // 📋 CASE A: Playlist / Channel
        if (fastOutput.entries && Array.isArray(fastOutput.entries) && fastOutput.entries.length > 0) {
            console.log(`📂 Cloud detected Playlist/Channel with ${fastOutput.entries.length} items`);

            const videos = fastOutput.entries.map(entry => ({
                id: entry.id,
                title: entry.title,
                url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
                duration: entry.duration,
                thumbnail: entry.thumbnails ? entry.thumbnails[0]?.url : null // flatPlaylist might not have full thumbs
            }));

            return res.json({
                success: true,
                isPlaylist: true,
                playlistTitle: fastOutput.title,
                videos: videos
            });
        }

        // 🎬 CASE B: Single Video (Full Detail Lookup)
        // If not a playlist, we need full format details which flatPlaylist might miss
        const output = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCheckCertificate: true,
        });

        // Parse relevant info
        const formats = output.formats || [];

        // Simple heuristic for available qualities
        const resolutions = new Set();
        formats.forEach(f => {
            if (f.vcodec !== 'none' && f.height) {
                resolutions.add(f.height);
            }
        });

        // standard YouTube resolutions
        const standardRes = [2160, 1440, 1080, 720, 480, 360, 240, 144];
        const availableResolutions = standardRes.filter(r =>
            Array.from(resolutions).some(available => available >= r)
        );

        const metadata = {
            id: output.id,
            title: output.title,
            thumbnail: output.thumbnail,
            duration: output.duration,
            author: output.uploader,
            resolutions: availableResolutions
        };

        res.json({ success: true, isPlaylist: false, video: metadata });

    } catch (err) {
        console.error("❌ YouTube Lookup Error Details:", {
            message: err.message,
            stack: err.stack,
            code: err.code,
            signal: err.signal,
            stderr: err.stderr, // yt-dlp often outputs to stderr
        });
        res.status(500).json({ success: false, error: "Failed to fetch info: " + err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* 📥 POST /download — Download & Process                                     */
/* -------------------------------------------------------------------------- */
router.post("/download", requireAuth, async (req, res) => {
    try {
        const { url, quality, format } = req.body; // format: 'mp4' | 'mp3', quality: number (height)
        if (!url) return res.status(400).json({ success: false, error: "No URL provided" });

        const isAudio = format === 'mp3';
        const safeTitle = `yt-${Date.now()}`;
        const outputTemplate = path.join(tempDir, `${safeTitle}.%(ext)s`);

        const qualityLabel = quality ? `${quality}p` : 'Best Quality';
        console.log(`📥 Downloading YouTube (${qualityLabel}) as ${isAudio ? 'MP3' : 'MP4'}...`);

        // Requires ffmpeg for merging or audio extraction
        // const ffmpegPath = require("ffmpeg-static"); // Already imported at top if you did that, but let's ensure it's used
        const ffmpegPath = require("ffmpeg-static");

        const flags = {
            noWarnings: true,
            noCheckCertificate: true,
            output: outputTemplate,
            ffmpegLocation: ffmpegPath,
            concurrentFragments: 4, // 🚀 Speed up download with parallel chunks
        };

        if (isAudio) {
            // 🎵 Audio Only
            Object.assign(flags, {
                extractAudio: true,
                audioFormat: 'mp3',
                audioQuality: 0, // Best quality
            });
        } else {
            // 🎥 Video (Smart Selection)
            // Goal: Avoid slow merging if a good enough single file exists (e.g. 720p mp4)

            let formatSelector;

            if (quality && quality <= 720) {
                // ⚡ Fast Path: Try to find a pre-merged MP4 at the exact quality first.
                // "best[ext=mp4][height=...]" guarantees a single file (no merge).
                formatSelector = `best[ext=mp4][height=${quality}]/bestvideo[height=${quality}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height=${quality}]+bestaudio/best[height<=${quality}]`;
            } else if (quality) {
                // 💎 High Quality (1080p+): Usually implies creating a merge.
                // Prefer MP4 video (H.264) + M4A audio (AAC) to avoid re-encoding.
                formatSelector = `bestvideo[height=${quality}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height=${quality}][ext=mp4]+bestaudio/bestvideo[height=${quality}]+bestaudio`;
            } else {
                // 🌟 Best Available
                // Try to get H.264/AAC first for speed, otherwise fall back to best quality (likely VP9)
                formatSelector = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio/bestvideo+bestaudio/best';
            }

            console.log(`🎯 Strategy: ${formatSelector}`);

            Object.assign(flags, {
                format: formatSelector,
                mergeOutputFormat: 'mp4', // Ensure final container is mp4 if valid
            });
        }

        await youtubedl(url, flags);

        // Find the generated file
        // yt-dlp might replace %(ext)s with mp4, mp3, mkv, etc.
        const expectedExt = isAudio ? '.mp3' : '.mp4';

        // We look for files starting with safeTitle
        const files = fs.readdirSync(tempDir);
        const foundFile = files.find(f => f.startsWith(safeTitle));

        if (foundFile) {
            console.log("✅ Download Complete:", foundFile);
            res.json({ success: true, url: `/uploads/temp/videos/${foundFile}` });
        } else {
            throw new Error("File not found after download. FFmpeg merge might have failed.");
        }

    } catch (err) {
        console.error("❌ YT Download Error:", err.message);
        res.status(500).json({ success: false, error: err.message || "Server Error" });
    }
});

module.exports = router;
