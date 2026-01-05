// ============================================================
// 📊 Boost Metrics API Routes
// ============================================================

const express = require('express');
const router = express.Router();
const PostMetrics = require('../../models/PostMetrics');
const Post = require('../../models/Post');
const { syncPostMetrics } = require('../../services/metricsSync');
const { getRecommendedBudget } = require('../../services/viralScoreCalculator');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session?.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

/**
 * GET /api/boost/metrics/:postId
 * Fetch metrics for a specific post
 */
router.get('/metrics/:postId', requireAuth, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.session.user.id;

        // Verify post ownership
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        if (post.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get metrics
        const metrics = await PostMetrics.findOne({ postId });
        if (!metrics) {
            return res.status(404).json({ error: 'Metrics not found. Try syncing first.' });
        }

        // Get recommended budget
        const budgetRec = getRecommendedBudget(metrics.viralScore, {
            reach: metrics.reach,
            engagement: metrics.engagement
        });

        res.json({
            postId,
            metrics: {
                likes: metrics.likes,
                comments: metrics.comments,
                shares: metrics.shares,
                reactions: metrics.reactions,
                reach: metrics.reach,
                impressions: metrics.impressions,
                engagement: metrics.engagement
            },
            viralScore: metrics.viralScore,
            viralTier: metrics.viralTier,
            lastSyncedAt: metrics.lastSyncedAt,
            recommendedBudget: budgetRec
        });
    } catch (error) {
        console.error('❌ Error fetching metrics:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/boost/viral-posts
 * Get all posts with high viral scores
 */
router.get('/viral-posts', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { tier = 'high', limit = 20, sort = 'viralScore' } = req.query;

        // Build query
        const query = { userId };

        if (tier !== 'all') {
            if (tier === 'viral') {
                query.viralScore = { $gte: 76 };
            } else if (tier === 'high') {
                query.viralScore = { $gte: 51 };
            } else if (tier === 'medium') {
                query.viralScore = { $gte: 26, $lt: 51 };
            }
        }

        // Fetch metrics with post data
        const metrics = await PostMetrics.find(query)
            .sort({ [sort]: -1 })
            .limit(parseInt(limit))
            .populate('postId');

        // Format response
        const viralPosts = await Promise.all(metrics.map(async (metric) => {
            const post = await Post.findById(metric.postId);
            if (!post) return null;

            const budgetRec = getRecommendedBudget(metric.viralScore, {
                reach: metric.reach,
                engagement: metric.engagement
            });

            return {
                post: {
                    _id: post._id,
                    caption: post.caption,
                    videoUrl: post.videoUrl,
                    createdAt: post.createdAt,
                    isBoosted: post.isBoosted
                },
                metrics: {
                    likes: metric.likes,
                    comments: metric.comments,
                    shares: metric.shares,
                    reach: metric.reach,
                    impressions: metric.impressions,
                    engagement: metric.engagement
                },
                viralScore: metric.viralScore,
                viralTier: metric.viralTier,
                lastSyncedAt: metric.lastSyncedAt,
                recommendedBudget: budgetRec
            };
        }));

        // Filter out null entries
        const filteredPosts = viralPosts.filter(p => p !== null);

        res.json({
            total: filteredPosts.length,
            posts: filteredPosts
        });
    } catch (error) {
        console.error('❌ Error fetching viral posts:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/boost/metrics/sync/:postId
 * Manually trigger metrics sync for a post
 */
router.post('/metrics/sync/:postId', requireAuth, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.session.user.id;

        // Verify post ownership
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        if (post.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Sync metrics
        const result = await syncPostMetrics(postId);

        if (!result) {
            return res.status(400).json({ error: 'Post not eligible for sync (not published to Facebook)' });
        }

        res.json({
            success: true,
            metrics: result.metrics,
            viralScore: result.viralScore,
            viralTier: result.viralTier
        });
    } catch (error) {
        console.error('❌ Error syncing metrics:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
