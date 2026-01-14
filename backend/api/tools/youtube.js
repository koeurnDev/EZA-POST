/**
 * ============================================================
 * 📺 /api/tools/youtube — YouTube Downloader (yt-dlp)
 * ============================================================
 * Uses youtube-dl-exec directly with robust Render configuration.
 */

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth");
const youtubedl = require("youtube-dl-exec");
const ffmpegPath = require("ffmpeg-static"); // ✅ Required for merging 1080p+ Video & Audio

// 🗂️ Temp directory
const tempDir = path.join(__dirname, "../../temp/videos");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// 🍪 Cookies File (for Age-Gated / Premium content)
const cookiesPath = path.join(__dirname, "../../cookies.txt");

// ⚙️ Helper: Get Binary Path for Render
const getBinaryPath = () => {
    return process.env.NODE_ENV === 'production'
        ? path.join(__dirname, '../../bin/yt-dlp')
        : undefined;
};

/* -------------------------------------------------------------------------- */
/* 🔍 POST /lookup — Get Video Info & Formats                                 */
/* -------------------------------------------------------------------------- */
router.post("/lookup", requireAuth, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ success: false, error: "Invalid YouTube URL" });

        console.log(`📺 Lookup YouTube (yt-dlp): ${url}`);

        const flags = {
            dumpSingleJson: true,
            flatPlaylist: true, // Key: Don't resolve every video immediately
            noWarnings: true,
            noCheckCertificate: true,
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };

        if (fs.existsSync(cookiesPath)) {
            flags.cookies = cookiesPath;
        }

        // 1. Fast Check: Is it a playlist/channel?
        const fastOutput = await youtubedl(url, flags, { execPath: getBinaryPath() });

        // 📋 CASE A: Playlist / Channel
        if (fastOutput.entries && Array.isArray(fastOutput.entries) && fastOutput.entries.length > 0) {
            console.log(`📂 Cloud detected Playlist/Channel with ${fastOutput.entries.length} items`);

            const videos = fastOutput.entries.map(entry => ({
                id: entry.id,
                title: entry.title,
                url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
                duration: entry.duration,
                thumbnail: entry.thumbnails ? entry.thumbnails[0]?.url : null
            }));

            return res.json({
                success: true,
                isPlaylist: true,
                playlistTitle: fastOutput.title,
                videos: videos
            });
        }

        // 🎬 CASE B: Single Video (Full Detail Lookup)
        // We run lookup again without flatPlaylist to get format details
        const output = await youtubedl(url, { ...flags, flatPlaylist: false }, { execPath: getBinaryPath() });

        // Parse relevant info
        const formats = output.formats || [];
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
            resolutions: availableResolutions,
            audioBitrates: [320, 256, 192, 128]
        };

        res.json({ success: true, isPlaylist: false, video: metadata });

    } catch (err) {
        console.error("❌ YouTube Lookup Error Details:", { message: err.message });
        res.status(500).json({ success: false, error: "Failed to fetch info: " + err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* 📥 POST /download — Download & Process                                     */
/* -------------------------------------------------------------------------- */
router.post("/download", requireAuth, async (req, res) => {
    try {
        const { url, quality, format } = req.body; // format: 'mp4' | 'mp3'
        if (!url) return res.status(400).json({ success: false, error: "No URL provided" });

        const isAudio = format === 'mp3';
        const safeTitle = `youtube-${Date.now()}`;
        const outputTemplate = path.join(tempDir, `${safeTitle}.%(ext)s`);

        const qualityLabel = isAudio
            ? (quality ? `${quality}kbps` : 'Best Audio')
            : (quality ? `${quality}p` : 'Best Video');

        console.log(`📥 Downloading YouTube (${qualityLabel}) as ${isAudio ? 'MP3' : 'MP4'}...`);

        const flags = {
            noWarnings: true,
            noCheckCertificate: true,
            output: outputTemplate,
            ffmpegLocation: ffmpegPath, // ✅ Critical for merging
            concurrentFragments: 4,
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };

        if (fs.existsSync(cookiesPath)) {
            flags.cookies = cookiesPath;
        }

        if (isAudio) {
            // 🎵 Audio Only
            Object.assign(flags, {
                extractAudio: true,
                audioFormat: 'mp3',
                audioQuality: quality ? `${quality}K` : '0',
            });
        } else {
            // 🎥 Video (Smart Selection)
            let formatSelector;

            if (quality && quality <= 720) {
                // ⚡ Fast Path: Try to find a pre-merged MP4 first
                formatSelector = `best[ext=mp4][height=${quality}]/bestvideo[height=${quality}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height=${quality}]+bestaudio/best[height<=${quality}]`;
            } else if (quality) {
                // 💎 High Quality (1080p+): Force Merge
                formatSelector = `bestvideo[height=${quality}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height=${quality}][ext=mp4]+bestaudio/bestvideo[height=${quality}]+bestaudio`;
            } else {
                // 🌟 Best Available
                formatSelector = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio/bestvideo+bestaudio/best';
            }

            Object.assign(flags, {
                format: formatSelector,
                mergeOutputFormat: 'mp4',
            });
        }

        // EXECUTE DOWNLOAD
        await youtubedl(url, flags, { execPath: getBinaryPath() });

        // Find the generated file
        const files = fs.readdirSync(tempDir);
        const foundFile = files.find(f =>
            f.startsWith(safeTitle) &&
            !f.endsWith('.part') &&
            !f.endsWith('.ytdl')
        );

        if (foundFile) {
            console.log("✅ Download Complete:", foundFile);

            // 🕒 Auto-Delete after 5 minutes
            // 🕒 Auto-Delete handled by global tempCleaner.js
            // setTimeout removed to avoid file finding race conditions

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
