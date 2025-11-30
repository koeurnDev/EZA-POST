/**
 * 🕓 schedule.js — Store scheduled Facebook posts for future publishing
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ScheduledPost = require("../../models/ScheduledPost"); // ✅ MongoDB Model
const { requireAuth } = require("../../utils/auth");
const { uploadFile } = require("../../utils/cloudinary"); // ✅ Cloudinary
const router = express.Router();

// 🗂️ Ensure temp directory exists
const tempDir = path.join(__dirname, "../../temp/videos");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// 📦 Multer setup (max 100MB) - Save to TEMP
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, tempDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 10)}${ext}`;
    cb(null, safeName);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit per file
  fileFilter: (_, file, cb) => {
    const allowed = ["video/mp4", "video/webm", "video/ogg", "image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type. Only videos and images are allowed."));
  },
});

/* -------------------------------------------------------------------------- */
/* ✅ POST /api/posts/schedule — Schedule a new post                          */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* ✅ POST /api/posts/schedule — Schedule a new post                          */
/* -------------------------------------------------------------------------- */
router.post("/", requireAuth, upload.array("mediaFiles", 10), async (req, res) => {
  try {
    const { caption, accounts, scheduleTime, postType = "single" } = req.body;
    const userId = req.user?.id;
    const files = req.files || [];

    // 🛑 Validation
    if (!caption || !accounts || !scheduleTime) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    if (files.length === 0)
      return res
        .status(400)
        .json({ success: false, error: "At least one media file is required" });

    // 🕒 Validate schedule time
    const scheduleDate = new Date(scheduleTime);
    if (isNaN(scheduleDate.getTime()) || scheduleDate < new Date()) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or past schedule time" });
    }

    let accountsList = [];
    try {
      accountsList = JSON.parse(accounts);
      if (!Array.isArray(accountsList))
        throw new Error("Accounts must be an array");
    } catch {
      return res
        .status(400)
        .json({ success: false, error: "Invalid accounts format" });
    }

    // 📤 Upload to Cloudinary
    console.log(`📤 Uploading ${files.length} files to Cloudinary...`);
    const uploadPromises = files.map(file =>
      uploadFile(file.path, "kr_post/scheduled", file.mimetype.startsWith("video") ? "video" : "image")
    );

    const results = await Promise.all(uploadPromises);
    const mediaUrls = results.map(r => r.url);
    const videoUrl = postType === "single" ? mediaUrls[0] : undefined;

    // 💾 Store scheduled post (MongoDB)
    const newPost = await ScheduledPost.create({
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, // Generate ID
      user_id: userId, // Match schema
      caption,
      postType,
      video_url: videoUrl, // Only for single video posts
      mediaFiles: mediaUrls, // All files
      thumbnail_url: postType === "single" ? results[0].thumbnail_url || videoUrl : mediaUrls[0], // Simple thumbnail logic
      accounts: accountsList,
      schedule_time: scheduleDate, // Match schema
      status: "scheduled",
    });

    console.log(`📅 Post scheduled by ${userId} for ${scheduleDate}`);

    return res.status(201).json({
      success: true,
      message: "Post scheduled successfully!",
      data: {
        caption,
        postType,
        mediaFiles: mediaUrls,
        accounts: accountsList,
        scheduleTime: scheduleDate,
        postId: newPost.id,
      },
    });
  } catch (err) {
    console.error("❌ Schedule post error:", err.message);
    return res
      .status(500)
      .json({ success: false, error: "Failed to schedule post: " + err.message });
  }
});

module.exports = router;
