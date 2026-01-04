const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { createSlideshow } = require("../../services/videoGenerator");
const { requireAuth } = require("../../utils/auth");

// 📂 Multer Setup for Upsizing
const uploadDir = path.join(__dirname, "../../temp/uploads");
const outputDir = path.join(__dirname, "../../temp/generated_videos");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

/* -------------------------------------------------------------------------- */
/* 🎬 POST /create — Generate Reel from Images                                */
/* -------------------------------------------------------------------------- */
router.post("/create", requireAuth, upload.fields([{ name: 'images', maxCount: 10 }, { name: 'audio', maxCount: 1 }]), async (req, res) => {
    try {
        console.log("🎬 Request received to create video...");

        const files = req.files;
        if (!files || !files['images'] || files['images'].length === 0) {
            return res.status(400).json({ success: false, error: "Please upload at least one image." });
        }

        const imagePaths = files['images'].map(f => f.path);
        const audioPath = files['audio'] ? files['audio'][0].path : null;

        // Output Filename
        const filename = `reel-${Date.now()}.mp4`;
        const outputPath = path.join(outputDir, filename);

        // Generate
        await createSlideshow(imagePaths, audioPath, outputPath, 3); // 3 seconds per slide

        // Cleanup inputs? Optional. For now keep for debug.
        // imagePaths.forEach(p => fs.unlinkSync(p)); 
        // if (audioPath) fs.unlinkSync(audioPath);

        const publicUrl = `/api/tools/video-creator/download/${filename}`;

        res.json({
            success: true,
            message: "Video created successfully!",
            videoUrl: publicUrl,
            filename: filename
        });

    } catch (err) {
        console.error("❌ Video Creation Failed:", err);
        res.status(500).json({ success: false, error: "Failed to generate video: " + err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* 📥 GET /download/:filename — Download Generated Video                      */
/* -------------------------------------------------------------------------- */
router.get("/download/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(outputDir, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ error: "File not found" });
    }
});

module.exports = router;
