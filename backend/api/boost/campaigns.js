// ============================================================
// 🚀 Boost Campaigns API Routes
// ============================================================

const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const { decrypt } = require('../../utils/crypto');
const { requireAuth } = require('../../utils/auth');
const { createBoostCampaign, updateCampaignStatus, getCampaignMetrics, validateAdAccount } = require('../../services/facebookAds');

/**
 * POST /api/boost/campaigns/create
 * Create a new boost campaign
 */
router.post('/create', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
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
        const post = await prisma.post.findUnique({ where: { id: postId } });
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        if (post.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get Facebook post ID
        let platforms = post.platforms;
        if (typeof platforms === 'string') {
            try { platforms = JSON.parse(platforms); } catch (e) { platforms = []; }
        }
        if (!Array.isArray(platforms)) platforms = [];

        const fbPlatform = platforms.find(p => p.name === 'facebook' && p.status === 'published');
        if (!fbPlatform || !fbPlatform.postId) {
            return res.status(400).json({ error: 'Post not published to Facebook' });
        }

        // Get user and page token
        const user = await prisma.user.findUnique({ where: { id: userId } });

        let accounts = post.accounts;
        if (typeof accounts === 'string') {
            try { accounts = JSON.parse(accounts); } catch (e) { accounts = []; }
        }
        const pageId = accounts[0];

        // Find page record in FacebookPage table
        const pageRecord = await prisma.facebookPage.findUnique({ where: { id: pageId } });
        if (!pageRecord || pageRecord.userId !== userId) {
            return res.status(400).json({ error: 'Page not found or unauthorized' });
        }

        const pageToken = decrypt(pageRecord.accessToken);
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

        const campaign = await prisma.boostCampaign.create({
            data: {
                userId,
                postId: post.id,
                facebookPostId: fbPlatform.postId,
                pageId,
                budget: parseFloat(budget),
                duration: parseInt(duration),
                startDate,
                endDate,
                targeting: targeting || {},
                status: 'draft'
            }
        });

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
            const updatedCampaign = await prisma.boostCampaign.update({
                where: { id: campaign.id },
                data: {
                    campaignId: fbCampaign.campaignId,
                    adSetId: fbCampaign.adSetId,
                    adId: fbCampaign.adId,
                    status: 'active'
                }
            });

            // Update post
            await prisma.post.update({
                where: { id: postId },
                data: { isBoosted: true }
            });

            res.json({
                success: true,
                campaign: updatedCampaign,
                message: 'Campaign created successfully! It will start shortly.'
            });
        } catch (error) {
            // Update campaign status to failed
            await prisma.boostCampaign.update({
                where: { id: campaign.id },
                data: {
                    status: 'failed',
                    error: error.message
                }
            });

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
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, limit = 20 } = req.query;

        const where = { userId };
        if (status && status !== 'all') {
            where.status = status;
        }

        const campaigns = await prisma.boostCampaign.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            include: { post: true }
        });

        // Format response
        const formattedCampaigns = campaigns.map(campaign => {
            const post = campaign.post;
            return {
                id: campaign.id,
                campaignId: campaign.campaignId,
                post: post ? {
                    id: post.id,
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
 */
router.get('/:campaignId', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const userId = req.user.id;

        const campaign = await prisma.boostCampaign.findUnique({
            where: { id: campaignId },
            include: { post: true }
        });

        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        if (campaign.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Sync latest metrics from Facebook
        if (campaign.campaignId && campaign.status === 'active') {
            try {
                const pageRecord = await prisma.facebookPage.findUnique({ where: { id: campaign.pageId } });
                const pageToken = decrypt(pageRecord.accessToken);

                const metrics = await getCampaignMetrics(campaign.campaignId, pageToken);

                await prisma.boostCampaign.update({
                    where: { id: campaign.id },
                    data: {
                        metrics: metrics || {},
                        lastSyncedAt: new Date()
                    }
                });
                campaign.metrics = metrics;
            } catch (error) {
                console.error('⚠️ Failed to sync campaign metrics:', error.message);
            }
        }

        res.json({ campaign });
    } catch (error) {
        console.error('❌ Error fetching campaign:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/boost/campaigns/:campaignId/status
 * Update campaign status (pause/resume)
 */
router.patch('/:campaignId/status', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const userId = req.user.id;
        const { status } = req.body;

        if (!['active', 'paused'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Use "active" or "paused"' });
        }

        const campaign = await prisma.boostCampaign.findUnique({ where: { id: campaignId } });
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        if (campaign.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Update on Facebook
        const pageRecord = await prisma.facebookPage.findUnique({ where: { id: campaign.pageId } });
        const pageToken = decrypt(pageRecord.accessToken);

        await updateCampaignStatus(campaign.campaignId, status, pageToken);

        // Update in database
        const updated = await prisma.boostCampaign.update({
            where: { id: campaignId },
            data: { status }
        });

        res.json({
            success: true,
            campaign: updated,
            message: `Campaign ${status === 'active' ? 'resumed' : 'paused'} successfully`
        });
    } catch (error) {
        console.error('❌ Error updating campaign status:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/boost/campaigns/:campaignId
 */
router.delete('/:campaignId', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const userId = req.user.id;

        const campaign = await prisma.boostCampaign.findUnique({ where: { id: campaignId } });
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        if (campaign.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Pause campaign on Facebook first
        try {
            const pageRecord = await prisma.facebookPage.findUnique({ where: { id: campaign.pageId } });
            const pageToken = decrypt(pageRecord.accessToken);
            await updateCampaignStatus(campaign.campaignId, 'paused', pageToken);
        } catch (error) {
            console.error('⚠️ Failed to pause campaign on Facebook:', error.message);
        }

        // Update status to completed (don't delete hard record for history)
        await prisma.boostCampaign.update({
            where: { id: campaignId },
            data: { status: 'completed' }
        });

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

module.exports = router;
