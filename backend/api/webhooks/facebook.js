/**
 * 🎣 facebook.js — Facebook Webhook Handler
 * Handles real-time events like comments for Auto-Reply Bot
 */

const express = require("express");
const router = express.Router();
const axios = require("axios");
const { decrypt } = require("../../utils/crypto");
const prisma = require("../../utils/prisma");
const botEngine = require("../../utils/botEngine");


// ============================================================
// ✅ GET /api/webhooks/facebook
// Verification Challenge (Required by Facebook)
// ============================================================
router.get("/", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // 🔐 Verify Token (Must match what you set in FB Dashboard)
    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || "kr_post_verify_token";

    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("✅ Webhook Verified!");
            res.status(200).send(challenge);
        } else {
            console.error("❌ Webhook Verification Failed");
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// ============================================================
// ✅ POST /api/webhooks/facebook
// Handle Incoming Events (Comments, etc.)
// ============================================================
router.post("/", async (req, res) => {
    const body = req.body;

    // 1️⃣ Check if it's a page event
    if (body.object === "page") {
        res.status(200).send("EVENT_RECEIVED"); // Acknowledge immediately

        // 2️⃣ Iterate over entries
        for (const entry of body.entry) {
            const pageId = entry.id;
            const changes = entry.changes || [];

            // 3️⃣ Handle 'feed' changes (Comments)
            for (const change of changes) {
                if (change.field === "feed") {
                    const value = change.value;
                    const item = value.item;
                    const verb = value.verb;

                    // 🎯 Detect New Comment
                    if (item === "comment" && verb === "add") {
                        const commentId = value.comment_id;
                        const message = value.message;
                        const senderId = value.from?.id;
                        const senderName = value.from?.name;

                        // Avoid replying to self
                        if (senderId === pageId) continue;

                        console.log(`💬 New Comment on Page ${pageId}: "${message}" from ${senderName}`);

                        // 🤖 Trigger Auto-Reply via Bot Engine
                        await handleWebhookComment(pageId, commentId, message, senderId, senderName);
                    }
                }
            }
        }
    } else {
        res.sendStatus(404);
    }
});

/**
 * 🤖 Handle Webhook Comment -> Pass to Bot Engine
 */
async function handleWebhookComment(pageId, commentId, message, senderId, senderName) {
    try {
        const prisma = require("../../utils/prisma");

        // 1️⃣ Find User & Page via FacebookPage table
        const pageRecord = await prisma.facebookPage.findUnique({
            where: { id: pageId },
            include: { user: true }
        });

        if (!pageRecord || !pageRecord.user) return;

        const user = pageRecord.user;

        // Check Page Settings for Bot Enablement
        let pageSettings = user.pageSettings;
        if (typeof pageSettings === 'string') {
            try { pageSettings = JSON.parse(pageSettings); } catch (e) { pageSettings = []; }
        }
        if (!Array.isArray(pageSettings)) pageSettings = [];

        const settings = pageSettings.find(s => s.pageId === pageId);
        if (!settings || !settings.enableBot) return;

        const pageToken = decrypt(pageRecord.accessToken);
        if (!pageToken) return;

        // 2️⃣ Get Rules
        const rules = await prisma.botRule.findMany({ where: { enabled: true } });
        if (rules.length === 0) return;

        // 3️⃣ Construct Comment Object
        const commentObj = {
            id: commentId,
            message: message,
            from: {
                id: senderId,
                name: senderName
            }
        };

        // 4️⃣ Process via Engine
        const pageForEngine = {
            id: pageId,
            access_token: pageToken,
            name: pageRecord.name
        };

        await botEngine.processComment(commentObj, pageForEngine, rules);
        console.log(`🔄 Webhook comment processed by Bot Engine: ${commentId}`);

    } catch (err) {
        console.error("❌ Webhook Handler Error:", err.message);
    }
}

module.exports = router;
