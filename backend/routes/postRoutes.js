
/**
 * 🎥 postRoutes.js — Handle post routes
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../utils/auth");
const postController = require("../controllers/postController");

// 🗂️ Ensure temp directories exist
const tempVideoDir = path.join(__dirname, "../../temp/videos");
const tempThumbDir = path.join(__dirname, "../../temp/thumbnails");
if (!fs.existsSync(tempVideoDir)) fs.mkdirSync(tempVideoDir, { recursive: true });
if (!fs.existsSync(tempThumbDir)) fs.mkdirSync(tempThumbDir, { recursive: true });

// 📦 Multer setup (max 500MB) - Save to TEMP
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
    limits: { fileSize: 500 * 1024 * 1024 }, // ✅ 500MB Limit
    fileFilter: (_, file, cb) => {
        if (file.fieldname === "video") {
            const allowed = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
            if (allowed.includes(file.mimetype)) cb(null, true);
            else cb(new Error("Invalid video type — only MP4, WEBM, OGG, MOV allowed."));
        } else if (file.fieldname === "thumbnail") {
            const allowed = ["image/jpeg", "image/png", "image/jpg"];
            if (allowed.includes(file.mimetype)) cb(null, true);
            else cb(new Error("Invalid thumbnail type — only JPG, PNG allowed."));
        } else if (file.fieldname === "images" || file.fieldname === "rightSideImage") {
            const allowed = ["image/jpeg", "image/png", "image/jpg"];
            if (allowed.includes(file.mimetype)) cb(null, true);
            else cb(new Error("Invalid image type — only JPG, PNG allowed."));
        } else {
            cb(new Error(`Unexpected field: ${file.fieldname}`));
        }
    },
});

const { validatePost, validateCarousel } = require("../middleware/validator");

// ============================================================
// ✅ POST /api/posts/create
// ============================================================
router.post("/", requireAuth, upload.any(), validatePost, postController.createPost);

// ✅ Mixed Carousel Route
const { createMixedCarousel } = require("../controllers/carouselController");
router.post(
    "/mixed-carousel",
    requireAuth,
    upload.any(), // Accepts multiple files with different field names
    validateCarousel, // ✅ Validate inputs
    createMixedCarousel
);

// ✅ TikTok Route
const { fetchTikTokVideo } = require("../controllers/tiktokController");
router.post("/tiktok/fetch", requireAuth, fetchTikTokVideo);

// ✅ Job Status Route (Polling)
const jobController = require("../controllers/jobController");
router.get("/job-status/:jobId", requireAuth, jobController.getJobStatus);

module.exports = router;
