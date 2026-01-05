// ============================================================
// 📱 Facebook Ads Service - Marketing API Integration
// ============================================================

const axios = require('axios');

const FB_GRAPH_API = 'https://graph.facebook.com/v18.0';

/**
 * Fetch post insights/metrics from Facebook
 * @param {String} postId - Facebook post ID (format: pageId_postId)
 * @param {String} accessToken - Page access token
 * @returns {Object} Post metrics
 */
async function fetchPostInsights(postId, accessToken) {
    try {
        // Fetch post engagement metrics
        const response = await axios.get(`${FB_GRAPH_API}/${postId}`, {
            params: {
                fields: 'likes.summary(true),comments.summary(true),shares,reactions.summary(true),created_time',
                access_token: accessToken
            }
        });

        // Fetch post insights (reach, impressions)
        const insightsResponse = await axios.get(`${FB_GRAPH_API}/${postId}/insights`, {
            params: {
                metric: 'post_impressions,post_impressions_unique,post_engaged_users',
                access_token: accessToken
            }
        });

        const data = response.data;
        const insights = insightsResponse.data.data || [];

        // Parse insights
        const impressions = insights.find(i => i.name === 'post_impressions')?.values[0]?.value || 0;
        const reach = insights.find(i => i.name === 'post_impressions_unique')?.values[0]?.value || 0;
        const engagedUsers = insights.find(i => i.name === 'post_engaged_users')?.values[0]?.value || 0;

        // Parse reactions breakdown
        const reactionsData = data.reactions?.data || [];
        const reactions = {
            like: 0,
            love: 0,
            haha: 0,
            wow: 0,
            sad: 0,
            angry: 0
        };

        reactionsData.forEach(reaction => {
            const type = reaction.type.toLowerCase();
            if (reactions.hasOwnProperty(type)) {
                reactions[type]++;
            }
        });

        return {
            likes: data.likes?.summary?.total_count || 0,
            comments: data.comments?.summary?.total_count || 0,
            shares: data.shares?.count || 0,
            reactions,
            reach,
            impressions,
            engagement: engagedUsers,
            createdTime: data.created_time
        };
    } catch (error) {
        console.error('❌ Error fetching post insights:', error.response?.data || error.message);
        throw new Error(`Failed to fetch post insights: ${error.response?.data?.error?.message || error.message}`);
    }
}

/**
 * Create a boost campaign for a post
 * @param {Object} config - Campaign configuration
 * @returns {Object} Campaign details
 */
async function createBoostCampaign(config) {
    const {
        postId,
        pageId,
        accessToken,
        adAccountId,
        budget,
        duration,
        targeting,
        startDate
    } = config;

    try {
        // Note: This is a simplified implementation
        // In production, you would use the Facebook Business SDK
        // and create Campaign -> AdSet -> Ad hierarchy

        console.log('🚀 Creating boost campaign:', {
            postId,
            budget: `$${budget}/day`,
            duration: `${duration} days`,
            targeting
        });

        // Step 1: Create Campaign
        const campaignResponse = await axios.post(
            `${FB_GRAPH_API}/act_${adAccountId}/campaigns`,
            {
                name: `Boost Post ${postId} - ${new Date().toISOString()}`,
                objective: 'POST_ENGAGEMENT',
                status: 'PAUSED', // Start paused for safety
                special_ad_categories: [],
                access_token: accessToken
            }
        );

        const campaignId = campaignResponse.data.id;

        // Step 2: Create Ad Set
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + duration);

        const adSetResponse = await axios.post(
            `${FB_GRAPH_API}/act_${adAccountId}/adsets`,
            {
                name: `AdSet for ${postId}`,
                campaign_id: campaignId,
                daily_budget: budget * 100, // Convert to cents
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'POST_ENGAGEMENT',
                bid_amount: 100, // Auto-bid
                targeting: formatTargeting(targeting),
                start_time: startDate.toISOString(),
                end_time: endDate.toISOString(),
                status: 'PAUSED',
                access_token: accessToken
            }
        );

        const adSetId = adSetResponse.data.id;

        // Step 3: Create Ad (using existing post)
        const adResponse = await axios.post(
            `${FB_GRAPH_API}/act_${adAccountId}/ads`,
            {
                name: `Ad for ${postId}`,
                adset_id: adSetId,
                creative: {
                    object_story_id: postId // Boost existing post
                },
                status: 'PAUSED',
                access_token: accessToken
            }
        );

        const adId = adResponse.data.id;

        return {
            campaignId,
            adSetId,
            adId,
            status: 'draft'
        };
    } catch (error) {
        console.error('❌ Error creating boost campaign:', error.response?.data || error.message);
        throw new Error(`Failed to create campaign: ${error.response?.data?.error?.message || error.message}`);
    }
}

/**
 * Update campaign status (activate, pause, stop)
 * @param {String} campaignId - Facebook campaign ID
 * @param {String} status - New status ('ACTIVE', 'PAUSED')
 * @param {String} accessToken - Access token
 * @returns {Object} Updated campaign
 */
async function updateCampaignStatus(campaignId, status, accessToken) {
    try {
        const response = await axios.post(
            `${FB_GRAPH_API}/${campaignId}`,
            {
                status: status.toUpperCase(),
                access_token: accessToken
            }
        );

        return {
            success: true,
            campaignId,
            status: status.toLowerCase()
        };
    } catch (error) {
        console.error('❌ Error updating campaign status:', error.response?.data || error.message);
        throw new Error(`Failed to update campaign: ${error.response?.data?.error?.message || error.message}`);
    }
}

/**
 * Fetch campaign performance metrics
 * @param {String} campaignId - Facebook campaign ID
 * @param {String} accessToken - Access token
 * @returns {Object} Campaign metrics
 */
async function getCampaignMetrics(campaignId, accessToken) {
    try {
        const response = await axios.get(`${FB_GRAPH_API}/${campaignId}/insights`, {
            params: {
                fields: 'spend,impressions,reach,clicks,ctr,cpc,actions',
                access_token: accessToken
            }
        });

        const data = response.data.data[0] || {};

        // Parse actions (engagement)
        const actions = data.actions || [];
        const engagement = actions.reduce((sum, action) => {
            if (action.action_type.includes('engagement') || action.action_type.includes('like') || action.action_type.includes('comment')) {
                return sum + parseInt(action.value);
            }
            return sum;
        }, 0);

        return {
            spend: parseFloat(data.spend || 0),
            impressions: parseInt(data.impressions || 0),
            reach: parseInt(data.reach || 0),
            clicks: parseInt(data.clicks || 0),
            ctr: parseFloat(data.ctr || 0),
            cpc: parseFloat(data.cpc || 0),
            engagement
        };
    } catch (error) {
        console.error('❌ Error fetching campaign metrics:', error.response?.data || error.message);
        return {
            spend: 0,
            impressions: 0,
            reach: 0,
            clicks: 0,
            ctr: 0,
            cpc: 0,
            engagement: 0
        };
    }
}

/**
 * Validate ad account and check balance
 * @param {String} adAccountId - Facebook Ad Account ID
 * @param {String} accessToken - Access token
 * @returns {Object} Account status
 */
async function validateAdAccount(adAccountId, accessToken) {
    try {
        const response = await axios.get(`${FB_GRAPH_API}/act_${adAccountId}`, {
            params: {
                fields: 'account_status,balance,currency,name,disable_reason',
                access_token: accessToken
            }
        });

        const data = response.data;

        return {
            isValid: data.account_status === 1, // 1 = Active
            balance: parseFloat(data.balance || 0) / 100, // Convert from cents
            currency: data.currency || 'USD',
            name: data.name,
            disableReason: data.disable_reason || null
        };
    } catch (error) {
        console.error('❌ Error validating ad account:', error.response?.data || error.message);
        throw new Error(`Invalid ad account: ${error.response?.data?.error?.message || error.message}`);
    }
}

/**
 * Format targeting parameters for Facebook API
 * @param {Object} targeting - Targeting configuration
 * @returns {Object} Formatted targeting
 */
function formatTargeting(targeting) {
    const {
        ageMin = 18,
        ageMax = 65,
        genders = ['all'],
        locations = ['US'],
        interests = []
    } = targeting;

    const formatted = {
        age_min: ageMin,
        age_max: ageMax,
        geo_locations: {
            countries: locations
        }
    };

    // Gender targeting
    if (!genders.includes('all')) {
        formatted.genders = genders.map(g => g === 'male' ? 1 : 2);
    }

    // Interest targeting
    if (interests.length > 0) {
        formatted.flexible_spec = [{
            interests: interests.map(id => ({ id }))
        }];
    }

    return formatted;
}

module.exports = {
    fetchPostInsights,
    createBoostCampaign,
    updateCampaignStatus,
    getCampaignMetrics,
    validateAdAccount
};
