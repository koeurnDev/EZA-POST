const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { createMotionVideo } = require("../../services/motionService");
const { requireAuth } = require("../../utils/auth");

// 📂 Multer Setup
const uploadDir = path.join(__dirname, "../../temp/uploads");
const outputDir = path.join(__dirname, "../../temp/generated_videos");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => cb(null, `motion-${Date.now()}${path.extname(file.originalname)}`)
    })
});

/* -------------------------------------------------------------------------- */
/* ✨ POST /create — Create Motion Video                                      */
/* -------------------------------------------------------------------------- */
router.post("/create", requireAuth, upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: "No image uploaded" });

        const imagePath = req.file.path;
        const effect = req.body.effect || "zoom"; // zoom, flash, particles, pulse

        console.log(`✨ Creating Motion Video (${effect}) for:`, req.file.filename);

        const { outputPath, filename } = await createMotionVideo(imagePath, effect, outputDir);

        // Cleanup Input
        // fs.unlinkSync(imagePath);

        res.json({
            success: true,
            videoUrl: `/api/tools/magic-motion/download/${filename}`,
            filename: filename
        });

    } catch (err) {
        console.error("❌ Motion Error:", err);
        res.status(500).json({ success: false, error: "Failed to create motion video: " + err.message });
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
