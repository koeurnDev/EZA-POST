// ============================================================
// 🔄 Metrics Sync Service - Automated Post Metrics Syncing
// ============================================================

const PostMetrics = require('../models/PostMetrics');
const Post = require('../models/Post');
const User = require('../models/User');
const { fetchPostInsights } = require('./facebookAds');
const { calculateViralScore } = require('./viralScoreCalculator');

/**
 * Sync metrics for a single post
 * @param {String} postId - MongoDB Post ID
 * @returns {Object} Updated metrics
 */
async function syncPostMetrics(postId) {
    try {
        const post = await Post.findById(postId);
        if (!post) {
            throw new Error('Post not found');
        }

        // Only sync published Facebook posts
        const fbPlatform = post.platforms?.find(p => p.name === 'facebook' && p.status === 'published');
        if (!fbPlatform || !fbPlatform.postId) {
            console.log(`⏭️ Skipping post ${postId} - not published to Facebook`);
            return null;
        }

        // Get user and page token
        const user = await User.findOne({ id: post.userId });
        if (!user) {
            throw new Error('User not found');
        }

        // Find the page this post was published to
        const pageId = post.accounts[0]; // Assuming first account
        const page = user.connectedPages.find(p => p.id === pageId);
        if (!page) {
            throw new Error('Page not found in user connections');
        }

        const pageToken = user.getDecryptedPageToken(pageId);
        if (!pageToken) {
            throw new Error('Page access token not found');
        }

        // Fetch metrics from Facebook
        console.log(`📊 Syncing metrics for post ${postId} (FB: ${fbPlatform.postId})`);
        const metrics = await fetchPostInsights(fbPlatform.postId, pageToken);

        // Calculate viral score
        const { viralScore, viralTier, metadata } = calculateViralScore(metrics, post.createdAt);

        // Update or create PostMetrics document
        const postMetrics = await PostMetrics.findOneAndUpdate(
            { facebookPostId: fbPlatform.postId },
            {
                postId: post._id,
                facebookPostId: fbPlatform.postId,
                pageId,
                userId: post.userId,
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
            { upsert: true, new: true }
        );

        // Update Post document with viral score
        await Post.findByIdAndUpdate(postId, {
            viralScore,
            lastMetricsSync: new Date()
        });

        console.log(`✅ Synced metrics for post ${postId} - Viral Score: ${viralScore} (${viralTier})`);

        return {
            postId,
            metrics: postMetrics,
            viralScore,
            viralTier,
            metadata
        };
    } catch (error) {
        console.error(`❌ Error syncing metrics for post ${postId}:`, error.message);
        throw error;
    }
}

/**
 * Sync metrics for all published posts
 * @param {Number} limit - Maximum number of posts to sync (default: 50)
 * @returns {Array} Sync results
 */
async function syncAllPostMetrics(limit = 50) {
    try {
        console.log('🔄 Starting batch metrics sync...');

        // Find all published Facebook posts that haven't been synced recently
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const posts = await Post.find({
            'platforms.name': 'facebook',
            'platforms.status': 'published',
            $or: [
                { lastMetricsSync: { $lt: oneHourAgo } },
                { lastMetricsSync: null }
            ]
        })
            .limit(limit)
            .sort({ createdAt: -1 });

        console.log(`📊 Found ${posts.length} posts to sync`);

        const results = [];
        let successCount = 0;
        let errorCount = 0;

        for (const post of posts) {
            try {
                const result = await syncPostMetrics(post._id);
                if (result) {
                    results.push(result);
                    successCount++;
                }
            } catch (error) {
                console.error(`❌ Failed to sync post ${post._id}:`, error.message);
                errorCount++;
            }

            // Rate limiting - wait 1 second between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`✅ Batch sync complete: ${successCount} success, ${errorCount} errors`);

        return {
            total: posts.length,
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
 * Update viral scores for all posts (recalculation)
 * @returns {Number} Number of posts updated
 */
async function updateViralScores() {
    try {
        console.log('🔄 Recalculating viral scores...');

        const metrics = await PostMetrics.find({});
        let updateCount = 0;

        for (const metric of metrics) {
            const post = await Post.findById(metric.postId);
            if (!post) continue;

            const { viralScore, viralTier } = calculateViralScore({
                likes: metric.likes,
                comments: metric.comments,
                shares: metric.shares,
                reactions: metric.reactions,
                reach: metric.reach,
                impressions: metric.impressions
            }, post.createdAt);

            // Update if score changed significantly (> 5 points)
            if (Math.abs(metric.viralScore - viralScore) > 5) {
                await PostMetrics.findByIdAndUpdate(metric._id, {
                    viralScore,
                    viralTier
                });

                await Post.findByIdAndUpdate(post._id, { viralScore });
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
