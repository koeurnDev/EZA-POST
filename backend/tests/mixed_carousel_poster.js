/**
 * 🎠 Mixed Carousel Agent (Video + Auto Profile Pic)
 * =================================================
 * Posts a 2-card carousel to Facebook:
 * 1. Card 1: Local Video (backend/temp/videos/sample_video.mp4)
 * 2. Card 2: Page's Current Profile Picture (Auto-downloaded/re-uploaded)
 * 
 * Usage:
 * node backend/tests/mixed_carousel_poster.js
 * 
 * Env Variables:
 * - USER_ACCESS_TOKEN (Required)
 * - PAGE_ID (Optional, auto-selects if missing)
 * - VIDEO_PATH (Optional override)
 */

require("dotenv").config();
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

// 🛠️ Configuration
const CONFIG = {
    userAccessToken: process.env.USER_ACCESS_TOKEN,
    videoPath: process.env.VIDEO_PATH || path.join(__dirname, "../temp/videos/sample_video.mp4"),
    graphUrl: "https://graph.facebook.com/v19.0"
};

async function runAgent() {
    try {
        if (!CONFIG.userAccessToken) throw new Error("Missing USER_ACCESS_TOKEN env var");
        if (!fs.existsSync(CONFIG.videoPath)) throw new Error(`Video not found at: ${CONFIG.videoPath}`);

        console.log("🤖 Agent Started: Mixed Carousel (Video + Profile Pic)");

        // ======================================================
        // Step 1: Authentication (Get Page Token)
        // ======================================================
        console.log("🔐 Fetching Page Access Token...");
        const accountsRes = await axios.get(`${CONFIG.graphUrl}/me/accounts`, {
            params: { access_token: CONFIG.userAccessToken, fields: "access_token,id,name,picture{url}" }
        });

        const pages = accountsRes.data.data;
        if (!pages || pages.length === 0) throw new Error("No pages found.");

        // Select Page (Use env PAGE_ID if set, else first)
        const targetPage = process.env.PAGE_ID
            ? pages.find(p => p.id === process.env.PAGE_ID)
            : pages[0];

        if (!targetPage) throw new Error("Target page not found.");

        const PAGE_ID = targetPage.id;
        const PAGE_ACCESS_TOKEN = targetPage.access_token;
        const PAGE_URL = `https://facebook.com/${PAGE_ID}`;

        console.log(`✅ Selected Page: ${targetPage.name} (${PAGE_ID})`);

        // ======================================================
        // Step 2: Upload Video (Card 1)
        // ======================================================
        console.log("📤 Card 1: Uploading Video...");
        const videoForm = new FormData();
        videoForm.append("access_token", PAGE_ACCESS_TOKEN);
        videoForm.append("published", "false"); // Draft mode
        videoForm.append("source", fs.createReadStream(CONFIG.videoPath), {
            filename: "video.mp4",
            contentType: "video/mp4"
        });

        const videoRes = await axios.post(`${CONFIG.graphUrl}/${PAGE_ID}/videos`, videoForm, {
            headers: videoForm.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        const VIDEO_ID = videoRes.data.id;
        console.log(`✅ Video Uploaded (ID: ${VIDEO_ID})`);

        // ======================================================
        // Step 3: Auto-Upload Profile Picture (Card 2)
        // ======================================================
        console.log("🖼️ Card 2: Fetching & Re-uploading Profile Picture...");

        // 3a. Fetch Picture URL (High Res)
        const picUrlRes = await axios.get(`${CONFIG.graphUrl}/${PAGE_ID}/picture`, {
            params: { width: 1000, redirect: false, access_token: PAGE_ACCESS_TOKEN }
        });
        const picUrl = picUrlRes.data.data.url;
        console.log(`🔗 Profile Pic URL: ${picUrl}`);

        // 3b. Download Stream
        const picStream = await axios.get(picUrl, { responseType: 'stream' });

        // 3c. Upload As Photo (Unpublished)
        const photoForm = new FormData();
        photoForm.append("access_token", PAGE_ACCESS_TOKEN);
        photoForm.append("published", "false");
        photoForm.append("source", picStream.data, {
            filename: "profile_pic.jpg",
            contentType: "image/jpeg"
        });

        const photoRes = await axios.post(`${CONFIG.graphUrl}/${PAGE_ID}/photos`, photoForm, {
            headers: photoForm.getHeaders()
        });

        const PHOTO_ID = photoRes.data.id;
        console.log(`✅ Profile Photo Re-uploaded (ID: ${PHOTO_ID})`);

        // ======================================================
        // Step 4: Create Carousel Post
        // ======================================================
        console.log("📦 Creating Mixed Carousel Post...");

        const childAttachments = [
            {
                media_fbid: VIDEO_ID,
                link: PAGE_URL,
                description: "Watch Video"
            },
            {
                media_fbid: PHOTO_ID,
                link: PAGE_URL,
                description: "Follow Us"
            }
        ];

        const feedPayload = {
            access_token: PAGE_ACCESS_TOKEN,
            message: "Check out our video!",
            link: PAGE_URL, // Parent link required
            child_attachments: childAttachments,
            published: true
        };

        const feedRes = await axios.post(`${CONFIG.graphUrl}/${PAGE_ID}/feed`, feedPayload);

        // ======================================================
        // Step 5: Output
        // ======================================================
        console.log("✅ REQUEST SUCCESSFUL");
        console.log(JSON.stringify({
            post_id: feedRes.data.id,
            status: "success",
            cards: [
                { type: "video", id: VIDEO_ID },
                { type: "photo", id: PHOTO_ID }
            ]
        }, null, 2));

    } catch (error) {
        console.error("❌ ERROR:");
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

runAgent();
