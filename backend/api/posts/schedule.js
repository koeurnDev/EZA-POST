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
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ["video/mp4", "video/webm", "video/ogg"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid video type — only MP4, WEBM, or OGG allowed."));
  },
});

/* -------------------------------------------------------------------------- */
/* ✅ POST /api/posts/schedule — Schedule a new post                          */
/* -------------------------------------------------------------------------- */
router.post("/", requireAuth, upload.single("video"), async (req, res) => {
  try {
    const { caption, accounts, scheduleTime } = req.body;
    const userId = req.user?.id;
    const file = req.file;

    // 🛑 Validation
    if (!caption || !accounts || !scheduleTime) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    if (!file)
      return res
        .status(400)
        .json({ success: false, error: "Video file is required" });

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
    console.log(`📤 Uploading scheduled video to Cloudinary: ${file.filename}`);
    const result = await uploadFile(file.path, "kr_post/videos", "video");
    const videoUrl = result.url;
    // Local file is deleted by uploadFile utility

    // 💾 Store scheduled post (MongoDB)
    const newPost = await ScheduledPost.create({
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, // Generate ID
      user_id: userId, // Match schema
      caption,
      video_url: videoUrl, // Match schema
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
        videoUrl,
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
