/**
 * ============================================================
 * 🔴 liveStreamRoutes.js — Multi-Page Live Stream Endpoints
 * ============================================================
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../utils/auth");
const liveStreamManager = require("../services/liveStreamManager");
const prisma = require("../utils/prisma");

// Multer storage for live stream videos (max 2GB)
const liveVideoDir = path.join(__dirname, "../temp/live_videos");
if (!fs.existsSync(liveVideoDir)) fs.mkdirSync(liveVideoDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, liveVideoDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `live-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2048 * 1024 * 1024 }, // 2GB max
  fileFilter: (req, file, cb) => {
    const allowed = ["video/mp4", "video/webm", "video/quicktime", "video/mkv", "video/x-matroska"];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(mp4|mov|mkv|webm)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid video file type. Only MP4, MOV, MKV, and WEBM are allowed."));
    }
  },
});

// 📋 GET /api/live-stream/pages — List connected pages available for streaming
router.get("/pages", requireAuth, async (req, res) => {
  try {
    const pages = await prisma.facebookPage.findMany({
      where: { userId: req.user.id, isConnected: true },
      select: {
        id: true,
        name: true,
        category: true,
        picture: true,
        followersCount: true,
      },
    });
    res.json({ success: true, pages });
  } catch (err) {
    console.error("❌ [LiveStream] GET /pages error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📡 GET /api/live-stream/active — Get user's active live broadcasts
router.get("/active", requireAuth, (req, res) => {
  try {
    const activeSessions = liveStreamManager.getUserBroadcasts(req.user.id);
    res.json({ success: true, activeSessions });
  } catch (err) {
    console.error("❌ [LiveStream] GET /active error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🚀 POST /api/live-stream/start — Start multi-page broadcast
router.post("/start", requireAuth, upload.single("video"), async (req, res) => {
  try {
    let { title, description, pageIds, loop, existingVideoPath } = req.body;

    let videoPath = null;
    if (req.file) {
      videoPath = req.file.path;
    } else if (existingVideoPath) {
      // Validate safe path inside temp directory
      const safeRelative = path.basename(existingVideoPath);
      const possiblePath = path.join(__dirname, "../temp", safeRelative);
      const possibleVideosPath = path.join(__dirname, "../temp/videos", safeRelative);
      const possibleLivePath = path.join(liveVideoDir, safeRelative);

      if (fs.existsSync(possibleLivePath)) videoPath = possibleLivePath;
      else if (fs.existsSync(possibleVideosPath)) videoPath = possibleVideosPath;
      else if (fs.existsSync(possiblePath)) videoPath = possiblePath;
      else if (fs.existsSync(existingVideoPath)) videoPath = existingVideoPath;
    }

    if (!videoPath || !fs.existsSync(videoPath)) {
      return res.status(400).json({
        success: false,
        error: "Please upload a video file or provide a valid existing video file path.",
      });
    }

    // Parse pageIds
    if (typeof pageIds === "string") {
      try {
        pageIds = JSON.parse(pageIds);
      } catch (e) {
        pageIds = pageIds.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }

    if (!Array.isArray(pageIds) || pageIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please select at least 1 Facebook page to stream to.",
      });
    }

    const broadcastResult = await liveStreamManager.startBroadcast(req.user.id, {
      title: title || "Facebook Live Stream",
      description: description || "",
      videoPath,
      pageIds,
      loop: loop !== undefined ? loop : 1,
    });

    res.json(broadcastResult);
  } catch (err) {
    console.error("❌ [LiveStream] POST /start error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ⏹️ POST /api/live-stream/stop/:sessionId — End broadcast
router.post("/stop/:sessionId", requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await liveStreamManager.stopBroadcast(req.user.id, sessionId);
    res.json(result);
  } catch (err) {
    console.error("❌ [LiveStream] POST /stop error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

