/**
 * ============================================================
 * 📦 /api/upload/upload.js — Safe & Optimized Video Upload API
 * ============================================================
 * ✅ 100MB file size limit
 * ✅ Randomized safe filenames
 * ✅ Validates MIME types
 * ✅ Prevents memory leaks on failed uploads
 * ✅ Supports GET + DELETE for video management
 */

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { requireAuth } = require("../../utils/auth"); // Optional Auth Middleware

const router = express.Router();

// 🗂️ Ensure upload directory exists
const uploadDir = path.join(__dirname, "../../uploads/videos");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// 🎬 Allowed MIME types
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/ogg"];

// 💾 Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 10)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type — only MP4, WEBM, or OGG allowed."));
  },
});

/* -------------------------------------------------------------------------- */
/* ✅ POST /api/upload/video — Upload a new video                             */
/* -------------------------------------------------------------------------- */
router.post("/", requireAuth, upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No video file uploaded.",
      });
    }

    const { filename, size, mimetype } = req.file;

    const fileData = {
      success: true,
      message: "✅ Video uploaded successfully.",
      filename,
      url: `/uploads/videos/${filename}`,
      sizeMB: `${(size / (1024 * 1024)).toFixed(2)} MB`,
      type: mimetype,
      uploadedAt: new Date().toISOString(),
    };

    console.log(`🎬 Uploaded: ${filename} (${fileData.sizeMB})`);

    return res.status(201).json(fileData);
  } catch (err) {
    console.error("❌ Upload error:", err.message);

    // Clean up partial file
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () =>
        console.log(`🧹 Deleted failed upload: ${req.file.filename}`)
      );
    }

    return res.status(500).json({
      success: false,
      error: "Internal upload error.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ GET /api/upload/video — List all uploaded videos                        */
/* -------------------------------------------------------------------------- */
router.get("/", requireAuth, async (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir);
    const videos = files.map((file) => {
      const stats = fs.statSync(path.join(uploadDir, file));
      return {
        name: file,
        url: `/uploads/videos/${file}`,
        sizeMB: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
        uploadedAt: stats.mtime,
      };
    });

    res.json({ success: true, total: videos.length, videos });
  } catch (err) {
    console.error("❌ Failed to list videos:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve video list.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* 🧹 DELETE /api/upload/video/:filename — Remove uploaded video              */
/* -------------------------------------------------------------------------- */
router.delete("/:filename", requireAuth, async (req, res) => {
  try {
    const filePath = path.join(uploadDir, req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "File not found.",
      });
    }

    fs.unlinkSync(filePath);
    console.log(`🗑️ Deleted video: ${req.params.filename}`);

    res.json({ success: true, message: "Video deleted successfully." });
  } catch (err) {
    console.error("❌ Failed to delete video:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to delete video.",
    });
  }
});

module.exports = router;
