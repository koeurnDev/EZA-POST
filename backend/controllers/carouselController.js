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

exports.processAndPostCarousel = async (req, accountsArray, userId, caption, scheduleTime) => {
    let localVideoPath = null;
    let localThumbnailPath = null;


    try {
        const { videoUrl } = req.body;
        const videoFile = req.files?.find(f => f.fieldname === 'video');


        // Check if we have either Files OR URLs
        const hasVideo = videoFile || videoUrl;

        // 🛑 Check for Page Card in payload (it counts as an image)
        let hasPageCard = false;
        try {
            if (req.body.carouselCards) {
                const cards = JSON.parse(req.body.carouselCards);
                hasPageCard = cards.some(c => c.imageUrl); // Page Card has imageUrl
            }
        } catch (e) { /* ignore parse error here, validation happens later */ }

        const hasImages = hasPageCard;

        if (!hasVideo || !hasPageCard) {
            throw new Error("Video and Page Card are required for mixed carousel");
        }

        // 🔄 Phase 1: Preparation (Upload & Process)
        let finalVideoUrl = videoUrl;
        let finalVideoPublicId = null;
        let finalThumbnailUrl = null; // ✅ Define variable for thumbnail URL

        const { processMediaToSquare, generateThumbnail } = require("../utils/videoProcessor");

        // 1.1 Process Video
        if (videoFile) {
            console.log("🎬 Phase 1: Processing video locally (1080x1080)...");
            const processedVideoPath = await processMediaToSquare(videoFile.path);
            localVideoPath = processedVideoPath;

            // ✅ Generate Thumbnail (or use Custom Upload)
            const customThumbnailFile = req.files?.find(f => f.fieldname === 'thumbnail');

            if (customThumbnailFile) {
                console.log("🖼️ Using Custom Thumbnail uploaded by user");
                localThumbnailPath = customThumbnailFile.path;
            } else {
                try {
                    localThumbnailPath = await generateThumbnail(localVideoPath);
                } catch (thumbErr) {
                    console.warn("⚠️ Failed to generate thumbnail, proceeding without it:", thumbErr.message);
                }
            }

            console.log("☁️ Uploading processed video to Cloudinary...");
            // 🛑 CRITICAL: Set deleteAfterUpload=false so we can use the file for Direct Upload to FB
            const vRes = await uploadFile(processedVideoPath, "eza-post/carousel_videos", "video", false, false);
            finalVideoUrl = vRes.url;
            finalVideoPublicId = vRes.public_id;

            // ✅ Upload Thumbnail to Cloudinary (Required for Carousel Payload)
            if (localThumbnailPath) {
                try {
                    const tRes = await uploadFile(localThumbnailPath, "eza-post/carousel_thumbnails", "image", false, false);
                    finalThumbnailUrl = tRes.url;
                } catch (thumbUploadErr) {
                    console.warn("⚠️ Failed to upload thumbnail to Cloudinary:", thumbUploadErr.message);
                }
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
                let carouselCards = [];
                try {
                    if (req.body.carouselCards) {
                        carouselCards = JSON.parse(req.body.carouselCards);
                    }
                } catch (e) {
                    console.warn("⚠️ Invalid carouselCards JSON, using default logic");
                }

                // ✅ Polyfill: If no cards provided, generate them to force 2-Step Process
                if (!carouselCards || carouselCards.length === 0) {
                    console.log("⚠️ No carouselCards provided. Auto-generating from inputs...");
                    // 1. Video Card
                    carouselCards.push({ type: 'video' });
                    // 2. Page Card
                    carouselCards.push({ type: 'image', isPageCard: true });
                }

                const finalChildAttachments = [];

                if (carouselCards.length > 0) {
                    // 🧠 Intelligent Auto-Fill System
                    const pageUrl = `https://facebook.com/${accountId}`;

                    // 1. Auto-Fill Defaults
                    const defaultHeadline = pageName || "EZA Post";
                    const defaultDescription = "Swipe to see more";
                    const defaultLink = pageUrl;
                    const defaultCta = "LEARN_MORE";

                    // 2. Extract User Input (if any)
                    const unifiedDescription = carouselCards[0].description || defaultDescription;
                    const unifiedCta = carouselCards[0].cta || defaultCta;
                    const unifiedHeadline = carouselCards[0].headline || defaultHeadline;
                    const unifiedLink = carouselCards[0].link || defaultLink;

                    for (const [index, card] of carouselCards.entries()) {
                        let link = unifiedLink;
                        let headline = unifiedHeadline;
                        let description = unifiedDescription;
                        let ctaType = unifiedCta;

                        if (ctaType === 'SEE_PAGE' || ctaType === 'FOLLOW' || ctaType === 'LIKE_PAGE') {
                            ctaType = 'LEARN_MORE';
                        }

                        const isEndCard = index >= 2 && index === carouselCards.length - 1;

                        if (isEndCard) {
                            headline = `Follow ${pageName}`;
                            description = "Don't miss our next post!";
                            ctaType = "LEARN_MORE";
                            link = pageUrl;
                        }

                        let url;
                        if (card.type === 'video') {
                            url = finalVideoUrl;
                        } else if (card.type === 'image') {
                            if (card.imageUrl) {
                                url = card.imageUrl;
                            } else if (isEndCard) {
                                if (page && page.picture && page.picture.data && page.picture.data.url) {
                                    url = page.picture.data.url;
                                }
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
                                    let thumbStream = null;
                                    if (localThumbnailPath) {
                                        thumbStream = fs.createReadStream(localThumbnailPath);
                                    }
                                    const vRes = await fb.uploadVideoForCarousel(pageToken, accountId, videoStream, thumbStream);
                                    containerId = vRes.id;
                                } else {
                                    // Fallback to URL
                                    const vRes = await fb.uploadVideoForCarousel(pageToken, accountId, url);
                                    containerId = vRes.id;
                                }
                            } else {
                                console.log(`📤 Uploading photo container for Card ${index + 1}...`);
                                // Page Card always uses URL
                                const pRes = await fb.uploadPhotoForCarousel(pageToken, accountId, url);
                                containerId = pRes.id;
                            }
                        } catch (uploadErr) {
                            console.error(`❌ Failed to upload media for Card ${index + 1}:`, uploadErr.message);
                            throw new Error(`Failed to upload media for card ${index + 1}`);
                        }

                        // 3. Construct attachment with Metadata AND Type-Specific IDs
                        // ✅ CRITICAL: Metadata prevents "Invalid parameter", IDs ensure native display
                        const attachment = {
                            link: link, // ✅ Restore Link for ALL cards
                            name: headline,
                            description: description,
                        };

                        if (card.type === 'video') {
                            // 🔄 EXPERIMENT: Use 'media_fbid' for Video (instead of video_id)
                            // 'video_id' caused "Invalid parameter".
                            // 'media_fbid' + 'picture' caused "White Card".
                            // HYPOTHESIS: 'media_fbid' + NO 'picture' = Correct Video Rendering?
                            attachment.media_fbid = containerId;

                            // ❌ Ensure 'picture' is NOT sent. 
                            // The video container has the thumbnail embedded.
                            // attachment.picture = finalThumbnailUrl; 

                        } else {
                            attachment.media_fbid = containerId; // ✅ Standard for Image Containers
                            attachment.picture = url; // ✅ Image URL is fine for Image card

                            // ✅ Keep CTA for Image
                            attachment.call_to_action = {
                                type: ctaType,
                                value: { link: link }
                            };
                        }

                        finalChildAttachments.push(attachment);
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

                    await PostLog.create({
                        userId,
                        pageId: accountId,
                        fbPostId: fbPostId,
                        type: "carousel",
                        status: scheduleTime ? "scheduled" : "published",
                        scheduledTime: scheduleTime ? new Date(scheduleTime) : null,
                        cloudinaryVideoId: finalVideoPublicId,
                        cloudinaryImageIds: []
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
                    cloudinaryImageIds: []
                });
                results.failedCount++;
                results.details.push({ accountId, status: "failed", error: err.message });
            }
        }

        return results;

    } catch (err) {
        console.error("❌ Mixed Carousel Error:", err.message);
        throw err;
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

        // 🧹 Cleanup Thumbnail
        if (localThumbnailPath && fs.existsSync(localThumbnailPath)) {
            try {
                fs.unlinkSync(localThumbnailPath);
                console.log(`🧹 Cleaned up local thumbnail file: ${localThumbnailPath}`);
            } catch (cleanupErr) {
                console.warn(`⚠️ Failed to delete local thumbnail file: ${cleanupErr.message}`);
            }
        }


    }
};
exports.createMixedCarousel = async (req, res) => {
    req.setTimeout(600000); // 10 minutes timeout

    try {
        const { caption, accounts, scheduleTime } = req.body;
        const userId = req.user?.id;

        // 🛑 Validation
        if (!accounts) return res.status(400).json({ success: false, error: "Missing accounts" });

        let accountsArray = [];
        try {
            accountsArray = JSON.parse(accounts);
        } catch {
            return res.status(400).json({ success: false, error: "Invalid accounts JSON" });
        }

        const results = await exports.processAndPostCarousel(req, accountsArray, userId, caption, scheduleTime);

        // ✅ Check if ALL failed
        if (results.failedCount === accountsArray.length) {
            return res.status(500).json({
                success: false,
                error: results.details[0]?.error || "Failed to create carousel post",
                results
            });
        }

        res.status(201).json({
            success: true,
            results

        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
