/**
 * 🎣 facebook.js — Facebook Webhook Handler
 * Handles real-time events like comments for Auto-Reply Bot
 */

const express = require("express");
const router = express.Router();
const axios = require("axios");
const User = require("../../models/User");

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

                        // 🤖 Trigger Auto-Reply
                        await handleAutoReply(pageId, commentId, message);
                    }
                }
            }
        }
    } else {
        res.sendStatus(404);
    }
});

/**
 * 🤖 Auto-Reply Logic
 */
async function handleAutoReply(pageId, commentId, userMessage) {
    try {
        // 1️⃣ Find User who owns this Page
        // We need to search all users to find who has this page connected
        // This is inefficient for millions of users but fine for MVP
        const user = await User.findOne({
            "connectedPages.id": pageId,
            "pageSettings.pageId": pageId,
            "pageSettings.enableBot": true // ✅ Check if bot is enabled
        });

        if (!user) {
            console.log(`⚠️ No bot enabled for Page ${pageId}`);
            return;
        }

        // 2️⃣ Get Page Access Token
        const page = user.connectedPages.find(p => p.id === pageId);
        if (!page || !page.access_token) return;

        // 3️⃣ Determine Reply
        // Simple keyword matching for now
        let replyMessage = "Thanks for your comment! We'll get back to you soon.";
        const lowerMsg = userMessage.toLowerCase();

        if (lowerMsg.includes("price") || lowerMsg.includes("cost")) {
            replyMessage = "Please send us a message for pricing details! 💰";
        } else if (lowerMsg.includes("location") || lowerMsg.includes("where")) {
            replyMessage = "We are located in Phnom Penh! 📍";
        }

        // 4️⃣ Send Reply via Graph API
        const pageToken = user.getDecryptedPageToken(pageId);
        if (!pageToken) return;

        await axios.post(`https://graph.facebook.com/v19.0/${commentId}/comments`, {
            message: replyMessage,
            access_token: pageToken
        });

        console.log(`✅ Auto-Replied to ${commentId}: "${replyMessage}"`);

    } catch (err) {
        console.error("❌ Auto-Reply Failed:", err.response?.data || err.message);
    }
}

module.exports = router;
