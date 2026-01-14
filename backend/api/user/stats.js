const express = require("express");
const router = express.Router();
const prisma = require('../../utils/prisma');
const { requireAuth } = require("../../utils/auth");

// ✅ GET /api/user/stats
router.get("/", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Count Scheduled Posts (all time or just scheduled? let's do all created by user)
        const postsCount = await prisma.scheduledPost.count({
            where: { userId: userId }
        });

        // Count Auto-Replies
        // RepliedComment needs to have userId field as per my schema update
        const repliesCount = await prisma.repliedComment.count({
            where: { userId: userId }
        });

        res.json({
            success: true,
            stats: {
                posts: postsCount,
                replies: repliesCount
            }
        });
    } catch (err) {
        console.error("❌ Fetch stats error:", err.message);
        res.status(500).json({ success: false, error: "Failed to fetch stats" });
    }
});

module.exports = router;
