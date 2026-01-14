const prisma = require("./prisma");
const { decrypt } = require("./crypto");
const axios = require("axios");
const fb = require("./fb");

const botEngine = {
    /**
     * 🚀 Main Bot Loop
     */
    run: async () => {
        try {
            console.log("🤖 Bot Engine: Starting run cycle...");

            // 1️⃣ Check Global Bot Status
            const status = await prisma.botStatus.findFirst();
            if (!status || !status.enabled) {
                console.log("🤖 Bot Engine: Globally disabled. Skipping.");
                return;
            }

            // 2️⃣ Process Pending Replies (Queue)
            await botEngine.processPendingReplies();

            // 3️⃣ Get All Users with Facebook Connected
            // In Prisma, we check if facebookAccessToken is not null
            const users = await prisma.user.findMany({
                where: { facebookAccessToken: { not: null } }
            });
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
            const pendingReplies = await prisma.pendingReply.findMany({
                where: {
                    status: "pending",
                    sendAt: { lte: now }
                },
                take: 10
            });

            if (pendingReplies.length === 0) return;

            console.log(`⏳ Processing ${pendingReplies.length} pending replies...`);

            for (const reply of pendingReplies) {
                try {
                    // Mark as processing
                    await prisma.pendingReply.update({
                        where: { id: reply.id },
                        data: { status: "processing" }
                    });

                    console.log(`      💬 Sending delayed reply to ${reply.commentId}: "${reply.replyMessage}"`);

                    await axios.post(`${fb.graph}/${reply.commentId}/comments`, {
                        message: reply.replyMessage,
                        access_token: reply.accessToken,
                        attachment_url: reply.attachmentUrl || undefined,
                    });

                    // Success
                    await prisma.pendingReply.update({
                        where: { id: reply.id },
                        data: { status: "completed" }
                    });

                    // Log History
                    await prisma.botHistory.create({
                        data: {
                            commentId: reply.commentId,
                            replyMessage: reply.replyMessage,
                            pageId: reply.pageId,
                            status: "success",
                            timestamp: new Date()
                        }
                    });

                    // Persistent Record
                    await prisma.repliedComment.create({
                        data: {
                            commentId: reply.commentId,
                            postId: reply.commentId.split('_')[0],
                            userId: "system" // Or find actual userId if available
                        }
                    });

                    console.log(`      ✅ Reply sent successfully!`);

                } catch (err) {
                    console.error(`      ❌ Failed to send pending reply:`, err.message);

                    let attempts = reply.attempts + 1;
                    let status = "failed";
                    let sendAt = reply.sendAt;

                    if (attempts < 3) {
                        status = "pending";
                        sendAt = new Date(Date.now() + 5 * 60 * 1000); // Retry in 5 mins
                    }

                    await prisma.pendingReply.update({
                        where: { id: reply.id },
                        data: {
                            status,
                            error: err.message,
                            attempts,
                            sendAt
                        }
                    });

                    await prisma.botHistory.create({
                        data: {
                            commentId: reply.commentId,
                            replyMessage: reply.replyMessage,
                            pageId: reply.pageId,
                            status: "failed",
                            error: err.message,
                            timestamp: new Date()
                        }
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
            const decryptedToken = decrypt(user.facebookAccessToken);
            const validation = await fb.validateAccessToken(decryptedToken);
            if (!validation.isValid) {
                console.warn(`⚠️ Invalid token for user ${user.name} (ID: ${user.id})`);
                return;
            }

            // Get Pages
            const allPages = await fb.getFacebookPages(decryptedToken);

            // Filter Pages: Must be Selected AND have Bot Enabled
            let selectedPages = user.selectedPages || [];
            if (typeof selectedPages === 'string') {
                try { selectedPages = JSON.parse(selectedPages); } catch (e) { selectedPages = []; }
            }

            let pageSettings = user.pageSettings;
            if (typeof pageSettings === 'string') {
                try { pageSettings = JSON.parse(pageSettings); } catch (e) { pageSettings = []; }
            }
            if (!Array.isArray(pageSettings)) pageSettings = [];

            const activePages = allPages.filter(page => {
                const isSelected = selectedPages.includes(page.id);
                const settings = pageSettings.find(s => s.pageId === page.id);
                const isBotEnabled = settings?.enableBot === true;
                return isSelected && isBotEnabled;
            });

            if (activePages.length === 0) return;

            // Get Rules
            const rules = await prisma.botRule.findMany({ where: { enabled: true } });
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
            // Fetch recent posts
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
        // 🛑 1. Ignore Self
        if (comment.from?.id === page.id) return;

        // 🛑 2. Ignore Already Replied
        const alreadyReplied = await prisma.repliedComment.findUnique({
            where: { commentId: comment.id }
        });
        if (alreadyReplied) return;

        // 🛑 3. Ignore Already Pending
        const pending = await prisma.pendingReply.findUnique({
            where: { commentId: comment.id }
        });
        if (pending) return;

        // 🛑 4. Anti-Spam: Ignore Links
        if (/(https?:\/\/[^\s]+)/g.test(comment.message)) return;

        // 🎯 5. Match Rules
        let replyMessage = null;
        let attachmentUrl = null;

        // Priority 1: ALL Rule (scope: ALL)
        const allPostsRule = rules.find((r) => r.scope === "ALL");
        if (allPostsRule) {
            replyMessage = allPostsRule.reply;
            attachmentUrl = allPostsRule.attachmentUrl;
        } else {
            // Priority 2: Keyword Match
            const commentText = (comment.message || "").toLowerCase();
            const matchedRule = rules.find((r) => {
                if (r.ruleType !== "KEYWORD") return false;
                const keyword = r.keyword.toLowerCase();
                return commentText.includes(keyword);
            });

            if (matchedRule) {
                replyMessage = matchedRule.reply;
                attachmentUrl = matchedRule.attachmentUrl;
            }
        }

        // 🚀 6. Queue Reply (Delay 1-2 mins)
        if (replyMessage) {
            try {
                const delayMs = Math.floor(Math.random() * 60000) + 60000; // 1-2 minutes
                const sendAt = new Date(Date.now() + delayMs);

                console.log(`      ⏳ Queuing reply to ${comment.from?.name || 'Unknown'} (Delay: ${Math.round(delayMs / 1000)}s)`);

                await prisma.pendingReply.create({
                    data: {
                        commentId: comment.id,
                        replyMessage: replyMessage,
                        attachmentUrl: attachmentUrl,
                        pageId: page.id,
                        accessToken: page.access_token,
                        sendAt: sendAt,
                        status: "pending"
                    }
                });

            } catch (err) {
                console.error("      ❌ Failed to queue reply:", err.message);
            }
        }
    },
};

module.exports = botEngine;


module.exports = botEngine;
