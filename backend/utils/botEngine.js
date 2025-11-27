// ============================================================
// 🤖 botEngine.js — Auto-Reply Logic (EZA_POST)
// ============================================================

const { BotRule, BotStatus } = require("../models/BotRule");
const User = require("../models/User");
const RepliedComment = require("../models/RepliedComment");
const fb = require("./fb");
const axios = require("axios");

const botEngine = {
    /**
     * 🚀 Main Bot Loop
     * Fetches all users, checks their pages, and processes comments.
     */
    run: async () => {
        try {
            // 1️⃣ Check Global Bot Status
            const status = await BotStatus.findOne();
            if (!status || !status.enabled) return; // Bot is globally disabled

            // 2️⃣ Get All Users with Facebook Connected
            const users = await User.find({ facebookAccessToken: { $exists: true } });

            for (const user of users) {
                await botEngine.processUser(user);
            }
        } catch (err) {
            console.error("❌ Bot Engine Error:", err.message);
        }
    },

    /**
     * 👤 Process a single user's pages
     */
    processUser: async (user) => {
        try {
            // Validate Token
            const validation = await fb.validateAccessToken(user.facebookAccessToken);
            if (!validation.isValid) return console.warn(`⚠️ Invalid token for user ${user.name}`);

            // Get Pages
            const pages = await fb.getFacebookPages(user.facebookAccessToken);

            // Get Rules
            const rules = await BotRule.find({ enabled: true });
            if (rules.length === 0) return;

            for (const page of pages) {
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
            // Ignore permission errors or empty feeds
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

        // 🛑 3. Anti-Spam: Ignore Links
        if (/(https?:\/\/[^\s]+)/g.test(comment.message)) {
            console.log(`🚫 Spam detected (Link): ${comment.id}`);
            return;
        }

        // 🎯 4. Match Rules
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

        // 🚀 5. Send Reply
        if (replyMessage) {
            try {
                await axios.post(`${fb.graph}/${comment.id}/comments`, {
                    message: replyMessage,
                    access_token: page.access_token,
                });
                console.log(`✅ Bot Replied to ${comment.id}: "${replyMessage}"`);

                // Save to DB
                await RepliedComment.create({
                    commentId: comment.id,
                    postId: comment.id.split('_')[0], // Approximate Post ID extraction
                    replyMessage: replyMessage
                });
            } catch (err) {
                console.error("❌ Failed to reply:", err.message);
            }
        }
    },
};

module.exports = botEngine;
