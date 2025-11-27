/**
 * ============================================================
 * 🎥 /api/upload/videoUpload.js — Secure Video Upload API
 * ============================================================
 * ✅ Supports MP4, WEBM, OGG
 * ✅ 100MB file size limit
 * ✅ Randomized secure filenames
 * ✅ Validates MIME types
 * ✅ Auto cleanup on failure
 * ✅ Optional authentication
 * ✅ Supports GET for video listing
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth"); // optional middleware

const router = express.Router();

// 🗂️ Ensure upload directory exists
const uploadDir = path.join(__dirname, "../../uploads/videos");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// 🎬 Allowed MIME types
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/ogg"];

// 💾 Configure multer storage
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

// 🧱 Configure multer upload (100MB max)
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
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
      return res
        .status(400)
        .json({ success: false, error: "No video file uploaded" });
    }

    const { filename, size, mimetype } = req.file;
    const fileUrl = `/uploads/videos/${filename}`;
    const fullUrl = `${req.protocol}://${req.get("host")}${fileUrl}`;

    const response = {
      success: true,
      message: "✅ Video uploaded successfully",
      file: {
        name: filename,
        url: fullUrl,
        path: fileUrl,
        sizeMB: `${(size / (1024 * 1024)).toFixed(2)} MB`,
        type: mimetype,
        uploadedAt: new Date().toISOString(),
      },
    };

    console.log(`🎬 Uploaded video: ${filename} (${response.file.sizeMB})`);
    res.status(201).json(response);
  } catch (err) {
    console.error("❌ Video upload failed:", err.message);

    // 🧹 Clean up file if something failed
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () =>
        console.log(`🧹 Deleted failed upload: ${req.file.filename}`)
      );
    }

    res
      .status(500)
      .json({ success: false, error: "Internal server error during upload" });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ GET /api/upload/video — List all uploaded videos                        */
/* -------------------------------------------------------------------------- */
router.get("/", requireAuth, async (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir);
    const videos = files.map((f) => {
      const stat = fs.statSync(path.join(uploadDir, f));
      return {
        name: f,
        url: `${req.protocol}://${req.get("host")}/uploads/videos/${f}`,
        sizeMB: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
        uploadedAt: stat.mtime,
      };
    });

    res.json({ success: true, total: videos.length, videos });
  } catch (err) {
    console.error("❌ Failed to list videos:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve video list",
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
      return res
        .status(404)
        .json({ success: false, error: "File not found" });
    }

    fs.unlinkSync(filePath);
    console.log(`🗑️ Deleted video: ${req.params.filename}`);
    res.json({
      success: true,
      message: `Video ${req.params.filename} deleted successfully`,
    });
  } catch (err) {
    console.error("❌ Failed to delete video:", err.message);
    res.status(500).json({ success: false, error: "Failed to delete video" });
  }
});

module.exports = router;
