/**
 * 🕒 queue.js — Fetch and manage scheduled posts
 */

const express = require("express");
const router = express.Router();
const Post = require("../../models/Post"); // ✅ MongoDB Model
const { requireAuth } = require("../../utils/auth");

/* -------------------------------------------------------------------------- */
/* ✅ GET /api/posts/queue — Get user’s scheduled posts                       */
/* -------------------------------------------------------------------------- */
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    // 🔍 Fetch scheduled posts from MongoDB
    const posts = await Post.find({
      userId,
      status: "scheduled",
    }).sort({ scheduleTime: 1 }); // Ascending order

    res.json({
      success: true,
      total: posts.length,
      posts,
    });
  } catch (err) {
    console.error("❌ Fetch queue error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch queue" });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ DELETE /api/posts/queue/:id — Cancel a scheduled post                   */
/* -------------------------------------------------------------------------- */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    // 🔍 Find and update post
    const post = await Post.findOne({ _id: id, userId });

    if (!post)
      return res.status(404).json({ success: false, error: "Post not found" });

    // 🛑 Mark as cancelled
    post.status = "cancelled";
    await post.save();

    console.log(`🛑 Post ${id} cancelled by ${userId}`);

    res.json({
      success: true,
      message: "Post cancelled successfully",
      cancelledPost: post,
    });
  } catch (err) {
    console.error("❌ Cancel queue error:", err);
    res.status(500).json({ success: false, error: "Failed to cancel post" });
  }
});

module.exports = router;
