const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { extractAudio, generateSRT, burnSubtitles } = require("../../services/subtitleService");
const { requireAuth } = require("../../utils/auth");

// 📂 Multer Setup
const uploadDir = path.join(__dirname, "../../temp/uploads");
const outputDir = path.join(__dirname, "../../temp/generated_videos");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => cb(null, `raw-${Date.now()}${path.extname(file.originalname)}`)
    })
});

/* -------------------------------------------------------------------------- */
/* 🎥 POST /generate — Generate Khmer Subtitles                               */
/* -------------------------------------------------------------------------- */
router.post("/generate", requireAuth, upload.single("video"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: "No video uploaded" });

        const videoPath = req.file.path;
        console.log("🎥 Processing Subtitles for:", req.file.filename);

        // 1. Extract Audio
        console.log("   Extracting audio...");
        const audioPath = await extractAudio(videoPath);

        // 2. Generate SRT (Gemini)
        console.log("   🤖 AI Transcribing & Translating (Gemini)...");
        const srtContent = await generateSRT(audioPath);

        // Log SRT for debug
        // console.log("SRT Preview:", srtContent.substring(0, 100));

        // 3. Burn Subtitles
        console.log("   🔥 Burning subtitles...");
        const { outputPath, filename } = await burnSubtitles(videoPath, srtContent, outputDir);

        // Cleanup Input
        // fs.unlinkSync(videoPath);
        // fs.unlinkSync(audioPath);

        res.json({
            success: true,
            message: "Subtitles Generated!",
            videoUrl: `/api/tools/subtitle/download/${filename}`,
            filename: filename
        });

    } catch (err) {
        console.error("❌ Subtitle Gen Error:", err);
        const logPath = path.join(__dirname, "../../debug_errors.log");
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] Subtitle Error: ${err.message}\nStack: ${err.stack}\n`);
        res.status(500).json({ success: false, error: "Failed to generate subtitles: " + err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* 📥 GET /download/:filename                                                 */
/* -------------------------------------------------------------------------- */
router.get("/download/:filename", (req, res) => {
    const filePath = path.join(outputDir, req.params.filename);
    if (fs.existsSync(filePath)) res.download(filePath);
    else res.status(404).json({ error: "File not found" });
});

module.exports = router;
