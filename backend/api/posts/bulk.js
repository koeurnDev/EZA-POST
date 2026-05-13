/**
 * ============================================================
 * 🚀 /api/posts/bulk — Bulk Create Scheduled Posts (Prisma Fix)
 * ============================================================
 */

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../../utils/auth");
const prisma = require('../../utils/prisma');

/* -------------------------------------------------------------------------- */
/* ✅ POST /api/posts/bulk — Create multiple scheduled posts                  */
/* -------------------------------------------------------------------------- */
router.post("/", requireAuth, async (req, res) => {
    try {
        const { posts } = req.body;

        if (!posts || !Array.isArray(posts) || posts.length === 0) {
            return res.status(400).json({ success: false, error: "No posts provided" });
        }

        console.log(`📦 Bulk creating ${posts.length} posts for user ${req.user.id}...`);

        // Prepare posts for insertion (Mapping to ScheduledPost model)
        const postsToInsert = posts.map(post => ({
            userId: req.user.id,
            caption: post.caption || "",
            videoUrl: post.videoUrl || null,
            accounts: post.accounts || [], // Json field
            scheduleTime: post.scheduleTime ? new Date(post.scheduleTime) : new Date(),
            status: post.scheduleTime ? "scheduled" : "draft",
            postType: post.postType || "video",
            createdAt: new Date(),
            updatedAt: new Date()
        }));

        // Prisma createMany (PostgreSQL)
        const result = await prisma.scheduledPost.createMany({
            data: postsToInsert
        });

        console.log(`✅ Successfully created ${result.count} scheduled posts.`);

        res.status(201).json({
            success: true,
            message: `Successfully created ${result.count} scheduled posts.`,
            count: result.count
        });

    } catch (err) {
        console.error("❌ Bulk create failed:", err.message);
        res.status(500).json({ success: false, error: "Failed to create posts", details: err.message });
    }
});

module.exports = router;
