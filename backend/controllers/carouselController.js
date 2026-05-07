/**
 * 🎠 carouselController.js — Handle Mixed Media Carousel (Video + Image)
 * ✅ Native Facebook Uploads (No Cloudinary)
 */

const fs = require("fs");
const path = require("path");
const prisma = require('../utils/prisma');
const fb = require("../utils/fb");
const axios = require("axios");
const { processVideo } = require("../services/videoProcessor");

// Decryption helper
const crypto = require('crypto');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "default_secret_key_must_be_32_bytes_long";
function getEncryptionKey() {
    return crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substr(0, 32);
}
function decrypt(text) {
    if (!text) return text;
    const textParts = text.split(':');
    if (textParts.length !== 2) return text;
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedText = Buffer.from(textParts[1], 'hex');
    try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(getEncryptionKey()), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (err) {
        return text;
    }
}

exports.processAndPostCarousel = async (req, accountsArray, userId, caption, scheduleTime) => {
    let tempFiles = []; // Track temp files for cleanup

    try {
        const { videoUrl } = req.body;
        const videoFile = req.files?.find(f => f.fieldname === 'video');

        // 1. Prepare Inputs
        let videoInput = null;
        if (videoFile) {
            videoInput = fs.createReadStream(videoFile.path);
            tempFiles.push(videoFile.path);
        } else if (videoUrl) {
            videoInput = videoUrl; // Pass URL directly to FB
        }

        const thumbnailFile = req.files?.find(f => f.fieldname === 'thumbnail');
        let thumbnailInput = null;
        if (thumbnailFile) {
            thumbnailInput = fs.createReadStream(thumbnailFile.path);
            tempFiles.push(thumbnailFile.path);
        }

        const rightSideImageFile = req.files?.find(f => f.fieldname === 'rightSideImage');
        let rightSideImageInput = null;
        if (rightSideImageFile) {
            rightSideImageInput = fs.createReadStream(rightSideImageFile.path);
            tempFiles.push(rightSideImageFile.path);
        }

        // 🚨 1.5. Process Video (Square Pad + AI Options)
        let processedVideoPath = null;
        if (videoFile) {
            try {
                const aiOptions = req.body.aiOptions ? JSON.parse(req.body.aiOptions) : {};
                // Force square padding for carousels (Critical for FB compliance)
                aiOptions.squarePad = true;

                const outputDir = path.join(__dirname, "../../temp/videos");
                console.log(`🎬 [Carousel] Processing video for 1:1 compatibility: ${videoFile.originalname}`);
                processedVideoPath = await processVideo(videoFile.path, outputDir, aiOptions);
                tempFiles.push(processedVideoPath);
            } catch (procErr) {
                console.error("❌ Video processing failed:", procErr.message);
                // Fallback to original file if processing fails
            }
        } else if (videoUrl) {
            console.log(`🔗 [Carousel] Using direct video URL: ${videoUrl}`);
        }

        // 2. Parse Cards
        let carouselCards = [];
        try {
            if (req.body.carouselCards) {
                carouselCards = JSON.parse(req.body.carouselCards);
            }
        } catch (e) {
            console.warn("⚠️ Invalid carouselCards JSON");
        }

        // 🚨 AUTO-FIX: Ensure minimum 2 cards for Carousel
        // If user only provided 1 video card, auto-add a Page Card (Profile Pic)
        if (carouselCards.length === 1 && carouselCards[0].type === 'video') {
            console.log("ℹ️ Single video detected. Auto-injecting Page Card to satisfy Facebook requirements.");
            carouselCards.push({
                type: 'image',
                isPageCard: true,
                headline: "Follow Us",
                description: "ចុច Like Page ដើម្បីបានវីដេអូថ្មីៗ",
                link: null // Will default to page link
            });
        }

        // 3. Process Per Account
        const results = { successCount: 0, failedCount: 0, details: [] };

        for (const accountId of accountsArray) {
            try {
                // Fetch Page & Token
                const page = await prisma.facebookPage.findFirst({
                    where: { id: accountId, userId: userId }
                });

                let pageToken = page ? decrypt(page.accessToken) : null;
                let pageName = page ? page.name : null;

                // Fallback to User's connectedPages if not in FacebookPage table
                if (!pageToken) {
                    const user = await prisma.user.findUnique({
                        where: { id: userId },
                        select: { connectedPages: true }
                    });

                    let connectedPages = user?.connectedPages;
                    if (typeof connectedPages === 'string') {
                        try { connectedPages = JSON.parse(connectedPages) } catch (e) { }
                    }

                    const connectedPage = Array.isArray(connectedPages) ? connectedPages.find(p => p.id === accountId) : null;
                    if (connectedPage) {
                        pageToken = decrypt(connectedPage.access_token);
                        pageName = connectedPage.name;
                    }
                }

                if (!pageToken) throw new Error(`Page ${accountId} not found or invalid token`);

                console.log(`🚀 Starting Native Carousel for ${pageName} (${accountId})...`);

                // 4. Upload Assets & Build Attachments
                const childAttachments = [];

                // Defaults
                const defaultHeadline = pageName || "EZA Post";
                const defaultLink = `https://facebook.com/${accountId}`;

                for (const [index, card] of carouselCards.entries()) {
                    let mediaFbid = null;
                    let link = card.link || defaultLink;
                    let headline = card.headline || defaultHeadline;
                    let description = card.description || "Swipe to see more";

                    // 📤 Upload Media to Facebook
                    try {
                        if (card.type === 'video') {
                            let currentVideoInput = videoInput;
                            if (processedVideoPath) {
                                currentVideoInput = fs.createReadStream(processedVideoPath);
                            } else if (videoFile) {
                                currentVideoInput = fs.createReadStream(videoFile.path);
                            }

                            let currentThumbInput = thumbnailInput;
                            if (thumbnailFile) currentThumbInput = fs.createReadStream(thumbnailFile.path);

                            console.log(`📤 Uploading Video for Card ${index + 1}...`);
                            const vRes = await fb.uploadVideoForCarousel(pageToken, accountId, currentVideoInput, currentThumbInput);
                            mediaFbid = vRes.id;
                            console.log(`✅ Video Media FBID: ${mediaFbid}`);
                        } else {
                            // Image Card
                            let currentImageInput = null;

                            if (card.isRightSide && rightSideImageFile) {
                                // 🖼️ Case 1: Uploaded Card 2 (Right-Side Frame/Image)
                                console.log(`🖼️ Using Uploaded Right-Side Image for Card ${index + 1}...`);
                                currentImageInput = fs.createReadStream(rightSideImageFile.path);
                                const pRes = await fb.uploadPhotoForCarousel(pageToken, accountId, currentImageInput);
                                mediaFbid = pRes.id;
                            } else if (card.isPageCard) {
                                // 🖼️ Case 2: Auto-Generated Page Card (Profile Pic)
                                try {
                                    console.log(`🖼️ Card ${index + 1}: Fetching Auto Page Profile Picture...`);

                                    const picUrlRes = await axios.get(`https://graph.facebook.com/v19.0/${accountId}/picture`, {
                                        params: { width: 1000, redirect: false, access_token: pageToken }
                                    });
                                    const picUrl = picUrlRes.data?.data?.url;

                                    if (picUrl) {
                                        const picStream = await axios.get(picUrl, { responseType: 'stream' });
                                        const pRes = await fb.uploadPhotoForCarousel(pageToken, accountId, picStream.data);
                                        mediaFbid = pRes.id;
                                    }
                                } catch (picErr) {
                                    console.error(`❌ Failed to auto-process page-card for ${accountId}:`, picErr.message);
                                }
                            } else if (card.imageUrl) {
                                // 🖼️ Case 3: External Image URL
                                console.log(`🖼️ Using imageUrl for Card ${index + 1}: ${card.imageUrl}`);
                                const pRes = await fb.uploadPhotoForCarousel(pageToken, accountId, card.imageUrl);
                                mediaFbid = pRes.id;
                            }
                            
                            if (mediaFbid) console.log(`✅ Image Media FBID: ${mediaFbid}`);
                        }
                    } catch (uploadErr) {
                        console.error(`❌ Failed to upload media for card ${index + 1}:`, uploadErr.message);
                    }

                    // 5. Construct Attachment Object
                    const attachment = {
                        link: link,
                        name: headline,
                        description: description,
                    };

                    if (card.cta && card.cta !== 'NO_BUTTON') {
                        attachment.call_to_action = {
                            type: card.cta,
                            value: { link: link }
                        };
                    }

                    if (mediaFbid) {
                        attachment.media_fbid = mediaFbid;
                    } else {
                        console.warn(`⚠️ No media_fbid for card ${index + 1}, skipping media attachment`);
                    }

                    childAttachments.push(attachment);
                }

                // 6. Publish
                console.log("📦 Publishing Native Carousel...");
                const feedRes = await fb.postCarousel(pageToken, [{ id: accountId, name: pageName, type: 'page' }], caption, childAttachments, {
                    isScheduled: !!scheduleTime,
                    scheduleTime: scheduleTime ? Math.floor(new Date(scheduleTime).getTime() / 1000) : null
                });

                if (feedRes.successCount > 0) {
                    const fbPostId = feedRes.details[0].postId;
                    await prisma.postLog.create({
                        data: {
                            userId,
                            pageId: accountId,
                            fbPostId: fbPostId,
                            type: "carousel",
                            status: scheduleTime ? "scheduled" : "published",
                            scheduledTime: scheduleTime ? new Date(scheduleTime) : null
                        }
                    });
                    results.successCount++;
                    results.details.push({ accountId, status: "success", postId: fbPostId });
                } else {
                    throw new Error(feedRes.details[0].error || "Failed to post carousel");
                }

            } catch (err) {
                console.error(`❌ Failed for ${accountId}:`, err.message);
                results.failedCount++;
                results.details.push({ accountId, status: "failed", error: err.message });
            }
        }

        return results;

    } catch (err) {
        console.error("❌ Mixed Carousel Error:", err.message);
        throw err;
    } finally {
        // 🧹 Cleanup Temp Files
        for (const f of tempFiles) {
            if (fs.existsSync(f)) {
                try { fs.unlinkSync(f); } catch (e) { console.warn("Failed to delete temp file:", f); }
            }
        }
    }
};

exports.createMixedCarousel = async (req, res) => {
    req.setTimeout(600000);
    try {
        const { caption, accounts, scheduleTime, enableBot } = req.body;
        const userId = req.user?.id;

        if (!accounts) return res.status(400).json({ success: false, error: "Missing accounts" });

        let accountsArray = [];
        try {
            accountsArray = JSON.parse(accounts);
        } catch {
            return res.status(400).json({ success: false, error: "Invalid accounts JSON" });
        }

        // 🤖 Handle Auto-Reply Bot Activation
        if (enableBot === 'true' || enableBot === true) {
            console.log("🤖 [Carousel] Enabling Auto-Reply Bot for selected pages...");
            const user = await prisma.user.findUnique({ where: { id: userId } });
            let pageSettings = user.pageSettings || [];
            if (typeof pageSettings === 'string') try { pageSettings = JSON.parse(pageSettings) } catch(e) { pageSettings = [] }

            accountsArray.forEach(pageId => {
                const idx = pageSettings.findIndex(s => s.pageId === pageId);
                if (idx > -1) pageSettings[idx].enableBot = true;
                else pageSettings.push({ pageId, enableBot: true });
            });

            await prisma.user.update({
                where: { id: userId },
                data: { pageSettings }
            });
        }

        const results = await exports.processAndPostCarousel(req, accountsArray, userId, caption, scheduleTime);

        if (results.failedCount === accountsArray.length) {
            return res.status(500).json({
                success: false,
                error: results.details[0]?.error || "Failed to create carousel post",
                results
            });
        }

        res.status(201).json({ success: true, results });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
