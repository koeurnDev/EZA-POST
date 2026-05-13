// ============================================================
// 🔄 Metrics Sync Service - Automated Post Metrics Syncing (Prisma Version)
// ============================================================

const prisma = require('../utils/prisma');
const { fetchPostInsights } = require('./facebookAds');
const { calculateViralScore } = require('./viralScoreCalculator');
const { decrypt } = require('../utils/crypto');

/**
 * Sync metrics for a single PostTarget
 * @param {String} targetId - Prisma PostTarget ID
 * @returns {Object} Updated metrics
 */
async function syncPostMetrics(targetId) {
    try {
        const target = await prisma.postTarget.findUnique({
            where: { id: targetId },
            include: { 
                scheduledPost: true,
                page: { include: { user: true } }
            }
        });

        if (!target || !target.facebookPostId) {
            console.log(`⏭️ Skipping target ${targetId} - not published to Facebook`);
            return null;
        }

        const user = target.page.user;
        const page = target.page;

        // Decrypt Page Token
        const pageToken = decrypt(page.accessToken);
        if (!pageToken) {
            throw new Error(`Page access token not found for page ${page.name}`);
        }

        // Fetch metrics from Facebook
        console.log(`📊 Syncing metrics for target ${targetId} (FB: ${target.facebookPostId})`);
        const metrics = await fetchPostInsights(target.facebookPostId, pageToken);

        // Calculate viral score
        const { viralScore, viralTier, metadata } = calculateViralScore(metrics, target.postedAt || target.createdAt);

        // Update or create PostMetrics document
        const postMetrics = await prisma.postMetrics.upsert({
            where: { postTargetId: target.id },
            update: {
                likes: metrics.likes,
                comments: metrics.comments,
                shares: metrics.shares,
                reactions: metrics.reactions,
                reach: metrics.reach,
                impressions: metrics.impressions,
                engagement: metrics.engagement,
                viralScore,
                viralTier,
                lastSyncedAt: new Date()
            },
            create: {
                postTargetId: target.id,
                pageId: target.pageId,
                userId: user.id,
                likes: metrics.likes,
                comments: metrics.comments,
                shares: metrics.shares,
                reactions: metrics.reactions,
                reach: metrics.reach,
                impressions: metrics.impressions,
                engagement: metrics.engagement,
                viralScore,
                viralTier,
                lastSyncedAt: new Date()
            }
        });

        // Update Target document with viral score
        await prisma.postTarget.update({
            where: { id: target.id },
            data: {
                updatedAt: new Date() // Trigger update
            }
        });

        console.log(`✅ Synced metrics for target ${targetId} - Viral Score: ${viralScore} (${viralTier})`);

        return {
            targetId,
            metrics: postMetrics,
            viralScore,
            viralTier,
            metadata
        };
    } catch (error) {
        console.error(`❌ Error syncing metrics for target ${targetId}:`, error.message);
        throw error;
    }
}

/**
 * Sync metrics for all published targets
 * @param {Number} limit - Maximum number of targets to sync (default: 50)
 * @returns {Array} Sync results
 */
async function syncAllPostMetrics(limit = 50) {
    try {
        console.log('🔄 Starting batch metrics sync...');

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        // Find targets that need syncing
        const pendingTargets = await prisma.postTarget.findMany({
            where: {
                status: 'published',
                facebookPostId: { not: null },
                OR: [
                    { metrics: { is: null } },
                    { metrics: { lastSyncedAt: { lt: oneHourAgo } } }
                ]
            },
            take: limit,
            orderBy: { postedAt: 'desc' }
        });

        console.log(`📊 Found ${pendingTargets.length} targets to sync`);

        const results = [];
        let successCount = 0;
        let errorCount = 0;

        for (const target of pendingTargets) {
            try {
                const result = await syncPostMetrics(target.id);
                if (result) {
                    results.push(result);
                    successCount++;
                }
            } catch (error) {
                console.error(`❌ Failed to sync target ${target.id}:`, error.message);
                errorCount++;
            }

            // Rate limiting - wait 1 second between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`✅ Batch sync complete: ${successCount} success, ${errorCount} errors`);

        return {
            total: pendingTargets.length,
            success: successCount,
            errors: errorCount,
            results
        };
    } catch (error) {
        console.error('❌ Error in batch metrics sync:', error.message);
        throw error;
    }
}

/**
 * Update viral scores for all metrics (recalculation)
 */
async function updateViralScores() {
    try {
        console.log('🔄 Recalculating viral scores...');

        const metrics = await prisma.postMetrics.findMany({
            include: { postTarget: true }
        });
        
        let updateCount = 0;

        for (const metric of metrics) {
            const { viralScore, viralTier } = calculateViralScore({
                likes: metric.likes,
                comments: metric.comments,
                shares: metric.shares,
                reactions: metric.reactions,
                reach: metric.reach,
                impressions: metric.impressions
            }, metric.postTarget.postedAt || metric.postTarget.createdAt);

            // Update if score changed significantly (> 5 points)
            if (Math.abs(metric.viralScore - viralScore) > 5) {
                await prisma.postMetrics.update({
                    where: { id: metric.id },
                    data: { viralScore, viralTier }
                });
                updateCount++;
            }
        }

        console.log(`✅ Updated ${updateCount} viral scores`);
        return updateCount;
    } catch (error) {
        console.error('❌ Error updating viral scores:', error.message);
        throw error;
    }
}

module.exports = {
    syncPostMetrics,
    syncAllPostMetrics,
    updateViralScores
};
