/**
 * ============================================================
 * 📋 Boost Queue - Manages real boost task execution
 * ============================================================
 */

const BoostAccount = require('../models/BoostAccount');
const BoostedPost = require('../models/BoostedPost');
const Post = require('../models/Post');
const tiktokBooster = require('./tiktokBooster');

class BoostQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    /**
     * Add boost task to queue
     */
    async addTask(boostedPostId, postUrl, actions) {
        this.queue.push({
            boostedPostId,
            postUrl,
            actions,
            addedAt: new Date()
        });

        console.log(`📋 Added boost task to queue (${this.queue.length} pending)`);

        // Start processing if not already running
        if (!this.processing) {
            this.processQueue();
        }
    }

    /**
     * Process queue
     */
    async processQueue() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;
        console.log(`🚀 Starting boost queue processing (${this.queue.length} tasks)`);

        while (this.queue.length > 0) {
            const task = this.queue.shift();
            await this.processTask(task);

            // Delay between tasks to avoid detection
            await this.delay(10000, 20000); // 10-20 seconds
        }

        this.processing = false;
        console.log('✅ Boost queue processing complete');
    }

    /**
     * Process single boost task
     */
    async processTask(task) {
        try {
            console.log(`🎯 Processing boost task for post: ${task.postUrl}`);

            const boostedPost = await BoostedPost.findById(task.boostedPostId);
            if (!boostedPost) {
                console.log('❌ Boosted post not found');
                return;
            }

            // Get available accounts
            const accounts = await BoostAccount.find({
                userId: boostedPost.userId,
                platform: 'tiktok'
            });

            if (accounts.length === 0) {
                console.log('❌ No TikTok accounts available');
                return;
            }

            // Filter available accounts
            const availableAccounts = accounts.filter(acc => acc.isAvailable());

            if (availableAccounts.length === 0) {
                console.log('⏸️ No accounts available (all in cooldown or banned)');
                return;
            }

            // Determine how many accounts to use (1-3 random)
            const numAccounts = Math.min(
                1 + Math.floor(Math.random() * 3),
                availableAccounts.length
            );

            const selectedAccounts = this.shuffleArray(availableAccounts).slice(0, numAccounts);

            console.log(`👥 Using ${selectedAccounts.length} accounts for boost`);

            // Process each account
            for (const account of selectedAccounts) {
                await this.processAccountActions(account, task, boostedPost);

                // Delay between accounts
                await this.delay(5000, 10000);
            }

            // Mark boost as completed
            boostedPost.status = 'completed';
            boostedPost.boostEnded = new Date();
            await boostedPost.save();

        } catch (err) {
            console.error('❌ Task processing error:', err);
        }
    }

    /**
     * Process actions for single account
     */
    async processAccountActions(account, task, boostedPost) {
        try {
            console.log(`🤖 Processing with account: ${account.username}`);

            // Login first
            const loginSuccess = await tiktokBooster.login(account);
            if (!loginSuccess) {
                console.log(`❌ Login failed for ${account.username}`);
                return;
            }

            // Shuffle actions for randomness
            const shuffledActions = this.shuffleArray([...task.actions]);

            for (const action of shuffledActions) {
                let success = false;
                let error = null;

                try {
                    if (action === 'like') {
                        success = await tiktokBooster.likePost(account, task.postUrl);
                    } else if (action === 'comment') {
                        const comment = this.generateComment();
                        success = await tiktokBooster.commentPost(account, task.postUrl, comment);
                    } else if (action === 'share') {
                        success = await tiktokBooster.sharePost(account, task.postUrl);
                    }
                } catch (err) {
                    error = err.message;
                    console.error(`❌ Action ${action} failed:`, err.message);
                }

                // Record action
                boostedPost.realBoost.actionsCompleted.push({
                    accountId: account._id,
                    action,
                    timestamp: new Date(),
                    success,
                    error
                });

                if (success) {
                    await account.recordAction();
                }

                // Delay between actions
                await this.delay(3000, 8000);
            }

            // Add account to used list
            if (!boostedPost.realBoost.accountsUsed.includes(account._id)) {
                boostedPost.realBoost.accountsUsed.push(account._id);
            }

            await boostedPost.save();

        } catch (err) {
            console.error(`❌ Account action error for ${account.username}:`, err);
        }
    }

    /**
     * Generate random comment
     */
    generateComment() {
        const comments = [
            '🔥🔥🔥',
            'Amazing! ❤️',
            'Love this! 😍',
            'So good! 👏',
            'Nice! 👍',
            'Great content! 🎉',
            'Awesome! ⭐',
            'Perfect! 💯',
            'Beautiful! ✨',
            'Incredible! 🙌'
        ];
        return comments[Math.floor(Math.random() * comments.length)];
    }

    /**
     * Shuffle array
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Random delay
     */
    async delay(min, max) {
        const ms = min + Math.random() * (max - min);
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get queue status
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            processing: this.processing
        };
    }
}

module.exports = new BoostQueue();
