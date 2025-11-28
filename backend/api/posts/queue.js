/**
 * 🕒 queue.js — Fetch and manage scheduled posts
 */

const express = require("express");
const router = express.Router();
const ScheduledPost = require("../../models/ScheduledPost"); // ✅ Use correct model
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
    // Note: status might be 'scheduled' or 'processing'
    const posts = await ScheduledPost.find({
      user_id: userId,
      status: { $in: ["scheduled", "processing", "expired"] },
    }).sort({ schedule_time: 1 }); // Ascending order

    // Map to frontend friendly format
    const formattedPosts = posts.map(p => ({
      id: p.id, // Custom ID string
      _id: p._id, // Mongo ID
      caption: p.caption,
      videoUrl: p.video_url,
      thumbnailUrl: p.thumbnail_url, // ✅ Include thumbnail
      scheduleTime: p.schedule_time,
      status: p.status,
      accounts: p.accounts.map(acc => ({ name: acc.name || "Page" })), // Simplified account info
      createdAt: p.createdAt
    }));

    res.json({
      success: true,
      total: formattedPosts.length,
      posts: formattedPosts,
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

    // 🔍 Find and update post (using custom 'id' field or '_id')
    const post = await ScheduledPost.findOne({
      $or: [{ id: id }, { _id: id }],
      user_id: userId
    });

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
