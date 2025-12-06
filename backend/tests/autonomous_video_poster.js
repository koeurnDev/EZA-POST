/**
 * 🤖 Autonomous Video Carousel Agent (Refined)
 * ==========================================
 * Fully automated script to post a video-only carousel to Facebook.
 * 
 * Features:
 * 1. Auto-fetches Page Access Token using USER_ACCESS_TOKEN.
 * 2. Uploads video to Facebook (unpublished).
 * 3. Creates a Carousel Post with a SINGLE video card (no page card).
 * 4. Outputs JSON result.
 * 
 * Usage:
 * node backend/tests/autonomous_video_poster.js
 * 
 * Env Variables:
 * - USER_ACCESS_TOKEN (Required)
 * - PAGE_ID (Optional - will default to first found page if missing)
 * - VIDEO_PATH (Optional)
 * - THUMBNAIL_PATH (Optional)
 */

require("dotenv").config();
const fb = require("../utils/fb");
const fs = require("fs");
const path = require("path");

// 🛠️ Configuration
const CONFIG = {
    // START HERE: We need a User Token to get the Page Token
    userAccessToken: process.env.USER_ACCESS_TOKEN || "YOUR_USER_ACCESS_TOKEN",

    // Target Page ID (Optional, will pick first if null)
    targetPageId: process.env.PAGE_ID,

    // Assets
    videoPath: process.env.VIDEO_PATH || path.join(__dirname, "sample_video.mp4"),
    thumbnailPath: process.env.THUMBNAIL_PATH || path.join(__dirname, "sample_thumb.jpg"),

    // Post Details
    caption: "Check out our video!"
};

async function runAgent() {
    try {
        // 0. Validate Inputs
        if (!fs.existsSync(CONFIG.videoPath)) throw new Error(`Video file not found: ${CONFIG.videoPath}`);
        if (CONFIG.userAccessToken === "YOUR_USER_ACCESS_TOKEN") throw new Error("Missing USER_ACCESS_TOKEN env var");

        console.log("🤖 Agent Started: Fetching Pages...");

        // Step 0: Auto-Fetch Page Token
        // using fb.getFacebookPages(userAccessToken)
        const pages = await fb.getFacebookPages(CONFIG.userAccessToken);

        if (pages.length === 0) throw new Error("No Facebook Pages found for this user.");

        // Select Page
        let targetPage = null;
        if (CONFIG.targetPageId) {
            targetPage = pages.find(p => p.id === CONFIG.targetPageId);
            if (!targetPage) console.warn(`⚠️ Target Page ID ${CONFIG.targetPageId} not found in user accounts. Switching to first available.`);
        }

        if (!targetPage) targetPage = pages[0];

        const PAGE_ID = targetPage.id;
        const PAGE_ACCESS_TOKEN = targetPage.access_token; // Decrypted/Available from API response

        console.log(`✅ Selected Page: ${targetPage.name} (ID: ${PAGE_ID})`);

        // Step 1: Upload Video
        console.log("📤 Uploading Video...");
        const videoStream = fs.createReadStream(CONFIG.videoPath);

        let thumbStream = null;
        if (fs.existsSync(CONFIG.thumbnailPath)) {
            thumbStream = fs.createReadStream(CONFIG.thumbnailPath);
        }

        const uploadResult = await fb.uploadVideoForCarousel(
            PAGE_ACCESS_TOKEN,
            PAGE_ID,
            videoStream,
            thumbStream
        );

        if (!uploadResult.success) {
            throw new Error(`Video Upload failed: ${uploadResult.error}`);
        }

        const videoId = uploadResult.id;
        console.log(`✅ Video Uploaded. ID: ${videoId}`);

        // Step 2: Create Carousel Post (Video Only)
        // Option 1 Payload Structure:
        // {
        //   "caption": "...",
        //   "accounts": ["..."],
        //   "carouselCards": [{ type: "video", ... }] 
        // }
        // BUT we are using fb.postCarousel directly which takes 'child_attachments'.

        // Construct the single video card attachment
        const childAttachments = [
            {
                media_fbid: videoId,
                link: `https://facebook.com/${PAGE_ID}`, // Required fallback link
                name: "EZA POST", // Headline
                description: "Swipe to see more" // Description
            }
        ];

        console.log("📦 Creating Carousel Post...");

        const accountObj = {
            id: PAGE_ID,
            name: targetPage.name,
            access_token: PAGE_ACCESS_TOKEN,
            type: "page"
        };

        const postResult = await fb.postCarousel(
            PAGE_ACCESS_TOKEN, // Fallback/User token
            [accountObj],      // Targets
            CONFIG.caption,    // Main Caption
            childAttachments   // Cards (Mapped to child_attachments)
        );

        if (postResult.successCount > 0) {
            // Step 3: Success Output
            const finalOutput = {
                post_id: postResult.details[0].postId,
                status: "success"
            };
            console.log("✅ RESULT:");
            console.log(JSON.stringify(finalOutput, null, 2));
        } else {
            throw new Error(postResult.details[0]?.error || "Post creation failed");
        }

    } catch (error) {
        // Handle all errors cleanly
        const errorOutput = {
            status: "error",
            message: error.message
        };
        console.error("❌ ERROR:");
        console.error(JSON.stringify(errorOutput, null, 2));
        process.exit(1);
    }
}

// Execute
runAgent();
