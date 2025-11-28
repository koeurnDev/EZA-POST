const { BotRule, BotStatus } = require("../models/BotRule");
const User = require("../models/User");
const RepliedComment = require("../models/RepliedComment");
const PendingReply = require("../models/PendingReply");
const BotHistory = require("../models/BotHistory");
const fb = require("./fb");
const axios = require("axios");

const botEngine = {
    /**
     * 🚀 Main Bot Loop
     * Fetches all users, checks their pages, and processes comments.
     */
    run: async () => {
        try {
            console.log("🤖 Bot Engine: Starting run cycle...");

            // 1️⃣ Check Global Bot Status
            const status = await BotStatus.findOne();
            if (!status || !status.enabled) {
                console.log("🤖 Bot Engine: Globally disabled. Skipping.");
                return;
            }

            // 2️⃣ Process Pending Replies (Queue)
            await botEngine.processPendingReplies();

            // 3️⃣ Get All Users with Facebook Connected
            const users = await User.find({ facebookAccessToken: { $exists: true } });
            console.log(`🤖 Bot Engine: Found ${users.length} users with FB tokens.`);

            for (const user of users) {
                await botEngine.processUser(user);
            }
            console.log("🤖 Bot Engine: Run cycle complete.");
        } catch (err) {
            console.error("❌ Bot Engine Error:", err.message);
        }
    },

    /**
     * ⏳ Process Pending Replies (Queue)
     */
    processPendingReplies: async () => {
        try {
            const now = new Date();
            const pendingReplies = await PendingReply.find({
                status: "pending",
                sendAt: { $lte: now }
            }).limit(10); // Batch size

            if (pendingReplies.length === 0) return;

            console.log(`⏳ Processing ${pendingReplies.length} pending replies...`);

            for (const reply of pendingReplies) {
                try {
                    // Mark as processing
                    reply.status = "processing";
                    await reply.save();

                    console.log(`      💬 Sending delayed reply to ${reply.commentId}: "${reply.replyMessage}"`);

                    await axios.post(`${fb.graph}/${reply.commentId}/comments`, {
                        message: reply.replyMessage,
                        access_token: reply.accessToken,
                    });

                    // Success
                    reply.status = "completed";
                    await reply.save();

                    // Log History
                    await BotHistory.create({
                        commentId: reply.commentId,
                        replyMessage: reply.replyMessage,
                        pageId: reply.pageId,
                        status: "success",
                        timestamp: new Date()
                    });

                    // Persistent Record
                    await RepliedComment.create({
                        commentId: reply.commentId,
                        postId: reply.commentId.split('_')[0],
                        replyMessage: reply.replyMessage
                    });

                    console.log(`      ✅ Reply sent successfully!`);

                } catch (err) {
                    console.error(`      ❌ Failed to send pending reply:`, err.message);
                    reply.status = "failed";
                    reply.error = err.message;
                    reply.attempts += 1;

                    // Retry logic (optional: reset to pending if attempts < 3)
                    if (reply.attempts < 3) {
                        reply.status = "pending";
                        reply.sendAt = new Date(Date.now() + 5 * 60 * 1000); // Retry in 5 mins
                    }

                    await reply.save();

                    await BotHistory.create({
                        commentId: reply.commentId,
                        replyMessage: reply.replyMessage,
                        pageId: reply.pageId,
                        status: "failed",
                        error: err.message,
                        timestamp: new Date()
                    });
                }
            }
        } catch (err) {
            console.error("❌ Error processing pending replies:", err.message);
        }
    },

    /**
     * 👤 Process a single user's pages
     */
    processUser: async (user) => {
        try {
            // Validate Token
            const validation = await fb.validateAccessToken(user.facebookAccessToken);
            if (!validation.isValid) {
                console.warn(`⚠️ Invalid token for user ${user.name} (ID: ${user.id})`);
                return;
            }

            // Get Pages
            const allPages = await fb.getFacebookPages(user.facebookAccessToken);

            // Filter Pages: Must be Selected AND have Bot Enabled
            const activePages = allPages.filter(page => {
                const isSelected = user.selectedPages?.includes(page.id);
                const settings = user.pageSettings?.find(s => s.pageId === page.id);
                const isBotEnabled = settings?.enableBot === true;
                return isSelected && isBotEnabled;
            });

            if (activePages.length === 0) {
                // console.log(`🤖 User ${user.name}: No active pages for bot.`);
                return;
            }

            // Get Rules
            const rules = await BotRule.find({ enabled: true });
            if (rules.length === 0) return;

            for (const page of activePages) {
                await botEngine.processPage(page, rules);
            }
        } catch (err) {
            console.error(`❌ Error processing user ${user.name}:`, err.message);
        }
    },

    /**
     * 📄 Process a single page's posts
     */
    processPage: async (page, rules) => {
        try {
            // Fetch recent posts (limit 5 for performance)
            const res = await axios.get(`${fb.graph}/${page.id}/feed`, {
                params: {
                    access_token: page.access_token,
                    fields: "id,message,comments{id,message,from,created_time}",
                    limit: 5,
                },
            });

            const posts = res.data.data || [];

            for (const post of posts) {
                if (!post.comments || !post.comments.data) continue;

                for (const comment of post.comments.data) {
                    await botEngine.processComment(comment, page, rules);
                }
            }
        } catch (err) {
            console.error(`      ❌ Error fetching feed for ${page.name}:`, err.message);
        }
    },

    /**
     * 💬 Process a single comment
     */
    processComment: async (comment, page, rules) => {
        // 🛑 1. Ignore Self (Don't reply to the page itself)
        if (comment.from?.id === page.id) return;

        // 🛑 2. Ignore Already Replied (Persistent Check)
        const alreadyReplied = await RepliedComment.findOne({ commentId: comment.id });
        if (alreadyReplied) return;

        // 🛑 3. Ignore Already Pending
        const pending = await PendingReply.findOne({ commentId: comment.id });
        if (pending) return;

        // 🛑 4. Anti-Spam: Ignore Links
        if (/(https?:\/\/[^\s]+)/g.test(comment.message)) {
            return;
        }

        // 🎯 5. Match Rules
        let replyMessage = null;

        // Priority 1: ALL_POSTS Rule
        const allPostsRule = rules.find((r) => r.type === "ALL_POSTS");
        if (allPostsRule) {
            replyMessage = allPostsRule.reply;
        } else {
            // Priority 2: Keyword Match
            const commentText = comment.message.toLowerCase();
            const matchedRule = rules.find((r) => {
                if (r.type !== "KEYWORD") return false;
                const keyword = r.keyword.toLowerCase();
                return r.matchType === "EXACT"
                    ? commentText === keyword
                    : commentText.includes(keyword);
            });

            if (matchedRule) replyMessage = matchedRule.reply;
        }

        // 🚀 6. Queue Reply (Delay 1-2 mins)
        if (replyMessage) {
            try {
                const delayMs = Math.floor(Math.random() * 60000) + 60000; // 1-2 minutes
                const sendAt = new Date(Date.now() + delayMs);

                console.log(`      ⏳ Queuing reply to ${comment.from.name} (Delay: ${Math.round(delayMs / 1000)}s)`);

                await PendingReply.create({
                    commentId: comment.id,
                    replyMessage: replyMessage,
                    pageId: page.id,
                    accessToken: page.access_token,
                    sendAt: sendAt,
                    status: "pending"
                });

            } catch (err) {
                console.error("      ❌ Failed to queue reply:", err.message);
            }
        }
    },
};


module.exports = botEngine;
