/**
 * 🎠 carouselController.js — Handle Mixed Media Carousel (Video + Image)
 */

const fs = require("fs");
const path = require("path");
const PostLog = require("../models/PostLog");
const FacebookPage = require("../models/FacebookPage");
const User = require("../models/User");
const fb = require("../utils/fb");
const { uploadFile } = require("../utils/cloudinary");

exports.createMixedCarousel = async (req, res) => {
    req.setTimeout(600000); // 10 minutes timeout

    let localVideoPath = null; // ✅ Defined outside try for cleanup access

    try {
        const { caption, accounts, scheduleTime, videoUrl } = req.body;
        const userId = req.user?.id;

        // 🛑 Validation
        if (!accounts) return res.status(400).json({ success: false, error: "Missing accounts" });

        const videoFile = req.files?.find(f => f.fieldname === 'video');
        // ✅ Support Multiple Images
        const imageFiles = req.files?.filter(f => f.fieldname === 'images');

        // Check if we have either Files OR URLs
        const hasVideo = videoFile || videoUrl;
        const hasImages = imageFiles && imageFiles.length > 0;

        if (!hasVideo || !hasImages) {
            return res.status(400).json({ success: false, error: "Video and at least one image are required for mixed carousel" });
        }

        let accountsArray = [];
        try {
            accountsArray = JSON.parse(accounts);
        } catch {
            return res.status(400).json({ success: false, error: "Invalid accounts JSON" });
        }

        // 🔄 Phase 1: Preparation (Upload & Process)
        // Ensure both video and image are correctly processed (1080x1080) and hosted.

        let finalVideoUrl = videoUrl;
        let finalVideoPublicId = null;
        let finalImageUrls = [];
        let finalImagePublicIds = [];
        const { processMediaToSquare } = require("../utils/videoProcessor");

        // 1.1 Process Video
        if (videoFile) {
            console.log("🎬 Phase 1: Processing video locally (1080x1080)...");
            const processedVideoPath = await processMediaToSquare(videoFile.path);
            localVideoPath = processedVideoPath;

            console.log("☁️ Uploading processed video to Cloudinary...");
            // 🛑 CRITICAL: Set deleteAfterUpload=false so we can use the file for Direct Upload to FB
            const vRes = await uploadFile(processedVideoPath, "eza-post/carousel_videos", "video", false, false);
            finalVideoUrl = vRes.url;
            finalVideoPublicId = vRes.public_id;
        }

        // 1.2 Process Images
        if (imageFiles && imageFiles.length > 0) {
            console.log(`🖼️ Phase 1: Processing ${imageFiles.length} images locally (1080x1080)...`);
            for (const img of imageFiles) {
                // Process image to square using same FFmpeg logic
                const processedImagePath = await processMediaToSquare(img.path);

                console.log("☁️ Uploading processed image to Cloudinary...");
                const iRes = await uploadFile(processedImagePath, "eza-post/carousel_images", "image", true, false); // transform=false as we processed it
                finalImageUrls.push(iRes.url);
                finalImagePublicIds.push(iRes.public_id);
            }
        }

        // 🚀 Phase 2 & 3: Create Attachments & Publish
        const results = { successCount: 0, failedCount: 0, details: [] };

        for (const accountId of accountsArray) {
            try {
                // Fetch Page
                const page = await FacebookPage.findOne({ pageId: accountId, userId: userId });
                let pageToken = page ? page.getDecryptedAccessToken() : null;
                let pageName = page ? page.pageName : null;

                if (!pageToken) {
                    const user = await User.findOne({ id: userId });
                    const connectedPage = user?.connectedPages?.find(p => p.id === accountId);
                    if (connectedPage) {
                        pageToken = user.getDecryptedPageToken(accountId);
                        pageName = connectedPage.name;
                    }
                }
                if (!pageToken) throw new Error(`Page ${accountId} not found or invalid token`);

                console.log(`🚀 Starting Mixed Carousel for ${pageName} (${accountId})...`);

                // 🔄 Phase 2: Create Media Attachments (Meta API)
                // We must tell Facebook about each item and have Facebook process it into a temporary container ID.

                // 🔢 Construct Final Child Attachments from Cards Data
                let carouselCards = [];
                try {
                    if (req.body.carouselCards) {
                        carouselCards = JSON.parse(req.body.carouselCards);
                    }
                } catch (e) {
                    console.warn("⚠️ Invalid carouselCards JSON, using default logic");
                }

                const finalChildAttachments = [];

                if (carouselCards.length > 0) {
                    // 🧠 Intelligent Auto-Fill System
                    // If metadata is missing, we auto-fill it based on the Target Page.

                    const pageUrl = `https://facebook.com/${accountId}`;

                    // 1. Auto-Fill Defaults
                    const defaultHeadline = pageName || "EZA Post";
                    const defaultDescription = "Swipe to see more";
                    const defaultLink = pageUrl;
                    const defaultCta = "LEARN_MORE";

                    // 2. Extract User Input (if any) - Priority: User Input > Default
                    const unifiedDescription = carouselCards[0].description || defaultDescription;
                    const unifiedCta = carouselCards[0].cta || defaultCta;
                    const unifiedHeadline = carouselCards[0].headline || defaultHeadline;
                    const unifiedLink = carouselCards[0].link || defaultLink;

                    for (const [index, card] of carouselCards.entries()) {
                        let link = unifiedLink;
                        let headline = unifiedHeadline;
                        let description = unifiedDescription;
                        let ctaType = unifiedCta;

                        // Map internal intents to valid FB Enums
                        if (ctaType === 'SEE_PAGE' || ctaType === 'FOLLOW' || ctaType === 'LIKE_PAGE') {
                            ctaType = 'LEARN_MORE';
                        }

                        // 🧠 Special Logic for "Card 3" (End Card / Profile Card)
                        // If this is the last card AND we have at least 3 cards, treat it as the "Follow Page" card
                        const isEndCard = index >= 2 && index === carouselCards.length - 1;

                        if (isEndCard) {
                            headline = `Follow ${pageName}`;
                            description = "Don't miss our next post!";
                            ctaType = "LEARN_MORE"; // Points to page URL
                            link = pageUrl;
                        }

                        let url;
                        if (card.type === 'video') {
                            url = finalVideoUrl;
                        } else if (card.type === 'image') {
                            // Support Remote Image URL (e.g. Page Profile Pic for Card 3)
                            if (card.imageUrl) {
                                url = card.imageUrl;
                            }
                            // 🧠 Auto-Fetch Page Profile Pic for End Card if no specific image provided
                            else if (isEndCard && !card.fileIndex && !card.imageUrl) {
                                if (page && page.picture && page.picture.data && page.picture.data.url) {
                                    url = page.picture.data.url;
                                } else {
                                    url = finalImageUrls[card.fileIndex] || finalImageUrls[0];
                                }
                            }
                            // Map using fileIndex (Uploaded Files)
                            else if (card.fileIndex !== undefined && finalImageUrls[card.fileIndex]) {
                                url = finalImageUrls[card.fileIndex];
                            } else {
                                url = finalImageUrls[0];
                            }
                        }

                        // 🚀 2-STEP PROCESS: Upload Media Container First
                        let containerId = null;
                        try {
                            if (card.type === 'video') {
                                console.log(`📤 Uploading video container for Card ${index + 1}...`);

                                // ✅ Use Direct File Upload if available (Reliable)
                                if (localVideoPath) {
                                    const videoStream = fs.createReadStream(localVideoPath);
                                    const vRes = await fb.uploadVideoForCarousel(pageToken, accountId, videoStream);
                                    containerId = vRes.id;
                                } else {
                                    // Fallback to URL (e.g. TikTok)
                                    const vRes = await fb.uploadVideoForCarousel(pageToken, accountId, url);
                                    containerId = vRes.id;
                                }
                            } else {
                                console.log(`📤 Uploading photo container for Card ${index + 1}...`);
                                const pRes = await fb.uploadPhotoForCarousel(pageToken, accountId, url);
                                containerId = pRes.id;
                            }
                        } catch (uploadErr) {
                            console.error(`❌ Failed to upload media for Card ${index + 1}:`, uploadErr.message);
                            throw new Error(`Failed to upload media for card ${index + 1}`);
                        }

                        // 3. Construct Bundle Object with ID
                        const attachment = {
                            link: link,
                            name: headline,
                            description: description,
                            call_to_action: {
                                type: ctaType,
                                value: { link: link }
                            },
                            // ✅ KEY FIX: Use id (container ID) and REMOVE picture/source
                            id: containerId
                        };

                        finalChildAttachments.push(attachment);
                    }
                } else {
                    // Fallback Legacy Logic
                    // Video Card
                    finalChildAttachments.push({
                        link: "https://facebook.com",
                        source: finalVideoUrl,
                        picture: finalVideoUrl.replace(/\.[^/.]+$/, ".jpg"),
                        name: "Video",
                        description: " ",
                        call_to_action: { type: "LEARN_MORE", value: { link: "https://facebook.com" } }
                    });

                    // Image Cards
                    for (let i = 0; i < finalImageUrls.length; i++) {
                        finalChildAttachments.push({
                            link: "https://facebook.com",
                            picture: finalImageUrls[i],
                            name: "Image " + (i + 1),
                            description: " ",
                            call_to_action: { type: "LEARN_MORE", value: { link: "https://facebook.com" } }
                        });
                    }
                }

                // 🔄 Phase 3: Publish the Carousel
                console.log("📦 Controller Payload (finalChildAttachments):", JSON.stringify(finalChildAttachments, null, 2));

                const feedRes = await fb.postCarousel(pageToken, [{ id: accountId, name: pageName, type: 'page' }], caption, finalChildAttachments, {
                    isScheduled: !!scheduleTime,
                    scheduleTime: scheduleTime ? Math.floor(new Date(scheduleTime).getTime() / 1000) : null
                });

                if (feedRes.successCount > 0) {
                    const fbPostId = feedRes.details[0].postId;

                    // 🔄 Phase 4: Clean-up (Soft Delete)
                    const { softDeleteAsset } = require("../utils/cloudinary");
                    if (finalVideoPublicId) await softDeleteAsset(finalVideoPublicId);
                    if (finalImagePublicIds && finalImagePublicIds.length > 0) {
                        for (const imgId of finalImagePublicIds) {
                            await softDeleteAsset(imgId);
                        }
                    }

                    await PostLog.create({
                        userId,
                        pageId: accountId,
                        fbPostId: fbPostId,
                        type: "carousel",
                        status: scheduleTime ? "scheduled" : "published",
                        scheduledTime: scheduleTime ? new Date(scheduleTime) : null,
                        cloudinaryVideoId: finalVideoPublicId,
                        cloudinaryImageIds: finalImagePublicIds
                    });

                    results.successCount++;
                    results.details.push({ accountId, status: "success", postId: fbPostId });
                    console.log(`✅ Mixed Carousel Published: ${fbPostId}`);
                } else {
                    throw new Error(feedRes.details[0].error || "Failed to post carousel");
                }

            } catch (err) {
                console.error(`❌ Failed for ${accountId}:`, err.message);
                await PostLog.create({
                    userId,
                    pageId: accountId,
                    type: "carousel",
                    status: "failed",
                    error: err.message,
                    cloudinaryVideoId: finalVideoPublicId,
                    cloudinaryImageIds: finalImagePublicIds
                });
                results.failedCount++;
                results.details.push({ accountId, status: "failed", error: err.message });
            }
        }

        res.status(201).json({
            success: true,
            results
        });

    } catch (err) {
        console.error("❌ Mixed Carousel Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        // 🧹 Final Cleanup: Delete local video file if it exists
        if (localVideoPath && fs.existsSync(localVideoPath)) {
            try {
                fs.unlinkSync(localVideoPath);
                console.log(`🧹 Cleaned up local video file: ${localVideoPath}`);
            } catch (cleanupErr) {
                console.warn(`⚠️ Failed to delete local video file: ${cleanupErr.message}`);
            }
        }
    }
};
