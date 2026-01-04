/**
 * ============================================================
 * 🤖 /api/upload/bot-image — Upload Image for Auto-Reply Bot
 * ============================================================
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth");
const { uploadFile, deleteFile } = require("../../utils/cloudinary");
const cloudinary = require("cloudinary").v2;

const router = express.Router();

// 🗂️ Ensure temp directory exists
const tempDir = path.join(__dirname, "../../temp/bot");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// 🎨 Allowed MIME types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// 💾 Configure multer disk storage (Temporary)
const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, tempDir),
    filename: (_, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = `bot-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)}${ext}`;
        cb(null, safeName);
    },
});

// 🧱 Multer upload configuration (limit 5MB)
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_, file, cb) => {
        if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
        else cb(new Error("Invalid file type — only JPG, PNG, GIF, or WEBP allowed."));
    },
});

/* -------------------------------------------------------------------------- */
/* ✅ POST /api/upload/bot-image                                              */
/* -------------------------------------------------------------------------- */
router.post("/", requireAuth, upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "No file uploaded",
            });
        }

        console.log(`📤 Uploading bot image to Cloudinary: ${req.file.filename}`);

        // ☁️ Upload to Cloudinary (Folder: kr_post/bot_replies)
        const result = await uploadFile(req.file.path, "kr_post/bot_replies", "image");

        const fileData = {
            success: true,
            message: "✅ Bot image uploaded successfully",
            url: result.url,
            publicId: result.publicId,
        };

        console.log(`🖼️ Upload complete: ${result.publicId}`);
        return res.status(201).json(fileData);
    } catch (err) {
        console.error("❌ Bot image upload failed:", err.message);
        return res.status(500).json({
            success: false,
            error: "Bot image upload failed.",
        });
    }
});

module.exports = router;
