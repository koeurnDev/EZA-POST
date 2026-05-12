/**
 * 🛠️ postService.js — Core logic for processing and publishing posts.
 * This service is decoupled from Express req/res objects.
 */

const fs = require("fs");
const path = require("path");
const prisma = require('../utils/prisma');
const fb = require("../utils/fb");
const axios = require("axios");
const { processVideo, extractThumbnail, processImage } = require("./videoProcessor");
const tiktokDownloader = require("../utils/tiktokDownloader");
const { decrypt } = require("../utils/crypto");

// ✅ SSRF Protection: Trusted Domains
const TRUSTED_DOMAINS = [
    "tiktok.com", "douyin.com", "facebook.com", "fbcdn.net", 
    "instagram.com", "cdninstagram.com", "googleusercontent.com",
    "cloudinary.com"
];

const isTrustedUrl = (url) => {
    if (!url) return true;
    try {
        const parsed = new URL(url);
        return TRUSTED_DOMAINS.some(domain => parsed.hostname.endsWith(domain));
    } catch (e) { return false; }
};

/**
 * Core logic for processing and posting a Mixed Media Carousel.
 * @param {Object} data - Contains all necessary data for processing.
 * @param {Function} onProgress - Optional callback to report progress (0-100).
 */
async function processAndPostCarouselLogic({ userId, accountsArray, caption, scheduleTime, videoUrl, videoFilePath, thumbnailFilePath, rightSideImageFilePath, aiOptions, carouselCards }, onProgress = () => {}) {
    let tempFiles = [];
    const results = { successCount: 0, failedCount: 0, details: [] };

    try {
        if (onProgress) onProgress(10);
        // ✅ SSRF Check
        if (videoUrl && !isTrustedUrl(videoUrl)) {
            throw new Error("SSRF Blocked: Untrusted video URL domain.");
        }

        // 1. Prepare Inputs
        let videoInput = null;
        if (videoFilePath && fs.existsSync(videoFilePath)) {
            videoInput = fs.createReadStream(videoFilePath);
            tempFiles.push(videoFilePath);
        } else if (videoUrl) {
            videoInput = videoUrl;
        }

        let thumbnailInput = null;
        if (thumbnailFilePath && fs.existsSync(thumbnailFilePath)) {
            thumbnailInput = fs.createReadStream(thumbnailFilePath);
            tempFiles.push(thumbnailFilePath);
        }

        let rightSideImageInput = null;
        if (rightSideImageFilePath && fs.existsSync(rightSideImageFilePath)) {
            rightSideImageInput = fs.createReadStream(rightSideImageFilePath);
            tempFiles.push(rightSideImageFilePath);
        }

        if (onProgress) onProgress(20);

        // 🚨 1.5. Process Video (Square Pad + AI Options)
        let processedVideoPath = null;
        const outputDir = path.join(__dirname, "../../temp/videos");

        if (videoFilePath && fs.existsSync(videoFilePath)) {
            try {
                const finalAiOptions = aiOptions || {};
                finalAiOptions.squarePad = true; // Force 1:1

                console.log(`🎬 [Service] Processing video for 1:1 compatibility...`);
                processedVideoPath = await processVideo(videoFilePath, outputDir, finalAiOptions);
                tempFiles.push(processedVideoPath);

                // Auto-extract thumbnail if missing
                if (!thumbnailInput) {
                    try {
                        const autoThumbPath = await extractThumbnail(processedVideoPath, outputDir);
                        thumbnailInput = fs.createReadStream(autoThumbPath);
                        tempFiles.push(autoThumbPath);
                    } catch (e) {}
                }
            } catch (procErr) {
                console.error("❌ Video processing failed:", procErr.message);
            }
        } else if (videoUrl) {
            // Handle TikTok download and process
            try {
                const dlRes = await tiktokDownloader.downloadTiktokVideo(videoUrl);
                if (dlRes && dlRes.buffer) {
                    const downloadPath = path.join(outputDir, `download_${Date.now()}.mp4`);
                    fs.writeFileSync(downloadPath, dlRes.buffer);
                    tempFiles.push(downloadPath);

                    const finalAiOptions = aiOptions || {};
                    finalAiOptions.squarePad = true;
                    processedVideoPath = await processVideo(downloadPath, outputDir, finalAiOptions);
                    tempFiles.push(processedVideoPath);
                }
            } catch (dlErr) {
                console.warn("⚠️ Failed to process external video, using direct URL.");
                videoInput = videoUrl;
            }
        }

        // 🚨 1.6. Process Right-Side Image
        let processedRightSidePath = null;
        if (rightSideImageFilePath && fs.existsSync(rightSideImageFilePath)) {
            try {
                processedRightSidePath = await processImage(rightSideImageFilePath, outputDir);
                tempFiles.push(processedRightSidePath);
            } catch (imgErr) {}
        }

        // 2. Process Per Account
        for (const accountId of accountsArray) {
            try {
                const page = await prisma.facebookPage.findFirst({
                    where: { id: accountId, userId: userId }
                });

                let pageToken = page ? decrypt(page.accessToken) : null;
                let pageName = page ? page.name : "Unknown Page";

                if (!pageToken) throw new Error(`Page ${accountId} not found or invalid token`);

                console.log(`🚀 Publishing Carousel for ${pageName}...`);

                const childAttachments = [];
                const defaultLink = `https://facebook.com/${accountId}`;

                for (const [index, card] of carouselCards.entries()) {
                    let mediaFbid = null;
                    
                    // Upload Media logic (Simplified for service)
                    if (card.type === 'video') {
                        let currentVideo = processedVideoPath ? fs.createReadStream(processedVideoPath) : (videoFilePath ? fs.createReadStream(videoFilePath) : videoUrl);
                        let currentThumb = thumbnailInput ? (typeof thumbnailInput === 'string' ? thumbnailInput : fs.createReadStream(thumbnailInput.path || thumbnailFilePath)) : null;
                        
                        const vRes = await fb.uploadVideoForCarousel(pageToken, accountId, currentVideo, currentThumb);
                        mediaFbid = vRes.id;
                    } else if (card.isPageCard) {
                        // Auto Page Pic
                        const picUrlRes = await axios.get(`https://graph.facebook.com/v19.0/${accountId}/picture`, {
                            params: { width: 1000, redirect: false, access_token: pageToken }
                        });
                        const picUrl = picUrlRes.data?.data?.url;
                        if (picUrl) {
                            const picStream = await axios.get(picUrl, { responseType: 'stream' });
                            const pRes = await fb.uploadPhotoForCarousel(pageToken, accountId, picStream.data);
                            mediaFbid = pRes.id;
                        }
                    } else if (card.imageUrl) {
                        const pRes = await fb.uploadPhotoForCarousel(pageToken, accountId, card.imageUrl);
                        mediaFbid = pRes.id;
                    }

                    childAttachments.push({
                        link: card.link || defaultLink,
                        name: card.headline || pageName,
                        description: card.description || "Swipe to see more",
                        media_fbid: mediaFbid,
                        call_to_action: card.cta && card.cta !== 'NO_BUTTON' ? { type: card.cta, value: { link: card.link || defaultLink } } : undefined
                    });
                }

                const feedRes = await fb.postCarousel(pageToken, [{ id: accountId, name: pageName, type: 'page' }], caption, childAttachments, {
                    isScheduled: !!scheduleTime,
                    scheduleTime: scheduleTime ? Math.floor(new Date(scheduleTime).getTime() / 1000) : null
                });

                if (feedRes.successCount > 0) {
                    const fbPostId = feedRes.details[0].postId;
                    await prisma.postLog.create({
                        data: {
                            userId, pageId: accountId, fbPostId, type: "carousel",
                            status: scheduleTime ? "scheduled" : "published",
                            scheduledTime: scheduleTime ? new Date(scheduleTime) : null
                        }
                    });
                    results.successCount++;
                    results.details.push({ accountId, status: "success", postId: fbPostId });
                }
            } catch (err) {
                console.error(`❌ Failed for ${accountId}:`, err.message);
                results.failedCount++;
                results.details.push({ accountId, status: "failed", error: err.message });
            }
        }

        return results;
    } catch (err) {
        console.error("❌ Post Service Error:", err.message);
        throw err;
    } finally {
        for (const f of tempFiles) {
            if (f && fs.existsSync(f)) {
                try { fs.unlinkSync(f); } catch (e) {}
            }
        }
    }
}

/**
 * Core logic for processing and posting a Single Video Post.
 */
async function processSinglePostLogic({ userId, accountsArray, caption, title, scheduleTime, staggerDelay, videoUrl, videoFilePath, thumbnailFilePath, aiOptions, autoComment, tiktokUrl }, onProgress = () => {}) {
    let tempFiles = [];
    const results = { successCount: 0, failedCount: 0, details: [] };

    try {
        if (onProgress) onProgress(10);

        let finalVideoPath = videoFilePath;
        const outputDir = path.join(__dirname, "../../temp/videos");

        // 🚨 AI Randomizer Processing
        if (videoFilePath && fs.existsSync(videoFilePath)) {
            if (aiOptions && (aiOptions.pitchShift || aiOptions.flip || aiOptions.safeMode)) {
                console.log("🤖 [Service] Applying AI Randomizer...", aiOptions);
                if (onProgress) onProgress(30);
                try {
                    const processedVideoPath = await processVideo(videoFilePath, outputDir, aiOptions);
                    finalVideoPath = processedVideoPath;
                    tempFiles.push(processedVideoPath);
                } catch (procErr) {
                    console.error("❌ AI Processing failed, falling back to original:", procErr);
                }
            }
        } else if (videoUrl && videoUrl.includes("tiktok.com")) {
            // Auto-sync TikTok if enabled
            if (onProgress) onProgress(20);
            try {
                const tiktokRes = await tiktokDownloader.downloadTiktokVideo(videoUrl);
                if (tiktokRes && tiktokRes.buffer) {
                    const tempPath = path.join(outputDir, `sync_${Date.now()}.mp4`);
                    fs.writeFileSync(tempPath, tiktokRes.buffer);
                    tempFiles.push(tempPath);
                    finalVideoPath = tempPath;
                }
            } catch (e) { console.warn("TikTok sync failed, using URL."); }
        }

        if (onProgress) onProgress(50);

        // 2. Process Per Account
        const totalAccounts = accountsArray.length;
        for (let i = 0; i < totalAccounts; i++) {
            const accountId = accountsArray[i];
            const currentProgress = 50 + Math.floor(((i + 1) / totalAccounts) * 45);
            if (onProgress) onProgress(currentProgress);

            try {
                const page = await prisma.facebookPage.findFirst({
                    where: { id: accountId, userId: userId }
                });

                let pageToken = page ? decrypt(page.accessToken) : null;
                let pageName = page ? page.name : 'Unknown Page';

                if (!pageToken) throw new Error(`Page ${accountId} not found or invalid token`);

                // Stagger Delay
                let finalScheduleTime = scheduleTime ? new Date(scheduleTime) : null;
                const delay = parseInt(staggerDelay || 0);
                if (finalScheduleTime && delay > 0) {
                    finalScheduleTime.setMinutes(finalScheduleTime.getMinutes() + (i * delay));
                }

                const videoSource = finalVideoPath && fs.existsSync(finalVideoPath) ? fs.createReadStream(finalVideoPath) : (videoUrl || videoUrl);
                const thumbSource = thumbnailFilePath && fs.existsSync(thumbnailFilePath) ? { buffer: fs.readFileSync(thumbnailFilePath) } : null;

                const fbRes = await fb.postToFB(
                    null,
                    [{ id: accountId, type: 'page', access_token: pageToken, name: pageName }],
                    videoSource,
                    caption,
                    thumbSource,
                    {
                        title,
                        isScheduled: !!finalScheduleTime,
                        scheduleTime: finalScheduleTime ? Math.floor(finalScheduleTime.getTime() / 1000) : null,
                        link: tiktokUrl
                    }
                );

                if (fbRes.successCount > 0) {
                    const fbPostId = fbRes.details[0].postId;
                    if (autoComment) await fb.postComment(pageToken, fbPostId, autoComment);

                    await prisma.postLog.create({
                        data: {
                            userId, pageId: accountId, fbPostId, type: tiktokUrl ? "tiktok" : "video",
                            status: finalScheduleTime ? "scheduled" : "published",
                            scheduledTime: finalScheduleTime || null
                        }
                    });
                    results.successCount++;
                    results.details.push({ accountId, status: "success", postId: fbPostId });
                }
            } catch (err) {
                console.error(`❌ Failed for ${accountId}:`, err.message);
                results.failedCount++;
                results.details.push({ accountId, status: "failed", error: err.message });
            }
        }

        if (onProgress) onProgress(100);
        return results;
    } catch (err) {
        console.error("❌ Single Post Service Error:", err.message);
        throw err;
    } finally {
        for (const f of tempFiles) {
            if (f && fs.existsSync(f)) {
                try { fs.unlinkSync(f); } catch (e) {}
            }
        }
        // Also cleanup initial video file if it was a temp upload
        if (videoFilePath && fs.existsSync(videoFilePath)) {
             try { fs.unlinkSync(videoFilePath); } catch (e) {}
        }
    }
}

module.exports = {
    processAndPostCarouselLogic,
    processSinglePostLogic
};
