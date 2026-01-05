/**
 * ============================================================
 * 🚀 Boost Engine - Auto-Boost Posts Core Logic
 * ============================================================
 * Evaluates boost rules and triggers engagement simulation
 */

const BoostRule = require('../models/BoostRule');
const BoostedPost = require('../models/BoostedPost');
const Post = require('../models/Post');

class BoostEngine {
    /**
     * Main function - runs periodically to check and boost posts
     */
    async run() {
        try {
            console.log('🚀 Boost Engine: Starting evaluation...');

            // Get all users with enabled boost rules
            const activeRules = await BoostRule.find({ enabled: true });

            for (const userRule of activeRules) {
                await this.evaluateUserPosts(userRule);
            }

            console.log('✅ Boost Engine: Evaluation complete');
        } catch (err) {
            console.error('❌ Boost Engine error:', err);
        }
    }

    /**
     * Evaluate all posts for a specific user
     */
    async evaluateUserPosts(userRule) {
        try {
            // Get user's posts from last 7 days that aren't already boosted
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const posts = await Post.find({
                userId: userRule.userId,
                createdAt: { $gte: sevenDaysAgo },
                status: 'published'
            });

            // Get already boosted post IDs
            const boostedPostIds = await BoostedPost.find({
                userId: userRule.userId,
                status: { $in: ['active', 'completed'] }
            }).distinct('postId');

            // Filter out already boosted posts
            const unboostedPosts = posts.filter(
                p => !boostedPostIds.some(id => id.equals(p._id))
            );

            // Evaluate each post against rules
            for (const post of unboostedPosts) {
                for (const rule of userRule.rules) {
                    if (await this.shouldBoost(post, rule)) {
                        await this.boostPost(post, userRule.userId, rule);
                        break; // Only apply first matching rule
                    }
                }
            }
        } catch (err) {
            console.error('❌ Error evaluating user posts:', err);
        }
    }

    /**
     * Check if a post should be boosted based on a rule
     */
    async shouldBoost(post, rule) {
        if (rule.type === 'time') {
            // Time-based: boost if post is X hours old
            const hoursOld = (Date.now() - post.createdAt) / (1000 * 60 * 60);
            return hoursOld >= rule.condition.hours;
        }

        if (rule.type === 'engagement') {
            // Engagement-based: boost if engagement is below threshold
            const metrics = post.metrics || { likes: 0, comments: 0, shares: 0 };

            if (rule.condition.minLikes && metrics.likes < rule.condition.minLikes) {
                return true;
            }
            if (rule.condition.minComments && metrics.comments < rule.condition.minComments) {
                return true;
            }
            if (rule.condition.minShares && metrics.shares < rule.condition.minShares) {
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
            console.log(`🎯 Boosting post ${post._id} for user ${userId}`);

            // Create boosted post record
            const boostedPost = await BoostedPost.create({
                userId,
                postId: post._id,
                platform: post.platform,
                postUrl: post.url,
                boostStarted: new Date(),
                targetLikes: rule.action.likes || 0,
                targetComments: rule.action.comments || 0,
                targetShares: rule.action.shares || 0,
                status: 'active'
            });

            // Determine if using real boost
            const User = require('../models/User');
            const CreditTransaction = require('../models/CreditTransaction');
            const BoostRule = require('../models/BoostRule');

            const userRule = await BoostRule.findOne({ userId });
            const useRealBoost = userRule?.realBoost?.enabled || false;

            if (useRealBoost) {
                // Real boost - check credits first
                const user = await User.findOne({ id: userId });
                const totalActions = (rule.action.likes || 0) + (rule.action.comments || 0) + (rule.action.shares || 0);

                if (!user || user.credits < totalActions) {
                    console.log(`❌ Insufficient credits for user ${userId}. Required: ${totalActions}, Available: ${user?.credits || 0}`);
                    boostedPost.status = 'failed';
                    boostedPost.error = 'Insufficient credits';
                    await boostedPost.save();
                    return;
                }

                // Deduct credits upfront
                user.credits -= totalActions;
                user.totalCreditsSpent += totalActions;
                await user.save();

                // Log transaction
                await CreditTransaction.create({
                    userId,
                    type: 'spend',
                    amount: -totalActions,
                    balance: user.credits,
                    description: `Real boost for post ${post._id} (${totalActions} actions)`,
                    relatedId: boostedPost._id
                });

                console.log(`💰 Deducted ${totalActions} credits from user ${userId}. New balance: ${user.credits}`);

                // Perform real boost via queue
                const boostQueue = require('./boostQueue');
                await boostQueue.addToQueue(boostedPost);
            } else {
                // Simulated boost
                await this.simulateBoost(boostedPost, rule);
            }

        } catch (err) {
            console.error('❌ Error boosting post:', err);
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

        // Add randomness (±30%)
        return {
            likes: Math.floor(amounts.likes * (0.7 + Math.random() * 0.6)),
            comments: Math.floor(amounts.comments * (0.7 + Math.random() * 0.6)),
            shares: Math.floor(amounts.shares * (0.7 + Math.random() * 0.6))
        };
    }

    /**
     * Simulate engagement gradually to appear natural
     */
    async simulateEngagement(post, boostedPost, engagement, actions) {
        try {
            // Update post metrics
            if (!post.metrics) {
                post.metrics = { likes: 0, comments: 0, shares: 0 };
            }

            let likesAdded = 0;
            let commentsAdded = 0;
            let sharesAdded = 0;

            if (actions.includes('like')) {
                post.metrics.likes = (post.metrics.likes || 0) + engagement.likes;
                likesAdded = engagement.likes;
            }

            if (actions.includes('comment')) {
                post.metrics.comments = (post.metrics.comments || 0) + engagement.comments;
                commentsAdded = engagement.comments;
            }

            if (actions.includes('share')) {
                post.metrics.shares = (post.metrics.shares || 0) + engagement.shares;
                sharesAdded = engagement.shares;
            }

            await post.save();

            // Update boosted post metrics
            boostedPost.metrics = {
                likesAdded,
                commentsAdded,
                sharesAdded
            };
            boostedPost.status = 'completed';
            boostedPost.boostEnded = new Date();
            await boostedPost.save();

            console.log(`✅ Added engagement: +${likesAdded} likes, +${commentsAdded} comments, +${sharesAdded} shares`);
        } catch (err) {
            console.error('❌ Error simulating engagement:', err);
        }
    }
}

module.exports = new BoostEngine();
