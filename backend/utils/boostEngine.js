/**
 * ============================================================
 * 🚀 Boost Engine - Auto-Boost Posts Core Logic (Prisma Version)
 * ============================================================
 * Evaluates boost rules and triggers engagement simulation
 */

const prisma = require('./prisma');

class BoostEngine {
    /**
     * Main function - runs periodically to check and boost posts
     */
    async run() {
        try {
            console.log('🚀 Boost Engine: Starting evaluation...');

            // Get all users with enabled boost rules
            const activeRules = await prisma.boostRule.findMany({
                where: { enabled: true }
            });

            for (const userRule of activeRules) {
                await this.evaluateUserPosts(userRule);
            }

            console.log('✅ Boost Engine: Evaluation complete');
        } catch (err) {
            console.error('❌ Boost Engine error:', err.message);
        }
    }

    /**
     * Evaluate all posts for a specific user
     */
    async evaluateUserPosts(userRule) {
        try {
            // Get user's posts from last 7 days that aren't already boosted
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const posts = await prisma.post.findMany({
                where: {
                    userId: userRule.userId,
                    createdAt: { gte: sevenDaysAgo },
                    status: 'published'
                }
            });

            if (posts.length === 0) return;

            // Get already boosted post IDs
            const boostedPosts = await prisma.boostedPost.findMany({
                where: {
                    userId: userRule.userId,
                    status: { in: ['active', 'completed'] }
                },
                select: { postId: true }
            });
            const boostedPostIds = boostedPosts.map(bp => bp.postId);

            // Filter out already boosted posts
            const unboostedPosts = posts.filter(
                p => !boostedPostIds.includes(p.id)
            );

            // Evaluate each post against rules
            for (const post of unboostedPosts) {
                const rules = Array.isArray(userRule.rules) ? userRule.rules : [];
                for (const rule of rules) {
                    if (await this.shouldBoost(post, rule)) {
                        await this.boostPost(post, userRule.userId, rule);
                        break; // Only apply first matching rule
                    }
                }
            }
        } catch (err) {
            console.error('❌ Error evaluating user posts:', err.message);
        }
    }

    /**
     * Check if a post should be boosted based on a rule
     */
    async shouldBoost(post, rule) {
        if (rule.type === 'time') {
            // Time-based: boost if post is X hours old
            const hoursOld = (Date.now() - new Date(post.createdAt)) / (1000 * 60 * 60);
            return hoursOld >= (rule.condition?.hours || 0);
        }

        if (rule.type === 'engagement') {
            // Engagement-based: boost if engagement is below threshold
            const metrics = post.metrics || { likes: 0, comments: 0, shares: 0 };

            if (rule.condition?.minLikes && (metrics.likes || 0) < rule.condition.minLikes) {
                return true;
            }
            if (rule.condition?.minComments && (metrics.comments || 0) < rule.condition.minComments) {
                return true;
            }
            if (rule.condition?.minShares && (metrics.shares || 0) < rule.condition.minShares) {
                return true;
            }
        }

        return false;
    }

    /**
     * Boost a post by simulating engagement OR triggering real boost
     */
    async boostPost(post, userId, rule) {
        try {
            console.log(`🎯 Boosting post ${post.id} for user ${userId}`);

            const actions = rule.actions || ['like'];
            const engagement = this.calculateEngagement(rule.intensity || 'medium', actions);

            // Create boosted post record
            const boostedPost = await prisma.boostedPost.create({
                data: {
                    userId,
                    postId: post.id,
                    boostStarted: new Date(),
                    status: 'active',
                    ruleTriggered: rule.type,
                    realBoost: {
                        targetLikes: engagement.likes || 0,
                        targetComments: engagement.comments || 0,
                        targetShares: engagement.shares || 0,
                        enabled: false
                    }
                }
            });

            // Determine if using real boost
            // Re-fetch userRule to get latest realBoost settings
            const userRule = await prisma.boostRule.findFirst({ where: { userId } });
            const useRealBoost = userRule?.realBoost && userRule.realBoost.enabled === true;

            if (useRealBoost) {
                await this.handleRealBoost(post, userId, boostedPost, rule, engagement);
            } else {
                // Simulated boost
                await this.simulateEngagement(post, boostedPost, engagement, actions);
            }

        } catch (err) {
            console.error('❌ Error boosting post:', err.message);
        }
    }

    /**
     * Handle real boost with credits and queue
     */
    async handleRealBoost(post, userId, boostedPost, rule, engagement) {
        try {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            const totalActions = engagement.likes + engagement.comments + engagement.shares;

            if (!user || user.credits < totalActions) {
                console.log(`❌ Insufficient credits for user ${userId}. Required: ${totalActions}, Available: ${user?.credits || 0}`);
                await prisma.boostedPost.update({
                    where: { id: boostedPost.id },
                    data: { status: 'failed' }
                });
                return;
            }

            // Deduct credits
            await prisma.user.update({
                where: { id: userId },
                data: {
                    credits: { decrement: totalActions },
                    totalCreditsSpent: { increment: totalActions }
                }
            });

            // Log transaction
            await prisma.creditTransaction.create({
                data: {
                    userId,
                    type: 'spend',
                    amount: -totalActions,
                    balance: user.credits - totalActions,
                    description: `Real boost for post ${post.id} (${totalActions} actions)`,
                    relatedId: boostedPost.id
                }
            });

            // Update boostedPost with real boost settings
            await prisma.boostedPost.update({
                where: { id: boostedPost.id },
                data: {
                    realBoost: {
                        enabled: true,
                        targetLikes: engagement.likes,
                        targetComments: engagement.comments,
                        targetShares: engagement.shares
                    }
                }
            });

            console.log(`💰 Deducted ${totalActions} credits from user ${userId}.`);

            // Perform real boost via queue
            const boostQueue = require('./boostQueue');
            await boostQueue.addToQueue(boostedPost);
        } catch (err) {
            console.error('❌ Error handling real boost:', err.message);
        }
    }

    /**
     * Calculate how much engagement to add based on intensity
     */
    calculateEngagement(intensity, actions) {
        const baseAmounts = {
            low: { likes: 10, comments: 2, shares: 1 },
            medium: { likes: 30, comments: 5, shares: 3 },
            high: { likes: 100, comments: 15, shares: 10 }
        };

        const amounts = baseAmounts[intensity] || baseAmounts.medium;

        return {
            likes: actions.includes('like') ? Math.floor(amounts.likes * (0.7 + Math.random() * 0.6)) : 0,
            comments: actions.includes('comment') ? Math.floor(amounts.comments * (0.7 + Math.random() * 0.6)) : 0,
            shares: actions.includes('share') ? Math.floor(amounts.shares * (0.7 + Math.random() * 0.6)) : 0
        };
    }

    /**
     * Simulate engagement gradually
     */
    async simulateEngagement(post, boostedPost, engagement, actions) {
        try {
            const metrics = post.metrics || { likes: 0, comments: 0, shares: 0 };

            const updatedMetrics = {
                likes: (metrics.likes || 0) + (engagement.likes || 0),
                comments: (metrics.comments || 0) + (engagement.comments || 0),
                shares: (metrics.shares || 0) + (engagement.shares || 0)
            };

            await prisma.post.update({
                where: { id: post.id },
                data: { metrics: updatedMetrics }
            });

            // Update boosted post
            await prisma.boostedPost.update({
                where: { id: boostedPost.id },
                data: {
                    metrics: {
                        likesAdded: engagement.likes,
                        commentsAdded: engagement.comments,
                        sharesAdded: engagement.shares
                    },
                    status: 'completed',
                    boostEnded: new Date()
                }
            });

            console.log(`✅ Added engagement: +${engagement.likes} likes, +${engagement.comments} comments, +${engagement.shares} shares`);
        } catch (err) {
            console.error('❌ Error simulating engagement:', err.message);
        }
    }
}

module.exports = new BoostEngine();
