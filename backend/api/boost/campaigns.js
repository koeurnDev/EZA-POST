// ============================================================
// 🚀 Boost Campaigns API Routes
// ============================================================

const express = require('express');
const router = express.Router();
const BoostCampaign = require('../../models/BoostCampaign');
const Post = require('../../models/Post');
const User = require('../../models/User');
const { createBoostCampaign, updateCampaignStatus, getCampaignMetrics, validateAdAccount } = require('../../services/facebookAds');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session?.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

/**
 * POST /api/boost/campaigns/create
 * Create a new boost campaign
 */
router.post('/campaigns/create', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { postId, budget, duration, targeting } = req.body;

        // Validation
        if (!postId || !budget || !duration) {
            return res.status(400).json({ error: 'Missing required fields: postId, budget, duration' });
        }

        if (budget < 5 || budget > 500) {
            return res.status(400).json({ error: 'Budget must be between $5 and $500' });
        }

        if (duration < 1 || duration > 30) {
            return res.status(400).json({ error: 'Duration must be between 1 and 30 days' });
        }

        // Verify post ownership
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        if (post.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get Facebook post ID
        const fbPlatform = post.platforms?.find(p => p.name === 'facebook' && p.status === 'published');
        if (!fbPlatform || !fbPlatform.postId) {
            return res.status(400).json({ error: 'Post not published to Facebook' });
        }

        // Get user and page token
        const user = await User.findOne({ id: userId });
        const pageId = post.accounts[0];
        const page = user.connectedPages.find(p => p.id === pageId);
        if (!page) {
            return res.status(400).json({ error: 'Page not found' });
        }

        const pageToken = user.getDecryptedPageToken(pageId);
        const adAccountId = process.env.FB_AD_ACCOUNT_ID;

        if (!adAccountId) {
            return res.status(500).json({ error: 'Ad Account not configured. Please set FB_AD_ACCOUNT_ID in environment variables.' });
        }

        // Validate ad account
        try {
            const accountStatus = await validateAdAccount(adAccountId, pageToken);
            if (!accountStatus.isValid) {
                return res.status(400).json({
                    error: 'Ad account is not active',
                    reason: accountStatus.disableReason
                });
            }
        } catch (error) {
            return res.status(400).json({ error: `Ad account validation failed: ${error.message}` });
        }

        // Create campaign in database first
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + duration);

        const campaign = new BoostCampaign({
            userId,
            postId: post._id,
            facebookPostId: fbPlatform.postId,
            pageId,
            budget,
            duration,
            startDate,
            endDate,
            targeting: targeting || {},
            status: 'draft'
        });

        await campaign.save();

        // Create campaign on Facebook
        try {
            const fbCampaign = await createBoostCampaign({
                postId: fbPlatform.postId,
                pageId,
                accessToken: pageToken,
                adAccountId,
                budget,
                duration,
                targeting: targeting || {},
                startDate
            });

            // Update campaign with Facebook IDs
            campaign.campaignId = fbCampaign.campaignId;
            campaign.adSetId = fbCampaign.adSetId;
            campaign.adId = fbCampaign.adId;
            campaign.status = 'active';
            await campaign.save();

            // Update post
            await Post.findByIdAndUpdate(postId, {
                isBoosted: true,
                $push: { boostCampaigns: campaign._id }
            });

            res.json({
                success: true,
                campaign: {
                    _id: campaign._id,
                    campaignId: campaign.campaignId,
                    status: campaign.status,
                    budget: campaign.budget,
                    duration: campaign.duration,
                    startDate: campaign.startDate,
                    endDate: campaign.endDate
                },
                message: 'Campaign created successfully! It will start shortly.'
            });
        } catch (error) {
            // Update campaign status to failed
            campaign.status = 'failed';
            campaign.error = error.message;
            await campaign.save();

            throw error;
        }
    } catch (error) {
        console.error('❌ Error creating campaign:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/boost/campaigns
 * Get all campaigns for current user
 */
router.get('/campaigns', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { status, limit = 20 } = req.query;

        const query = { userId };
        if (status && status !== 'all') {
            query.status = status;
        }

        const campaigns = await BoostCampaign.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('postId');

        // Format response with post data
        const formattedCampaigns = campaigns.map(campaign => {
            const post = campaign.postId;
            return {
                _id: campaign._id,
                campaignId: campaign.campaignId,
                post: post ? {
                    _id: post._id,
                    caption: post.caption,
                    videoUrl: post.videoUrl,
                    createdAt: post.createdAt
                } : null,
                budget: campaign.budget,
                duration: campaign.duration,
                startDate: campaign.startDate,
                endDate: campaign.endDate,
                status: campaign.status,
                metrics: campaign.metrics,
                targeting: campaign.targeting,
                createdAt: campaign.createdAt,
                lastSyncedAt: campaign.lastSyncedAt
            };
        });

        res.json({
            total: formattedCampaigns.length,
            campaigns: formattedCampaigns
        });
    } catch (error) {
        console.error('❌ Error fetching campaigns:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/boost/campaigns/:campaignId
 * Get specific campaign details
 */
router.get('/campaigns/:campaignId', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const userId = req.session.user.id;

        const campaign = await BoostCampaign.findById(campaignId).populate('postId');
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        if (campaign.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Sync latest metrics from Facebook
        if (campaign.campaignId && campaign.status === 'active') {
            try {
                const user = await User.findOne({ id: userId });
                const pageToken = user.getDecryptedPageToken(campaign.pageId);

                const metrics = await getCampaignMetrics(campaign.campaignId, pageToken);
                campaign.metrics = metrics;
                campaign.lastSyncedAt = new Date();
                await campaign.save();
            } catch (error) {
                console.error('⚠️ Failed to sync campaign metrics:', error.message);
            }
        }

        res.json({
            campaign: {
                _id: campaign._id,
                campaignId: campaign.campaignId,
                post: campaign.postId,
                budget: campaign.budget,
                duration: campaign.duration,
                startDate: campaign.startDate,
                endDate: campaign.endDate,
                status: campaign.status,
                metrics: campaign.metrics,
                targeting: campaign.targeting,
                error: campaign.error,
                createdAt: campaign.createdAt,
                lastSyncedAt: campaign.lastSyncedAt
            }
        });
    } catch (error) {
        console.error('❌ Error fetching campaign:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/boost/campaigns/:campaignId/status
 * Update campaign status (pause/resume)
 */
router.patch('/campaigns/:campaignId/status', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const userId = req.session.user.id;
        const { status } = req.body;

        if (!['active', 'paused'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Use "active" or "paused"' });
        }

        const campaign = await BoostCampaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        if (campaign.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Update on Facebook
        const user = await User.findOne({ id: userId });
        const pageToken = user.getDecryptedPageToken(campaign.pageId);

        await updateCampaignStatus(campaign.campaignId, status, pageToken);

        // Update in database
        campaign.status = status;
        await campaign.save();

        res.json({
            success: true,
            campaignId: campaign._id,
            status: campaign.status,
            message: `Campaign ${status === 'active' ? 'resumed' : 'paused'} successfully`
        });
    } catch (error) {
        console.error('❌ Error updating campaign status:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/boost/campaigns/:campaignId
 * Cancel/delete a campaign
 */
router.delete('/campaigns/:campaignId', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const userId = req.session.user.id;

        const campaign = await BoostCampaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        if (campaign.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Pause campaign on Facebook first
        try {
            const user = await User.findOne({ id: userId });
            const pageToken = user.getDecryptedPageToken(campaign.pageId);
            await updateCampaignStatus(campaign.campaignId, 'paused', pageToken);
        } catch (error) {
            console.error('⚠️ Failed to pause campaign on Facebook:', error.message);
        }

        // Update status to completed
        campaign.status = 'completed';
        await campaign.save();

        res.json({
            success: true,
            message: 'Campaign cancelled successfully'
        });
    } catch (error) {
        console.error('❌ Error deleting campaign:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
