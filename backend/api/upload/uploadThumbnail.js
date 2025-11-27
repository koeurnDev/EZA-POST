/**
 * ============================================================
 * 🖼️ /api/upload/uploadThumbnail.js — Secure & Optimized Image Upload
 * ============================================================
 * ✅ Supports JPG, PNG, GIF, WEBP
 * ✅ 5MB file size limit
 * ✅ Randomized secure filenames
 * ✅ Optional JWT authentication
 * ✅ Clean async/await handling
 * ✅ Auto cleanup on failure
 * ✅ List + Delete routes
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth"); // optional auth protection

const router = express.Router();

// 🗂️ Ensure upload directory exists
const uploadDir = path.join(__dirname, "../../uploads/thumbnails");
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

    const { filename, size, mimetype } = req.file;
    const relativePath = `/uploads/thumbnails/${filename}`;
    const fullUrl = `${req.protocol}://${req.get("host")}${relativePath}`;

    const fileData = {
      success: true,
      message: "✅ Thumbnail uploaded successfully",
      file: {
        name: filename,
        url: fullUrl,
        path: relativePath,
        sizeKB: `${(size / 1024).toFixed(2)} KB`,
        type: mimetype,
        uploadedAt: new Date().toISOString(),
      },
    };

    console.log(`🖼️ Uploaded thumbnail: ${filename} (${fileData.file.sizeKB})`);
    return res.status(201).json(fileData);
  } catch (err) {
    console.error("❌ Thumbnail upload failed:", err.message);

    // 🧹 Clean up partial upload
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () =>
        console.log(`🧹 Deleted failed upload: ${req.file.filename}`)
      );
    }

    return res.status(500).json({
      success: false,
      error: "Thumbnail upload failed.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ GET /api/upload/thumbnail — List uploaded thumbnails                    */
/* -------------------------------------------------------------------------- */
router.get("/", requireAuth, async (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir);
    const thumbnails = files.map((file) => {
      const stats = fs.statSync(path.join(uploadDir, file));
      return {
        name: file,
        url: `${req.protocol}://${req.get("host")}/uploads/thumbnails/${file}`,
        sizeKB: `${(stats.size / 1024).toFixed(2)} KB`,
        uploadedAt: stats.mtime,
      };
    });

    res.json({
      success: true,
      count: thumbnails.length,
      thumbnails,
    });
  } catch (err) {
    console.error("❌ Failed to list thumbnails:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to list thumbnails",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ DELETE /api/upload/thumbnail/:filename — Delete thumbnail               */
/* -------------------------------------------------------------------------- */
router.delete("/:filename", requireAuth, async (req, res) => {
  try {
    const filePath = path.join(uploadDir, req.params.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "Thumbnail not found",
      });
    }

    fs.unlinkSync(filePath);
    console.log(`🗑️ Deleted thumbnail: ${req.params.filename}`);

    res.json({
      success: true,
      message: `Deleted ${req.params.filename}`,
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
