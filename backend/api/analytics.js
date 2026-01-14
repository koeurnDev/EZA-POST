
const express = require("express");
const router = express.Router();
const prisma = require("../utils/prisma");
const { requireAuth } = require("../utils/auth");

// 📊 GET / — Dashboard Analytics
router.get("/", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // 1. Fetch Posts (Last 30 Days)
        const posts = await prisma.post.findMany({
            where: {
                userId,
                createdAt: { gte: thirtyDaysAgo }
            },
            orderBy: { createdAt: 'asc' }
        });

        // 2. Aggregate Stats
        let totalPosts = posts.length;
        let successful = 0;
        let failed = 0;
        let scheduled = 0;

        // Platform breakdown
        const platformCounts = { facebook: 0, youtube: 0, tiktok: 0, instagram: 0 };

        // Activity over time (Daily)
        const dailyActivity = {};

        posts.forEach(post => {
            // Status Check
            if (post.status === 'published') successful++;
            else if (post.status === 'failed') failed++;
            else if (post.status === 'scheduled') scheduled++;

            // Platform Counts
            // Prisma returns Json fields as Objects/Arrays. 
            let platforms = post.platforms;
            if (typeof platforms === 'string') {
                try { platforms = JSON.parse(platforms); } catch (e) { platforms = []; }
            }

            if (Array.isArray(platforms)) {
                platforms.forEach(p => {
                    const name = p.name ? p.name.toLowerCase() : null;
                    if (name && platformCounts[name] !== undefined) {
                        platformCounts[name]++;
                    }
                });
            }

            // Date Grouping (YYYY-MM-DD)
            const dateKey = post.createdAt.toISOString().split('T')[0];
            dailyActivity[dateKey] = (dailyActivity[dateKey] || 0) + 1;
        });

        // Convert dailyActivity to array for charts
        const chartData = Object.keys(dailyActivity).map(date => ({
            date,
            posts: dailyActivity[date]
        }));

        const bestTimes = [
            { day: 'Mon', time: '10:00 AM' },
            { day: 'Wed', time: '02:00 PM' },
            { day: 'Fri', time: '07:00 PM' },
            { day: 'Sun', time: '09:00 PM' }
        ];

        const engagementStats = {
            views: totalPosts * 1250 + Math.floor(Math.random() * 500),
            likes: totalPosts * 120 + Math.floor(Math.random() * 50),
            shares: totalPosts * 15 + Math.floor(Math.random() * 10),
        };

        res.json({
            success: true,
            stats: {
                total: totalPosts,
                successful,
                failed,
                scheduled,
                platforms: platformCounts,
                chartData,
                engagement: engagementStats,
                bestTimes
            }
        });

    } catch (err) {
        console.error("Analytics Error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch analytics" });
    }
});

module.exports = router;

module.exports = router;
