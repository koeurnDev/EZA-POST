/**
 * 🤖 Autonomous Video Carousel Agent
 * ==========================================
 * Implementation of the specific user request to post a video carousel.
 * 
 * Usage:
 * node backend/tests/autonomous_video_poster.js
 * 
 * Env Variables (or edit below):
 * - PAGE_ACCESS_TOKEN
 * - PAGE_ID
 * - VIDEO_PATH
 * - THUMBNAIL_PATH
 */

require("dotenv").config();
const fb = require("../utils/fb");
const fs = require("fs");
const path = require("path");

// 🛠️ Configuration (Load from Env or Defaults)
const CONFIG = {
    accessToken: process.env.PAGE_ACCESS_TOKEN || "YOUR_PAGE_ACCESS_TOKEN",
    pageId: process.env.PAGE_ID || "YOUR_PAGE_ID",
    videoPath: process.env.VIDEO_PATH || path.join(__dirname, "sample_video.mp4"),
    thumbnailPath: process.env.THUMBNAIL_PATH || path.join(__dirname, "sample_thumb.jpg"),
    caption: "Check out our video!"
};

async function runAgent() {
    try {
        // 0. Validate Inputs
        if (!fs.existsSync(CONFIG.videoPath)) throw new Error(`Video file not found: ${CONFIG.videoPath}`);
        if (!fs.existsSync(CONFIG.thumbnailPath)) throw new Error(`Thumbnail file not found: ${CONFIG.thumbnailPath}`);
        if (CONFIG.accessToken === "YOUR_PAGE_ACCESS_TOKEN") throw new Error("Missing PAGE_ACCESS_TOKEN");

        // Step 1: Upload video to the Facebook Page using /page-id/videos
        // logic: uploadVideoForCarousel handles this (is_published=false)
        const videoStream = fs.createReadStream(CONFIG.videoPath);
        const thumbStream = fs.createReadStream(CONFIG.thumbnailPath);

        // We use the internal fb utility which wraps the Graph API calls exactly as requested
        // Step 1 & 2 are handled here
        const uploadResult = await fb.uploadVideoForCarousel(
            CONFIG.accessToken,
            CONFIG.pageId,
            videoStream,
            thumbStream
        );

        if (!uploadResult.success) {
            throw new Error(`Upload failed: ${uploadResult.error}`);
        }

        const videoId = uploadResult.id;

        // Step 2: Use returned video_id to create a carousel post with /page-id/feed
        // Required payload: child_attachments with media_fbid

        const childAttachments = [
            {
                media_fbid: videoId,
                link: `https://facebook.com/${CONFIG.pageId}`, // Required field for carousel cards typically
                name: CONFIG.caption,
                description: "Swipe to watch" // Default description
            }
        ];

        // Using fb.postCarousel to handle the feed posting
        // Alternatively, we could direct call axios to be "pure" to the prompt, but reusing logic is robust.
        // The prompt asks to "Post to /page-id/feed". fb.postCarousel does: axios.post(`${graph}/${id}/feed`, payload)

        const account = {
            id: CONFIG.pageId,
            name: "Target Page",
            access_token: CONFIG.accessToken,
            type: "page"
        };

        const postResult = await fb.postCarousel(
            CONFIG.accessToken, // User token (fallback)
            [account],          // Targets
            CONFIG.caption,     // Parent Caption
            childAttachments    // Cards
        );

        if (postResult.successCount > 0) {
            // Step 3: Return post ID and success message
            const finalOutput = {
                post_id: postResult.details[0].postId,
                status: "success"
            };
            console.log(JSON.stringify(finalOutput, null, 2));
        } else {
            throw new Error(postResult.details[0]?.error || "Post creation failed");
        }

    } catch (error) {
        // Handle all errors
        const errorOutput = {
            status: "error",
            message: error.message
        };
        console.error(JSON.stringify(errorOutput, null, 2));
        process.exit(1);
    }
}

// Execute
runAgent();
