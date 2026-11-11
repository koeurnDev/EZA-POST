/**
 * ============================================================
 * 🧹 pageCleanerRoutes.js — Routes for Bulk Post Deletion
 * ============================================================
 */

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../utils/auth");
const pageCleanerService = require("../services/pageCleanerService");

// 📋 GET /api/page-cleaner/pages — Get all connected pages for user
router.get("/pages", requireAuth, async (req, res) => {
  try {
    const pages = await pageCleanerService.getUserPages(req.user.id);
    res.json({ success: true, pages });
  } catch (err) {
    console.error("❌ [PageCleaner] GET /pages error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔍 GET /api/page-cleaner/posts/:pageId — Fetch published posts
router.get("/posts/:pageId", requireAuth, async (req, res) => {
  try {
    const { pageId } = req.params;
    const { limit, after, before, since, until } = req.query;

    const data = await pageCleanerService.getPagePosts(req.user.id, pageId, {
      limit: limit ? parseInt(limit, 10) : 50,
      after,
      before,
      since,
      until,
    });

    res.json({ success: true, ...data });
  } catch (err) {
    console.error("❌ [PageCleaner] GET /posts/:pageId error:", err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// 🗑️ POST /api/page-cleaner/delete — Batch delete posts
router.post("/delete", requireAuth, async (req, res) => {
  try {
    const { pageId, postIds, confirmation } = req.body;

    if (!pageId) {
      return res.status(400).json({ success: false, error: "Missing pageId" });
    }

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({ success: false, error: "Please select at least 1 post to delete" });
    }

    if (confirmation !== "DELETE" && confirmation !== "លុប") {
      return res.status(400).json({
        success: false,
        error: "Confirmation string must be 'DELETE' or 'លុប'",
      });
    }

    const result = await pageCleanerService.batchDelete(req.user.id, pageId, postIds);
    res.json(result);
  } catch (err) {
    console.error("❌ [PageCleaner] POST /delete error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

