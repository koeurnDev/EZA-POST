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
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// 📦 Multer setup (max 100MB)
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
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
    else cb(new Error("Invalid file type — only MP4, WEBM, or OGG allowed."));
  },
});

// ============================================================
// ✅ POST /api/posts/create
// ============================================================
router.post("/", requireAuth, upload.single("video"), async (req, res) => {
  try {
    const { caption, accounts } = req.body;
    const userId = req.user?.id;
    const file = req.file;

    // 🛑 Validate fields
    if (!file)
      return res
        .status(400)
        .json({ success: false, error: "No video file uploaded" });

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

    // 💾 Save post record (MongoDB)
    const filename = file.filename;
    const videoUrl = `/uploads/videos/${filename}`;
    const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const newPost = await ScheduledPost.create({
      id: postId,
      user_id: userId,
      caption,
      video_url: videoUrl,
      accounts: accountsArray,
      schedule_time: new Date(), // Now
      status: "processing",
    });

    console.log(`✅ New post created by ${userId}: ${caption}`);

    // 🚀 Trigger Immediate Upload
    const User = require("../../models/User");
    const fb = require("../../utils/fb");
    const fs = require("fs");

    // Get User Token
    const user = await User.findOne({ id: userId });
    if (!user || !user.facebookAccessToken) {
      throw new Error("User not connected to Facebook");
    }

    // Read Video Buffer
    const videoBuffer = fs.readFileSync(file.path);

    // Upload
    const results = await fb.postToFB(
      user.facebookAccessToken,
      accountsArray.map(id => ({ id, type: 'page' })),
      videoBuffer,
      caption
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
        url: videoUrl,
        name: filename,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      },
      caption,
      accounts: accountsArray,
      postId: newPost.id,
    });
  } catch (err) {
    console.error("❌ Create post error:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to create post",
    });
  }
});

module.exports = router;
