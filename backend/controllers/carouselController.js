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
    let localImagePaths = []; // ✅ Store local image paths for direct upload

    try {
        const { videoUrl } = req.body;
        const videoFile = req.files?.find(f => f.fieldname === 'video');
        const imageFiles = req.files?.filter(f => f.fieldname === 'images');

        // Check if we have either Files OR URLs
        const hasVideo = videoFile || videoUrl;
        const hasImages = imageFiles && imageFiles.length > 0;

        if (!hasVideo || !hasImages) {
            throw new Error("Video and at least one image are required for mixed carousel");
        }

        // 🔄 Phase 1: Preparation (Upload & Process)
        let finalVideoUrl = videoUrl;
        let finalVideoPublicId = null;
        let finalImageUrls = [];
        let finalImagePublicIds = [];
        const { processMediaToSquare, generateThumbnail } = require("../utils/videoProcessor");

        // 1.1 Process Video
        if (videoFile) {
            console.log("🎬 Phase 1: Processing video locally (1080x1080)...");
            const processedVideoPath = await processMediaToSquare(videoFile.path);
            localVideoPath = processedVideoPath;

            // ✅ Generate Thumbnail
            try {
                localThumbnailPath = await generateThumbnail(localVideoPath);
            } catch (thumbErr) {
                console.warn("⚠️ Failed to generate thumbnail, proceeding without it:", thumbErr.message);
            }

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
                // 🛑 CRITICAL: Set deleteAfterUpload=false so we can use the file for Direct Upload to FB
                const iRes = await uploadFile(processedImagePath, "eza-post/carousel_images", "image", false, false);
                finalImageUrls.push(iRes.url);
                finalImagePublicIds.push(iRes.public_id);

                // ✅ Store path for Direct Upload later
                localImagePaths.push(processedImagePath);

                // ✅ Delete RAW file immediately, but KEEP processed file
                try {
                    if (fs.existsSync(img.path)) fs.unlinkSync(img.path);
                } catch (e) {
                    console.warn(`⚠️ Failed to delete local raw image: ${e.message}`);
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
                    // 2. Image Cards
                    finalImageUrls.forEach((_, index) => {
                        carouselCards.push({ type: 'image', fileIndex: index });
                    });
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
                            } else if (isEndCard && !card.fileIndex && !card.imageUrl) {
                                if (page && page.picture && page.picture.data && page.picture.data.url) {
                                    url = page.picture.data.url;
                                } else {
                                    url = finalImageUrls[card.fileIndex] || finalImageUrls[0];
                                }
                            } else if (card.fileIndex !== undefined && finalImageUrls[card.fileIndex]) {
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

                                // ✅ Use Direct File Upload if available (Reliable)
                                let photoInput = url;
                                if (card.fileIndex !== undefined && localImagePaths[card.fileIndex]) {
                                    console.log(`🌊 Using local image stream for Card ${index + 1}`);
                                    photoInput = fs.createReadStream(localImagePaths[card.fileIndex]);
                                }

                                const pRes = await fb.uploadPhotoForCarousel(pageToken, accountId, photoInput);
                                containerId = pRes.id;
                            }
                        } catch (uploadErr) {
                            console.error(`❌ Failed to upload media for Card ${index + 1}:`, uploadErr.message);
                            throw new Error(`Failed to upload media for card ${index + 1}`);
                        }

                        // 3. Construct attachment with ONLY the container ID
                        // ✅ CRITICAL: No metadata - Facebook uses the media container directly
                        const attachment = {
                            id: containerId
                        };

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

        // ✅ Cleanup Local Images
        if (localImagePaths.length > 0) {
            localImagePaths.forEach(p => {
                try {
                    if (fs.existsSync(p)) fs.unlinkSync(p);
                } catch (e) {
                    console.warn(`Failed to delete temp image: ${p}`);
                }
            });
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

        res.status(201).json({
            success: true,
            results
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
