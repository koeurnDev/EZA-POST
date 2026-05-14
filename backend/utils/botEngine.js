const prisma = require("./prisma");
const { encrypt, decrypt } = require("./crypto");
const axios = require("axios");
const fb = require("./fb");

const botEngine = {
    isRunning: false, // 🛡️ Lock to prevent overlapping runs
    /**
     * 🚀 Main Bot Loop
     */
    run: async () => {
        if (botEngine.isRunning) {
            console.log("⏳ Bot Engine: Previous run still in progress. Skipping this cycle.");
            return;
        }

        try {
            botEngine.isRunning = true;
            console.log("🤖 Bot Engine: Starting run cycle...");

            // 1️⃣ Process Pending Replies (Queue)
            await botEngine.processPendingReplies();

            // 2️⃣ Maintenance: Cleanup old history/logs (> 30 days) to keep DB fast 🧹
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            await Promise.all([
                prisma.botHistory.deleteMany({ where: { timestamp: { lt: thirtyDaysAgo } } }),
                prisma.repliedComment.deleteMany({ where: { createdAt: { lt: thirtyDaysAgo } } })
            ]);

            // 3️⃣ Get All Users with Facebook Connected
            // In Prisma, we check if facebookAccessToken is not null
            const users = await prisma.user.findMany({
                where: { facebookAccessToken: { not: null } },
                include: { facebookPages: true }
            });
            console.log(`🤖 Bot Engine: Found ${users.length} users with FB tokens.`);

            // 🚀 4️⃣ Process users in chunks (Batch of 10) to prevent memory overload
            const chunkSize = 10;
            for (let i = 0; i < users.length; i += chunkSize) {
                const chunk = users.slice(i, i + chunkSize);
                await Promise.allSettled(chunk.map(async (user) => {
                    try {
                        const botStatus = await prisma.botStatus.findUnique({ where: { userId: user.id } });
                        if (botStatus && !botStatus.enabled) return;

                        await botEngine.processUser(user);
                    } catch (err) {
                        console.error(`   ❌ Error processing user ${user.name}:`, err.message);
                    }
                }));
            }
            console.log("🤖 Bot Engine: Run cycle complete.");
        } finally {
            botEngine.isRunning = false;
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
                    status: 'pending',
                    sendAt: { lte: now },
                    attempts: { lt: 5 } // 🚀 Only attempt 5 times
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
                            postId: reply.postId, // 🎯 Use the field directly
                            userId: reply.userId
                        }
                    });

                    console.log(`      ✅ Reply sent successfully!`);

                } catch (err) {
                    const fbError = err.response?.data || err.message;
                    console.error(`   ❌ Failed to send reply ${reply.id}:`, fbError);
                    // 📝 Update attempt count and error message
                    await prisma.pendingReply.update({
                        where: { id: reply.id },
                        data: {
                            attempts: { increment: 1 },
                            error: typeof fbError === 'string' ? fbError : JSON.stringify(fbError),
                            status: reply.attempts >= 4 ? 'failed' : 'pending'
                        }
                    });

                    await prisma.botHistory.create({
                        data: {
                            userId: reply.userId,
                            commentId: reply.commentId,
                            replyMessage: reply.replyMessage,
                            pageId: reply.pageId,
                            status: "failed",
                            error: typeof fbError === 'string' ? fbError : JSON.stringify(fbError),
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
            console.log(`   🤖 Processing user ${user.name}...`);

            // Validate Token
            const decryptedToken = decrypt(user.facebookAccessToken);
            const validation = await fb.validateAccessToken(decryptedToken);
            if (!validation.isValid) {
                console.warn(`   ⚠️ Invalid token for user ${user.name} (ID: ${user.id})`);
                return;
            }

            // Get Pages from DB
            const dbPages = user.facebookPages || [];
            
            let pageSettings = user.pageSettings;
            if (typeof pageSettings === 'string') {
                try { pageSettings = JSON.parse(pageSettings); } catch (e) { pageSettings = []; }
            }
            if (!Array.isArray(pageSettings)) pageSettings = [];

            const activePages = dbPages.filter(page => {
                const settings = pageSettings.find(s => s.pageId === page.id);
                // ✅ Fix: Prioritize User.pageSettings (settings), fallback to FacebookPage.enableBot
                const isBotEnabled = settings?.enableBot ?? page.enableBot ?? false;
                const isSelected = page.isSelected === true;
                
                if (!isSelected) console.log(`      ⏩ Page ${page.name} skipped: Not selected/connected.`);
                else if (!isBotEnabled) console.log(`      ⏩ Page ${page.name} skipped: Bot not enabled for this page.`);
                
                return isSelected && isBotEnabled;
            }).map(page => ({
                ...page,
                access_token: decrypt(page.accessToken)
            }));

            if (activePages.length === 0) {
                console.log(`   ⏩ User ${user.name} has no active/connected pages with bot enabled.`);
                return;
            }

            // Get Rules
            const rules = await prisma.botRule.findMany({ 
                where: { userId: user.id, enabled: true },
                orderBy: { createdAt: 'desc' } // ✅ Newest rules first
            });
            
            if (rules.length === 0) {
                console.log(`   ⏩ User ${user.name} has no active rules.`);
                return;
            }

            console.log(`   ✅ User ${user.name} has ${activePages.length} active pages and ${rules.length} rules.`);

            // 🚀 Process all active pages in parallel
            await Promise.allSettled(activePages.map(async (page) => {
                try {
                    await botEngine.processPage(page, rules);
                } catch (err) {
                    console.error(`      ❌ Error processing page ${page.name}:`, err.message);
                }
            }));
        } catch (err) {
            console.error(`❌ Error processing user ${user.name}:`, err.message);
        }
    },

    /**
     * 📄 Process a single page's posts
     */
    processPage: async (page, rules) => {
        try {
            // 1️⃣ Fetch recent posts (Last 10 instead of 20, reduced for performance)
            const res = await axios.get(`${fb.graph}/${page.id}/feed`, {
                params: {
                    access_token: page.access_token,
                    fields: "id,message,created_time,comments.limit(50).order(chronological){id,message,from,created_time}",
                    limit: 10, // Reduced from 20 to 10
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
                                fields: "id,message,comments.limit(100).order(chronological){id,message,from,created_time}",
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
        const currentPostId = comment.postId || comment.id.split('_')[0];

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
                // --- 👤 Variable Support: [[name]] ---
                let finalReply = replyMessage.replace(/\[\[name\]\]/g, comment.from?.name || "ភ្ញៀវ");

                // --- 🧠 Spintax Support {good|hi|hello} ---
                const spintaxRegex = /\{([^{}|]+(?:\|[^{}|]+)+)\}/g;
                finalReply = finalReply.replace(spintaxRegex, (match, options) => {
                    const choices = options.split('|');
                    return choices[Math.floor(Math.random() * choices.length)];
                });

                // --- ⏳ Smart Delay Calculation ---
                // Get current pending count to adjust delay
                const pendingCount = await prisma.pendingReply.count({ where: { status: "pending" } });
                
                let baseDelay = 30000; // 30s default (Faster)
                if (pendingCount > 50) baseDelay = 60000; // 1 min if busy
                if (pendingCount > 100) baseDelay = 120000; // 2 mins if viral

                const randomExtra = Math.floor(Math.random() * 30000); // + 0-30s
                const delayMs = baseDelay + randomExtra;
                const sendAt = new Date(Date.now() + delayMs);

                console.log(`      ⏳ Queued (${pendingCount} pending): ${finalReply.substring(0,20)}... (Delay: ${Math.round(delayMs / 1000)}s)`);

                await prisma.pendingReply.create({
                    data: {
                        userId: userId,
                        commentId: comment.id,
                        postId: comment.postId || comment.id.split('_')[0], // 🎯 Added missing field!
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
