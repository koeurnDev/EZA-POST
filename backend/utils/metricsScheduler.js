// ============================================================
// 📊 Metrics Scheduler - Automated Post Metrics Syncing
// ============================================================

const { syncAllPostMetrics, updateViralScores } = require('../services/metricsSync');

/**
 * Start the metrics sync scheduler
 * Runs every 15 minutes to sync post metrics from Facebook
 */
function startMetricsScheduler() {
    const SYNC_INTERVAL = parseInt(process.env.METRICS_SYNC_INTERVAL || 15) * 60 * 1000; // Default: 15 minutes

    console.log(`📊 Starting metrics scheduler (interval: ${SYNC_INTERVAL / 60000} minutes)`);

    // Run immediately on startup (after 30 seconds delay)
    setTimeout(async () => {
        console.log('🔄 Running initial metrics sync...');
        try {
            await syncAllPostMetrics(50);
            await updateViralScores();
        } catch (error) {
            console.error('❌ Initial metrics sync failed:', error.message);
        }
    }, 30000);

    // Then run on interval
    setInterval(async () => {
        console.log('🔄 Running scheduled metrics sync...');
        try {
            const result = await syncAllPostMetrics(50);
            console.log(`✅ Synced ${result.success} posts, ${result.errors} errors`);

            // Update viral scores every 3rd sync (45 minutes)
            if (Math.random() < 0.33) {
                await updateViralScores();
            }
        } catch (error) {
            console.error('❌ Scheduled metrics sync failed:', error.message);
        }
    }, SYNC_INTERVAL);
}

/**
 * Sync campaign metrics from Facebook
 * Runs every 30 minutes to update active campaign performance
 */
function startCampaignMetricsScheduler() {
    const BoostCampaign = require('../models/BoostCampaign');
    const User = require('../models/User');
    const { getCampaignMetrics } = require('../services/facebookAds');

    const SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes

    console.log('🚀 Starting campaign metrics scheduler (interval: 30 minutes)');

    setInterval(async () => {
        console.log('🔄 Syncing campaign metrics...');
        try {
            // Find all active campaigns
            const campaigns = await BoostCampaign.find({ status: 'active' }).limit(20);

            let syncCount = 0;
            for (const campaign of campaigns) {
                try {
                    const user = await User.findOne({ id: campaign.userId });
                    if (!user) continue;

                    const pageToken = user.getDecryptedPageToken(campaign.pageId);
                    if (!pageToken) continue;

                    const metrics = await getCampaignMetrics(campaign.campaignId, pageToken);

                    campaign.metrics = metrics;
                    campaign.lastSyncedAt = new Date();
                    await campaign.save();

                    syncCount++;

                    // Rate limiting
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    console.error(`❌ Failed to sync campaign ${campaign._id}:`, error.message);
                }
            }

            console.log(`✅ Synced ${syncCount} campaign metrics`);
        } catch (error) {
            console.error('❌ Campaign metrics sync failed:', error.message);
        }
    }, SYNC_INTERVAL);
}

module.exports = {
    startMetricsScheduler,
    startCampaignMetricsScheduler
};
