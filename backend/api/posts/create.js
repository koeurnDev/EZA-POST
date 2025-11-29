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
const { uploadFile } = require("../../utils/cloudinary"); // ✅ Cloudinary

// 🗂️ Ensure temp directories exist
const tempVideoDir = path.join(__dirname, "../../temp/videos");
const tempThumbDir = path.join(__dirname, "../../temp/thumbnails");
if (!fs.existsSync(tempVideoDir)) fs.mkdirSync(tempVideoDir, { recursive: true });
if (!fs.existsSync(tempThumbDir)) fs.mkdirSync(tempThumbDir, { recursive: true });

// 📦 Multer setup (max 100MB) - Save to TEMP
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "thumbnail") cb(null, tempThumbDir);
    else cb(null, tempVideoDir);
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
router.post("/", requireAuth, upload.any(), async (req, res) => {
  try {
    const { caption, accounts, scheduleTime, tiktokUrl, directMediaUrl, postType, carouselCards } = req.body;
    const userId = req.user?.id;

    // 🛑 Validate fields
    if (postType === 'carousel') {
      if (!carouselCards || !accounts) return res.status(400).json({ success: false, error: "Missing carousel cards or accounts" });
    } else {
      // Single Post Validation
      const videoFile = req.files?.find(f => f.fieldname === 'video');
      if (!videoFile && !directMediaUrl && !tiktokUrl && !caption)
        return res
          .status(400)
          .json({ success: false, error: "No media, link, or caption provided" });
    }

    if (!accounts)
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
    const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    let newPostData = {
      id: postId,
      user_id: userId,
      caption,
      accounts: accountsArray,
      schedule_time: scheduleTime ? new Date(scheduleTime) : new Date(),
      status: "processing",
      is_scheduled: !!scheduleTime,
      type: postType === 'carousel' ? 'carousel' : (directMediaUrl || req.files?.find(f => f.fieldname === 'video') ? "media" : "link")
    };

    // 🚀 Trigger Immediate Upload
    const User = require("../../models/User");
    const fb = require("../../utils/fb");

    // Get User Token
    const user = await User.findOne({ id: userId });
    if (!user || !user.facebookAccessToken) {
      throw new Error("User not connected to Facebook");
    }

    let results;
    let videoUrlForDB = null;
    let thumbnailUrlForDB = null;
    let videoSizeMB = 0;
    let videoPublicId;

    if (postType === 'carousel') {
      // 🎠 Handle Carousel
      let parsedCards = [];
      try {
        parsedCards = JSON.parse(carouselCards);
      } catch (e) {
        throw new Error("Invalid carousel cards JSON");
      }

      // Upload Card Media to Cloudinary
      const processedCards = await Promise.all(parsedCards.map(async (card) => {
        const cardFile = req.files?.find(f => f.fieldname === `file_${card.id}`);
        const cardThumbnail = req.files?.find(f => f.fieldname === `thumbnail_${card.id}`);
        let mediaUrl = null;
        let thumbnailUrl = null;

        // 1. Handle Main Media (File vs Remote URL)
        if (cardFile) {
          console.log(`📤 Uploading carousel card media: ${cardFile.filename}`);
          const result = await uploadFile(cardFile.path, "kr_post/carousel", card.type === 'video' ? 'video' : 'image');
          mediaUrl = result.url;
        } else if (card.previewUrl) {
          // Use remote URL (e.g. from TikTok import)
          mediaUrl = card.previewUrl;
        }

        // 2. Handle Custom Thumbnail
        if (cardThumbnail) {
          console.log(`📤 Uploading carousel card thumbnail: ${cardThumbnail.filename}`);
          const thumbResult = await uploadFile(cardThumbnail.path, "kr_post/thumbnails", "image");
          thumbnailUrl = thumbResult.url;
        }

        return {
          ...card,
          url: mediaUrl, // Add Cloudinary URL (or remote URL) to card
          thumbnailUrl: thumbnailUrl // Add custom thumbnail URL
        };
      }));

      newPostData.carousel_cards = processedCards; // Save to DB (need to update Schema later)

      // Publish Carousel
      results = await fb.postCarousel(
        user.getDecryptedAccessToken(),
        accountsArray.map(id => ({ id, type: 'page' })),
        caption,
        processedCards,
        {
          isScheduled: !!scheduleTime,
          scheduleTime: scheduleTime ? Math.floor(new Date(scheduleTime).getTime() / 1000) : null
        }
      );

    } else {
      // 🎥 Handle Single Post
      const videoFile = req.files?.find(f => f.fieldname === 'video');
      const thumbFile = req.files?.find(f => f.fieldname === 'thumbnail');

      if (videoFile) {
        // 📂 Local File Upload -> Cloudinary
        console.log(`📤 Uploading local video to Cloudinary: ${videoFile.filename}`);
        const videoResult = await uploadFile(videoFile.path, "kr_post/videos", "video");
        videoUrlForDB = videoResult.url;
        videoPublicId = videoResult.public_id;
        videoSizeMB = videoFile.size / (1024 * 1024);

        if (thumbFile) {
          console.log(`📤 Uploading thumbnail to Cloudinary...`);
          const result = await uploadFile(thumbFile.path, "kr_post/thumbnails", "image");
          thumbnailUrlForDB = result.url;
        }
      } else if (directMediaUrl) {
        videoUrlForDB = directMediaUrl;
      }

      newPostData.video_url = videoUrlForDB || tiktokUrl;
      newPostData.thumbnail_url = thumbnailUrlForDB;

      // Publish Single Post
      results = await fb.postToFB(
        user.getDecryptedAccessToken(),
        accountsArray.map(id => ({ id, type: 'page' })),
        videoUrlForDB,
        caption,
        null, // Thumbnail buffer not used for Cloudinary flow usually, but we could pass it if needed
        {
          isScheduled: !!scheduleTime,
          scheduleTime: scheduleTime ? Math.floor(new Date(scheduleTime).getTime() / 1000) : null,
          link: tiktokUrl
        }
      );
    }

    const newPost = await ScheduledPost.create(newPostData);

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
        name: videoPublicId,
        size: videoSizeMB ? `${videoSizeMB.toFixed(2)} MB` : "0 MB",
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
