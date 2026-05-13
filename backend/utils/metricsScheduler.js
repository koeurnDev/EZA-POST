// ============================================================
// 📊 Metrics Scheduler - Automated Post Metrics Syncing (Prisma Fix)
// ============================================================

const { syncAllPostMetrics, updateViralScores } = require('../services/metricsSync');
const prisma = require('./prisma');
const { getCampaignMetrics } = require('../services/facebookAds');
const { decrypt } = require('./crypto');

/**
 * Start the metrics sync scheduler
 */
function startMetricsScheduler() {
    const SYNC_INTERVAL = parseInt(process.env.METRICS_SYNC_INTERVAL || 15) * 60 * 1000; 

    console.log(`📊 Starting metrics scheduler (interval: ${SYNC_INTERVAL / 60000} minutes)`);

    setTimeout(async () => {
        console.log('🔄 Running initial metrics sync...');
        try {
            await syncAllPostMetrics(50);
            await updateViralScores();
        } catch (error) {
            console.error('❌ Initial metrics sync failed:', error.message);
        }
    }, 30000);

    setInterval(async () => {
        console.log('🔄 Running scheduled metrics sync...');
        try {
            const result = await syncAllPostMetrics(50);
            if (result) {
                console.log(`✅ Synced ${result.success} posts, ${result.errors} errors`);
            }
            if (Math.random() < 0.33) {
                await updateViralScores();
            }
        } catch (error) {
            console.error('❌ Scheduled metrics sync failed:', error.message);
        }
    }, SYNC_INTERVAL);
}

/**
 * Sync campaign metrics from Facebook (Prisma Version)
 */
function startCampaignMetricsScheduler() {
    const SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes

    console.log('🚀 Starting campaign metrics scheduler (interval: 30 minutes)');

    setInterval(async () => {
        console.log('🔄 Syncing campaign metrics...');
        try {
            const campaigns = await prisma.boostCampaign.findMany({
                where: { status: 'active', campaignId: { not: null } },
                take: 20,
                include: { user: true }
            });

            let syncCount = 0;
            for (const campaign of campaigns) {
                try {
                    // Find the page for this campaign to get the token
                    const page = await prisma.facebookPage.findFirst({
                        where: { id: campaign.pageId, userId: campaign.userId }
                    });
                    
                    if (!page || !page.accessToken) continue;

                    const pageToken = decrypt(page.accessToken);
                    const metrics = await getCampaignMetrics(campaign.campaignId, pageToken);

                    await prisma.boostCampaign.update({
                        where: { id: campaign.id },
                        data: {
                            metrics: metrics,
                            lastSyncedAt: new Date()
                        }
                    });

                    syncCount++;
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    console.error(`❌ Failed to sync campaign ${campaign.id}:`, error.message);
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
