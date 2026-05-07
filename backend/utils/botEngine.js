const prisma = require("./prisma");
const { encrypt, decrypt } = require("./crypto");
const axios = require("axios");
const fb = require("./fb");

const botEngine = {
    /**
     * 🚀 Main Bot Loop
     */
    run: async () => {
        try {
            console.log("🤖 Bot Engine: Starting run cycle...");

            // 1️⃣ Process Pending Replies (Queue)
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

                    const decryptedToken = decrypt(reply.accessToken);
                    await axios.post(`${fb.graph}/${reply.commentId}/comments`, {
                        message: reply.replyMessage,
                        access_token: decryptedToken,
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
                            userId: reply.userId,
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
                            userId: reply.userId
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
                            userId: reply.userId,
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
            // 0. Check User's Bot Status
            const botStatus = await prisma.botStatus.findUnique({ where: { userId: user.id } });
            if (!botStatus || !botStatus.enabled) return;

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

            // Get Rules (Isolated by userId)
            const rules = await prisma.botRule.findMany({ 
                where: { userId: user.id, enabled: true } 
            });
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
            // 1️⃣ Fetch recent posts (Last 5)
            const res = await axios.get(`${fb.graph}/${page.id}/feed`, {
                params: {
                    access_token: page.access_token,
                    fields: "id,message,comments{id,message,from,created_time}",
                    limit: 5,
                },
            });

            let posts = res.data.data || [];

            // 2️⃣ Fetch manually registered monitored posts
            const monitoredPosts = await prisma.botMonitoredPost.findMany({
                where: { pageId: page.id, enabled: true }
            });

            for (const mPost of monitoredPosts) {
                // Skip if already in the last 5 posts to avoid double processing
                if (!posts.find(p => p.id === mPost.facebookPostId)) {
                    try {
                        const mRes = await axios.get(`${fb.graph}/${mPost.facebookPostId}`, {
                            params: {
                                access_token: page.access_token,
                                fields: "id,message,comments{id,message,from,created_time}",
                            }
                        });
                        if (mRes.data) {
                            posts.push(mRes.data);
                            // Update last checked time
                            await prisma.botMonitoredPost.update({
                                where: { id: mPost.id },
                                data: { lastChecked: new Date() }
                            });
                        }
                    } catch (e) {
                        console.error(`      ⚠️ Failed to fetch monitored post ${mPost.facebookPostId}:`, e.message);
                        // If post is not found (deleted), maybe disable it?
                        if (e.response?.status === 404 || e.response?.status === 400) {
                            await prisma.botMonitoredPost.update({
                                where: { id: mPost.id },
                                data: { enabled: false }
                            });
                        }
                    }
                }
            }

            for (const post of posts) {
                if (!post.comments || !post.comments.data) continue;

                for (const comment of post.comments.data) {
                    await botEngine.processComment(comment, page, rules, page.userId);
                }
            }
        } catch (err) {
            console.error(`      ❌ Error fetching feed for ${page.name}:`, err.message);
        }
    },

    /**
     * 💬 Process a single comment
     */
    processComment: async (comment, page, rules, userId) => {
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

        const commentText = (comment.message || "").toLowerCase();
        // Post ID format in comment is usually POSTID_COMMENTID
        const currentPostId = comment.id.split('_')[0];

        const matchedRules = rules.filter((r) => {
            // Check scope
            if (r.scope === "SPECIFIC" && r.postId !== currentPostId) return false;

            // Check keyword
            // If keyword is * or empty, it matches any text
            if (!r.keyword || r.keyword.trim() === '*' || r.keyword.trim() === '') return true;

            if (r.ruleType === "KEYWORD") {
                return commentText.includes(r.keyword.toLowerCase());
            } else if (r.ruleType === "REGEX") {
                try {
                    const regex = new RegExp(r.keyword, "i");
                    return regex.test(commentText);
                } catch (e) {
                    return false;
                }
            }
            return false;
        });

        // 🎯 5.1 Pick ONE rule randomly if multiple match (Rule Rotation)
        if (matchedRules.length > 0) {
            const pickedRule = matchedRules[Math.floor(Math.random() * matchedRules.length)];
            replyMessage = pickedRule.reply;
            attachmentUrl = pickedRule.attachmentUrl;
        }

        // 🚀 6. Queue Reply (Smart Delay)
        if (replyMessage) {
            try {
                // --- 🧠 Spintax Support {good|hi|hello} ---
                const spintaxRegex = /\{([^{}|]+(?:\|[^{}|]+)+)\}/g;
                let finalReply = replyMessage.replace(spintaxRegex, (match, options) => {
                    const choices = options.split('|');
                    return choices[Math.floor(Math.random() * choices.length)];
                });

                // --- ⏳ Smart Delay Calculation ---
                // Get current pending count to adjust delay
                const pendingCount = await prisma.pendingReply.count({ where: { status: "pending" } });
                
                let baseDelay = 60000; // 1 min default
                if (pendingCount > 50) baseDelay = 120000; // 2 mins if busy
                if (pendingCount > 100) baseDelay = 180000; // 3 mins if viral

                const randomExtra = Math.floor(Math.random() * 60000); // + 0-60s
                const delayMs = baseDelay + randomExtra;
                const sendAt = new Date(Date.now() + delayMs);

                console.log(`      ⏳ Queued (${pendingCount} pending): ${finalReply.substring(0,20)}... (Delay: ${Math.round(delayMs / 1000)}s)`);

                await prisma.pendingReply.create({
                    data: {
                        userId: userId,
                        commentId: comment.id,
                        replyMessage: finalReply,
                        attachmentUrl: attachmentUrl,
                        pageId: page.id,
                        accessToken: encrypt(page.access_token), // 🔒 Encrypt!
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
