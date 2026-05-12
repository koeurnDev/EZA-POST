/**
 * 🕒 queue.js — Fetch and manage scheduled posts
 */

const express = require("express");
const router = express.Router();
const prisma = require('../../utils/prisma');
const { requireAuth } = require("../../utils/auth");

/* -------------------------------------------------------------------------- */
/* ✅ GET /api/posts/queue — Get user’s scheduled posts                       */
/* -------------------------------------------------------------------------- */
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    // 🔍 Fetch User to get Connected Pages (for mapping IDs to Names/Avatars)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { facebookPages: true }
    });

    const pageMap = {};
    if (user?.facebookPages) {
      user.facebookPages.forEach(p => {
        pageMap[p.id] = { name: p.name, picture: p.picture };
      });
    }

    // 🔍 Fetch scheduled posts from Postgres
    const posts = await prisma.scheduledPost.findMany({
      where: {
        userId: userId,
        status: { in: ["scheduled", "processing", "expired"] },
      },
      orderBy: { scheduleTime: 'asc' }
    });

    // Map to frontend friendly format
    const formattedPosts = posts.map(p => {
      // Map account IDs to Page Objects
      const accounts = p.accounts || []; // Prisma string[] is array
      const accountDetails = accounts.map(accId => {
        const page = pageMap[accId];
        return {
          id: accId,
          name: page?.name || "Unknown Page",
          picture: page?.picture || null
        };
      });

      return {
        id: p.id,
        _id: p.id, // Compatibility for frontend
        caption: p.caption,
        videoUrl: p.videoUrl, // Prisma camelCase
        thumbnailUrl: p.thumbnailUrl, // Prisma camelCase
        scheduleTime: p.scheduleTime,
        status: p.status,
        accounts: accountDetails,
        createdAt: p.createdAt
      };
    });

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

    // 🔍 Find and update post (update status to cancelled)
    // We try to match by ID and verify userId ownership. 
    // Prisma .update needs a unique selector. 'id' is unique.
    // But we must check user ownership first or use updateMany (which doesn't return the record by default in same way, but returns batchPayload).
    // Better: findUnique first to check owner, then update.

    const post = await prisma.scheduledPost.findUnique({
      where: { id: id }
    });

    if (!post || post.userId !== userId) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }

    // 🛑 Mark as cancelled
    const updatedPost = await prisma.scheduledPost.update({
      where: { id: id },
      data: { status: "cancelled" }
    });

    console.log(`🛑 Post ${id} cancelled by ${userId}`);

    res.json({
      success: true,
      message: "Post cancelled successfully",
      cancelledPost: updatedPost,
    });
  } catch (err) {
    console.error("❌ Cancel queue error:", err);
    res.status(500).json({ success: false, error: "Failed to cancel post" });
  }
});

module.exports = router;
