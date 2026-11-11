/**
 * ============================================================
 * 🎬 /api/tools/capcut — CapCut Downloader
 * ============================================================
 * Uses btch-downloader to download media from CapCut.
 * Example: https://www.capcut.com/template-detail/...
 */

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { requireAuth } = require("../../utils/auth");
const ytdlp = require("../../utils/ytdlp");
const { normalizeCapCutUrl } = require("../../utils/capcutUrl");

// 🗂️ Temp directory
const tempDir = path.join(__dirname, "../../temp/capcut");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

/* -------------------------------------------------------------------------- */
/* 📥 POST /download — Download CapCut Media                                  */
/* -------------------------------------------------------------------------- */
router.post("/download", requireAuth, async (req, res) => {
    const url = normalizeCapCutUrl(req.body?.url);
    if (!url) {
        return res.status(400).json({ success: false, error: "Invalid CapCut URL" });
    }

    const safeId = `cc-${Date.now()}-${crypto.randomUUID()}`;
    const outputTemplate = path.join(tempDir, `${safeId}.%(ext)s`);

    try {
        console.log(`🎬 Downloading CapCut Media: ${url}`);

        const info = await ytdlp.lookup(url);
        if (!info) {
            throw new Error("Failed to parse CapCut link. Video might be private or deleted.");
        }

        await ytdlp.download(url, outputTemplate, {
            format: "bestvideo+bestaudio/best",
            noPlaylist: true,
            maxFilesize: "100M",
        });

        const outputFilename = fs.readdirSync(tempDir).find((file) =>
            file.startsWith(`${safeId}.`) &&
            !file.endsWith(".part") &&
            !file.endsWith(".ytdl")
        );
        if (!outputFilename) throw new Error("No completed CapCut media file was produced.");

        const outputPath = path.join(tempDir, outputFilename);
        const stats = await fs.promises.stat(outputPath);
        if (stats.size > 100 * 1024 * 1024) {
            await fs.promises.unlink(outputPath);
            return res.status(413).json({
                success: false,
                error: "CapCut video exceeds the 100 MiB download limit.",
            });
        }

        console.log("✅ CapCut Download Complete:", outputFilename);

        const metadata = {
            title: info.title || `CapCut Video ${safeId}`,
            filename: outputFilename,
            type: "video"
        };

        setTimeout(() => {
            fs.promises.unlink(outputPath).catch((err) => {
                if (err.code !== "ENOENT") console.error(`Failed to remove ${outputFilename}:`, err);
            });
        }, 10 * 60 * 1000);

        res.json({
            success: true,
            url: `/uploads/temp/capcut/${outputFilename}`,
            meta: metadata
        });

    } catch (err) {
        console.error("❌ CapCut Download Error:", err.message);
        const partialFiles = fs.readdirSync(tempDir).filter((file) => file.startsWith(`${safeId}.`));
        await Promise.all(partialFiles.map(async (file) => {
            try {
                await fs.promises.unlink(path.join(tempDir, file));
            } catch (cleanupError) {
                if (cleanupError.code !== "ENOENT") {
                    console.error(`Failed to remove partial CapCut download ${file}:`, cleanupError);
                }
            }
        }));
        res.status(500).json({ success: false, error: "Failed to download this public CapCut video." });
    }
});

module.exports = router;
