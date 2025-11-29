const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth");
const { uploadFile } = require("../../utils/cloudinary");

const router = express.Router();

// 🗂️ Ensure temp directory exists
const tempDir = path.join(__dirname, "../../temp/covers");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// 🎨 Allowed MIME types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// 💾 Configure multer disk storage (Temporary)
const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, tempDir),
    filename: (_, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = `${Date.now()}-${Math.random()
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
/* ✅ POST /api/upload/cover — Upload cover image                             */
/* -------------------------------------------------------------------------- */
router.post("/", requireAuth, upload.single("cover"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "No file uploaded",
            });
        }

        console.log(`📤 Uploading cover to Cloudinary: ${req.file.filename}`);

        // ☁️ Upload to Cloudinary
        const result = await uploadFile(req.file.path, "kr_post/covers", "image");

        const fileData = {
            success: true,
            message: "✅ Cover image uploaded successfully",
            file: {
                name: result.publicId,
                url: result.url,
                path: result.url,
                sizeKB: `${(result.size / 1024).toFixed(2)} KB`,
                type: req.file.mimetype,
                uploadedAt: new Date().toISOString(),
                publicId: result.publicId,
            },
        };

        console.log(`🖼️ Upload complete: ${result.publicId}`);
        return res.status(201).json(fileData);
    } catch (err) {
        console.error("❌ Cover upload failed:", err.message);
        return res.status(500).json({
            success: false,
            error: "Cover upload failed.",
        });
    }
});

module.exports = router;

