/**
 * ============================================================
 * 🚀 /api/boost — Auto-Boost Posts API
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../utils/auth');
const BoostRule = require('../models/BoostRule');
const BoostedPost = require('../models/BoostedPost');

/* -------------------------------------------------------------------------- */
/* GET /rules — Get user's boost rules                                        */
/* -------------------------------------------------------------------------- */
router.get('/rules', requireAuth, async (req, res) => {
    try {
        let rules = await BoostRule.findOne({ userId: req.user.id });

        // Create default rules if none exist
        if (!rules) {
            rules = await BoostRule.create({
                userId: req.user.id,
                enabled: false,
                rules: []
            });
        }

        res.json({ success: true, rules });
    } catch (err) {
        console.error('❌ Get boost rules error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* POST /rules — Create or update boost rules                                 */
/* -------------------------------------------------------------------------- */
router.post('/rules', requireAuth, async (req, res) => {
    try {
        const { enabled, rules, realBoost } = req.body;

        let boostRule = await BoostRule.findOne({ userId: req.user.id });

        if (boostRule) {
            // Update existing
            boostRule.enabled = enabled !== undefined ? enabled : boostRule.enabled;
            boostRule.rules = rules || boostRule.rules;
            if (realBoost) {
                boostRule.realBoost = { ...boostRule.realBoost, ...realBoost };
            }
            await boostRule.save();
        } else {
            // Create new
            boostRule = await BoostRule.create({
                userId: req.user.id,
                enabled,
                rules,
                realBoost
            });
        }

        res.json({ success: true, rules: boostRule });
    } catch (err) {
        console.error('❌ Update boost rules error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* GET /analytics — Get boost analytics                                       */
/* -------------------------------------------------------------------------- */
router.get('/analytics', requireAuth, async (req, res) => {
    try {
        const boostedPosts = await BoostedPost.find({ userId: req.user.id })
            .populate('postId')
            .sort({ boostStarted: -1 })
            .limit(50);

        // Calculate totals
        const stats = {
            totalBoosted: boostedPosts.length,
            activeBoosted: boostedPosts.filter(p => p.status === 'active').length,
            totalLikesAdded: boostedPosts.reduce((sum, p) => sum + p.metrics.likesAdded, 0),
            totalCommentsAdded: boostedPosts.reduce((sum, p) => sum + p.metrics.commentsAdded, 0),
            totalSharesAdded: boostedPosts.reduce((sum, p) => sum + p.metrics.sharesAdded, 0)
        };

        res.json({ success: true, stats, posts: boostedPosts });
    } catch (err) {
        console.error('❌ Get analytics error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* GET /analytics/:postId — Get specific post boost data                      */
/* -------------------------------------------------------------------------- */
router.get('/analytics/:postId', requireAuth, async (req, res) => {
    try {
        const boostedPost = await BoostedPost.findOne({
            postId: req.params.postId,
            userId: req.user.id
        }).populate('postId');

        if (!boostedPost) {
            return res.status(404).json({ success: false, error: 'Post not boosted' });
        }

        res.json({ success: true, data: boostedPost });
    } catch (err) {
        console.error('❌ Get post analytics error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* POST /stop/:postId — Stop boosting a specific post                         */
/* -------------------------------------------------------------------------- */
router.post('/stop/:postId', requireAuth, async (req, res) => {
    try {
        const boostedPost = await BoostedPost.findOne({
            postId: req.params.postId,
            userId: req.user.id,
            status: 'active'
        });

        if (!boostedPost) {
            return res.status(404).json({ success: false, error: 'Active boost not found' });
        }

        boostedPost.status = 'completed';
        boostedPost.boostEnded = new Date();
        await boostedPost.save();

        res.json({ success: true, message: 'Boost stopped' });
    } catch (err) {
        console.error('❌ Stop boost error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
