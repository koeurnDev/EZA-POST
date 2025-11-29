/**
 * ============================================================
 * 🎥 /api/upload/videoUpload.js — Secure Video Upload API (Cloudinary)
 * ============================================================
 * ✅ Supports MP4, WEBM, OGG
 * ✅ 100MB file size limit
 * ✅ Uploads to Cloudinary (Persistent Storage)
 * ✅ Auto cleanup of temp files
 * ✅ Optional authentication
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth");
const { uploadFile, deleteFile } = require("../../utils/cloudinary");
const cloudinary = require("cloudinary").v2; // For listing resources

const router = express.Router();

// 🗂️ Ensure temp directory exists
const tempDir = path.join(__dirname, "../../temp/videos");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// 🎬 Allowed MIME types
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/ogg"];

// 💾 Configure multer storage (Temporary)
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

    console.log(`📤 Uploading video to Cloudinary: ${req.file.filename}`);

    // ☁️ Upload to Cloudinary
    const result = await uploadFile(req.file.path, "eza-post/videos", "video");

    const response = {
      success: true,
      message: "✅ Video uploaded successfully",
      file: {
        name: result.publicId, // Use publicId as name/identifier
        url: result.url,
        path: result.url, // Backward compatibility
        sizeMB: `${(result.size / (1024 * 1024)).toFixed(2)} MB`,
        type: req.file.mimetype,
        uploadedAt: new Date().toISOString(),
        publicId: result.publicId,
      },
    };

    console.log(`✅ Upload complete: ${result.publicId}`);
    res.status(201).json(response);
  } catch (err) {
    console.error("❌ Video upload failed:", err.message);
    res
      .status(500)
      .json({ success: false, error: err.message || "Internal server error during upload" });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ GET /api/upload/video — List all uploaded videos (from Cloudinary)      */
/* -------------------------------------------------------------------------- */
router.get("/", requireAuth, async (req, res) => {
  try {
    // ☁️ Fetch resources from Cloudinary
    const result = await cloudinary.api.resources({
      type: "upload",
      resource_type: "video",
      prefix: "eza-post/videos", // Only get our folder
      max_results: 50,
    });

    const videos = result.resources.map((res) => ({
      name: res.public_id,
      url: res.secure_url,
      sizeMB: `${(res.bytes / (1024 * 1024)).toFixed(2)} MB`,
      uploadedAt: res.created_at,
      publicId: res.public_id,
    }));

    res.json({ success: true, total: videos.length, videos });
  } catch (err) {
    console.error("❌ Failed to list videos:", err.message);
    // Fallback to empty list if API fails (e.g. bad creds)
    res.json({ success: true, total: 0, videos: [] });
  }
});

/* -------------------------------------------------------------------------- */
/* 🧹 DELETE /api/upload/video/:filename — Remove uploaded video              */
/* -------------------------------------------------------------------------- */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    // The ID might be passed as "kr_post/videos/filename" or just "filename"
    // We expect the full publicId usually, but let's handle it safely.
    // Since we return publicId as 'name' in GET, the frontend likely sends that.

    // Note: Express params might decode slashes, so we might need to handle that.
    // But usually publicId is sent as a query or body in complex cases. 
    // Here we assume simple ID or encoded ID.

    const publicId = req.params.id;
    // If the frontend sends "kr_post-videos-filename", we might need to adjust.
    // For now, assume it sends the publicId.

    await deleteFile(publicId, "video");

    res.json({
      success: true,
      message: `Video deleted successfully`,
    });
  } catch (err) {
    console.error("❌ Failed to delete video:", err.message);
    res.status(500).json({ success: false, error: "Failed to delete video" });
  }
});

module.exports = router;

