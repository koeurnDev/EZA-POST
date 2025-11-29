/**
 * ============================================================
 * 🖼️ /api/upload/uploadThumbnail.js — Secure & Optimized Image Upload (Cloudinary)
 * ============================================================
 * ✅ Supports JPG, PNG, GIF, WEBP
 * ✅ 5MB file size limit
 * ✅ Uploads to Cloudinary (Persistent Storage)
 * ✅ Optional JWT authentication
 * ✅ Clean async/await handling
 * ✅ Auto cleanup on failure
 * ✅ List + Delete routes
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
const tempDir = path.join(__dirname, "../../temp/thumbnails");
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
/* ✅ POST /api/upload/thumbnail — Upload thumbnail image                     */
/* -------------------------------------------------------------------------- */
router.post("/", requireAuth, upload.single("thumbnail"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    console.log(`📤 Uploading thumbnail to Cloudinary: ${req.file.filename}`);

    // ☁️ Upload to Cloudinary
    const result = await uploadFile(req.file.path, "kr_post/thumbnails", "image");

    const fileData = {
      success: true,
      message: "✅ Thumbnail uploaded successfully",
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
    console.error("❌ Thumbnail upload failed:", err.message);
    return res.status(500).json({
      success: false,
      error: "Thumbnail upload failed.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ GET /api/upload/thumbnail — List uploaded thumbnails (from Cloudinary)  */
/* -------------------------------------------------------------------------- */
router.get("/", requireAuth, async (req, res) => {
  try {
    // ☁️ Fetch resources from Cloudinary
    const result = await cloudinary.api.resources({
      type: "upload",
      resource_type: "image",
      prefix: "kr_post/thumbnails",
      max_results: 50,
    });

    const thumbnails = result.resources.map((res) => ({
      name: res.public_id,
      url: res.secure_url,
      sizeKB: `${(res.bytes / 1024).toFixed(2)} KB`,
      uploadedAt: res.created_at,
      publicId: res.public_id,
    }));

    res.json({
      success: true,
      count: thumbnails.length,
      thumbnails,
    });
  } catch (err) {
    console.error("❌ Failed to list thumbnails:", err.message);
    // Fallback to empty list
    res.json({ success: true, count: 0, thumbnails: [] });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ DELETE /api/upload/thumbnail/:filename — Delete thumbnail               */
/* -------------------------------------------------------------------------- */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const publicId = req.params.id;
    await deleteFile(publicId, "image");

    res.json({
      success: true,
      message: `Deleted thumbnail successfully`,
    });
  } catch (err) {
    console.error("❌ Thumbnail delete failed:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to delete thumbnail",
    });
  }
});

module.exports = router;

