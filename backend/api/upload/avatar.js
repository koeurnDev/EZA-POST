const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth");

const router = express.Router();

// 🗂️ Ensure upload directory exists
const uploadDir = path.join(__dirname, "../../uploads/avatars");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// 🎨 Allowed MIME types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// 💾 Configure multer disk storage
const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadDir),
    filename: (_, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = `${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)}${ext}`;
        cb(null, safeName);
    },
});

// 🧱 Multer upload configuration (limit 2MB for avatars)
const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit for avatars
    fileFilter: (_, file, cb) => {
        if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
        else cb(new Error("Invalid file type — only JPG, PNG, GIF, or WEBP allowed."));
    },
});

/* -------------------------------------------------------------------------- */
/* ✅ POST /api/upload/avatar — Upload avatar image                           */
/* -------------------------------------------------------------------------- */
router.post("/", requireAuth, upload.single("avatar"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "No file uploaded",
            });
        }

        const { filename, size, mimetype } = req.file;
        const relativePath = `/uploads/avatars/${filename}`;
        const fullUrl = `${req.protocol}://${req.get("host")}${relativePath}`;

        const fileData = {
            success: true,
            message: "✅ Avatar uploaded successfully",
            file: {
                name: filename,
                url: fullUrl,
                path: relativePath,
                sizeKB: `${(size / 1024).toFixed(2)} KB`,
                type: mimetype,
                uploadedAt: new Date().toISOString(),
            },
        };

        console.log(`🖼️ Uploaded avatar: ${filename} (${fileData.file.sizeKB})`);
        return res.status(201).json(fileData);
    } catch (err) {
        console.error("❌ Avatar upload failed:", err.message);

        // 🧹 Clean up partial upload
        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, () =>
                console.log(`🧹 Deleted failed upload: ${req.file.filename}`)
            );
        }

        return res.status(500).json({
            success: false,
            error: "Avatar upload failed.",
        });
    }
});

module.exports = router;
