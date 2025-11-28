/**
 * 🎥 create.js — Handle immediate post creation
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ScheduledPost = require("../../models/ScheduledPost"); // ✅ MongoDB Model
const { requireAuth } = require("../../utils/auth");

// 🗂️ Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../../uploads/videos");
const thumbDir = path.join(__dirname, "../../uploads/thumbnails");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

// 📦 Multer setup (max 100MB)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "thumbnail") cb(null, thumbDir);
    else cb(null, uploadDir);
  },
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
    if (file.fieldname === "video") {
      const allowed = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error("Invalid video type — only MP4, WEBM, OGG, MOV allowed."));
    } else if (file.fieldname === "thumbnail") {
      const allowed = ["image/jpeg", "image/png", "image/jpg"];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error("Invalid thumbnail type — only JPG, PNG allowed."));
    } else {
      cb(new Error("Unexpected field"));
    }
  },
});

// ============================================================
// ✅ POST /api/posts/create
// ============================================================
router.post("/", requireAuth, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), async (req, res) => {
  try {
    const { caption, accounts, scheduleTime, tiktokUrl } = req.body; // ✅ Added tiktokUrl
    const userId = req.user?.id;

    // Multer fields
    const videoFile = req.files?.['video']?.[0];
    const thumbFile = req.files?.['thumbnail']?.[0];

    // 🛑 Validate fields
    if (!videoFile && !tiktokUrl) // ✅ Allow tiktokUrl
      return res
        .status(400)
        .json({ success: false, error: "No video file or TikTok URL provided" });

    if (!caption || !accounts)
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });

    let accountsArray = [];
    try {
      accountsArray = JSON.parse(accounts);
      if (!Array.isArray(accountsArray)) throw new Error("Invalid accounts format");
    } catch {
      return res.status(400).json({ success: false, error: "Invalid accounts JSON" });
    }

    // 📥 Handle Video Source (File vs TikTok)
    let videoBuffer;
    let filename;
    let videoUrlForDB;
    let videoSizeMB = 0;

    if (videoFile) {
      // 📂 Local File Upload
      videoBuffer = fs.readFileSync(videoFile.path);
      filename = videoFile.filename;
      videoUrlForDB = `/uploads/videos/${filename}`;
      videoSizeMB = videoFile.size / (1024 * 1024);
    } else if (tiktokUrl) {
      // 🎵 TikTok Download
      console.log(`📥 Downloading TikTok video: ${tiktokUrl}`);
      const tiktokDownloader = require("../../utils/tiktokDownloader");

      try {
        const downloadResult = await tiktokDownloader.downloadTiktokVideo(tiktokUrl);
        videoBuffer = downloadResult; // It returns buffer directly based on my check

        // Save to disk for serving
        filename = `tiktok_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.mp4`;
        const savePath = path.join(uploadDir, filename);
        fs.writeFileSync(savePath, videoBuffer);

        videoUrlForDB = `/uploads/videos/${filename}`;
        videoSizeMB = videoBuffer.length / (1024 * 1024);
      } catch (err) {
        console.error("❌ TikTok download failed:", err.message);
        return res.status(400).json({ success: false, error: "Failed to download TikTok video: " + err.message });
      }
    }

    // 💾 Save post record (MongoDB)
    const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const newPost = await ScheduledPost.create({
      id: postId,
      user_id: userId,
      caption,
      video_url: videoUrlForDB,
      thumbnail_url: thumbFile ? `/uploads/thumbnails/${thumbFile.filename}` : null,
      accounts: accountsArray,
      schedule_time: scheduleTime ? new Date(scheduleTime) : new Date(),
      status: "processing",
      is_scheduled: !!scheduleTime,
    });

    console.log(`✅ New post created by ${userId}: ${caption}`);

    // 🚀 Trigger Immediate Upload
    const User = require("../../models/User");
    const fb = require("../../utils/fb");

    // Get User Token
    const user = await User.findOne({ id: userId });
    if (!user || !user.facebookAccessToken) {
      throw new Error("User not connected to Facebook");
    }

    // Prepare Thumbnail
    let thumbnailObj = null;
    if (thumbFile) {
      const thumbBuffer = fs.readFileSync(thumbFile.path);
      thumbnailObj = { buffer: thumbBuffer };
    }

    // Upload
    const results = await fb.postToFB(
      user.facebookAccessToken,
      accountsArray.map(id => ({ id, type: 'page' })), // Assuming all are pages for now, or logic handles it
      videoBuffer,
      caption,
      thumbnailObj,
      {
        isScheduled: !!scheduleTime,
        scheduleTime: scheduleTime ? Math.floor(new Date(scheduleTime).getTime() / 1000) : null
      }
    );

    // Update Status
    const successCount = results.successCount;
    newPost.status = successCount > 0 ? "completed" : "failed";
    newPost.posted_at = new Date();
    if (results.details) {
      newPost.publishedIds = results.details
        .filter(r => r.status === 'success' && r.postId)
        .map(r => ({ accountId: r.accountId, postId: r.postId }));
    }
    await newPost.save();

    // ✅ Respond success
    res.status(201).json({
      success: true,
      message: successCount > 0 ? "Post published successfully" : "Failed to publish post",
      results: results,
      video: {
        url: videoUrlForDB,
        name: filename,
        size: `${videoSizeMB.toFixed(2)} MB`,
      },
      caption,
      accounts: accountsArray,
      postId: newPost.id,
    });
  } catch (err) {
    console.error("❌ Create post error:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to create post: " + err.message,
    });
  }
});

module.exports = router;
