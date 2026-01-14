/**
 * ============================================================
 * 🚀 /api/posts/bulk — Bulk Create Posts
 * ============================================================
 */

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../../utils/auth");
const prisma = require('../../utils/prisma');

/* -------------------------------------------------------------------------- */
/* ✅ POST /api/posts/bulk — Create multiple posts                            */
/* -------------------------------------------------------------------------- */
router.post("/", requireAuth, async (req, res) => {
    try {
        const { posts } = req.body;

        if (!posts || !Array.isArray(posts) || posts.length === 0) {
            return res.status(400).json({ success: false, error: "No posts provided" });
        }

        console.log(`📦 Bulk creating ${posts.length} posts for user ${req.user.id}...`);

        // Prepare posts for insertion
        const postsToInsert = posts.map(post => ({
            userId: req.user.id,
            caption: post.caption,
            videoUrl: post.videoUrl,
            accounts: post.accounts, // String[]
            scheduleTime: post.scheduleTime || null,
            status: post.scheduleTime ? "scheduled" : "created",
            createdAt: new Date(),
        }));

        // Bulk Insert
        const result = await prisma.post.createMany({
            data: postsToInsert
        });

        console.log(`✅ Successfully created ${result.count} posts.`);

        res.status(201).json({
            success: true,
            message: `Successfully scheduled ${result.count} posts.`,
            count: result.count,
            posts: postsToInsert // Prisma createMany doesn't return created objects, so we return payload
        });

    } catch (err) {
        console.error("❌ Bulk create failed:", err.message);
        res.status(500).json({ success: false, error: "Failed to create posts" });
    }
});

module.exports = router;
