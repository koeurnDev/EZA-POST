/**
 * 🎥 postController.js — Handle post creation logic
 */

const fs = require("fs");
const PostLog = require("../models/PostLog");
const FacebookPage = require("../models/FacebookPage");
const User = require("../models/User");
const { uploadFile } = require("../utils/cloudinary");
const fb = require("../utils/fb");

exports.createPost = async (req, res) => {
    // ✅ Increase timeout for this route to 10 minutes
    req.setTimeout(600000);

    try {
        const { title, caption, accounts, scheduleTime, tiktokUrl, directMediaUrl, videoUrl, postType, carouselCards } = req.body;
        const userId = req.user?.id;

        // 🛑 Validate fields
        if (postType === 'carousel') {
            if (!carouselCards || !accounts) return res.status(400).json({ success: false, error: "Missing carousel cards or accounts" });
        } else {
            // Single Post Validation
            const videoFile = req.files?.find(f => f.fieldname === 'video');
            if (!videoFile && !directMediaUrl && !tiktokUrl && !caption && !videoUrl)
                return res
                    .status(400)
                    .json({ success: false, error: "No media, link, or caption provided" });
        }

        if (!accounts)
            return res
                .status(400)
                .json({ success: false, error: "Missing required fields" });

        let accountsArray = [];
        try {
            accountsArray = JSON.parse(accounts);
            if (!Array.isArray(accountsArray)) throw new Error("Invalid accounts format");
        } catch {
            return res.status(400).json({ success: false, error: "Invalid accounts JSON" });
        }

        let results = { successCount: 0, failedCount: 0, details: [] };
        let videoUrlForDB = null;
        let thumbnailUrlForDB = null;
        let videoSizeMB = 0;
        let videoPublicId = null;

        if (postType === 'carousel') {
            // 🎠 Handle Carousel (Existing Logic - Adapted for PostLog)
            let parsedCards = [];
            try {
                parsedCards = JSON.parse(carouselCards);
            } catch (e) {
                throw new Error("Invalid carousel cards JSON");
            }

            // Upload Card Media to Cloudinary
            const processedCards = await Promise.all(parsedCards.map(async (card) => {
                const cardFile = req.files?.find(f => f.fieldname === `file_${card.id}`);
                const cardThumbnail = req.files?.find(f => f.fieldname === `thumbnail_${card.id}`);
                let mediaUrl = null;
                let thumbnailUrl = null;

                if (cardFile) {
                    console.log(`📤 Uploading carousel card media: ${cardFile.filename}`);
                    const result = await uploadFile(cardFile.path, "eza-post/carousel", card.type === 'video' ? 'video' : 'image', true, true);
                    mediaUrl = result.url;
                } else if (card.previewUrl) {
                    mediaUrl = card.previewUrl;
                }

                if (cardThumbnail) {
                    console.log(`📤 Uploading carousel card thumbnail: ${cardThumbnail.filename}`);
                    const thumbResult = await uploadFile(cardThumbnail.path, "eza-post/thumbnails", "image");
                    thumbnailUrl = thumbResult.url;
                }

                return {
                    ...card,
                    url: mediaUrl,
                    thumbnailUrl: thumbnailUrl
                };
            }));

            // Post to each account
            for (const accountId of accountsArray) {
                try {
                    // Fetch Page
                    const page = await FacebookPage.findOne({ pageId: accountId, userId: userId });
                    let pageToken = page ? page.getDecryptedAccessToken() : null;
                    if (!pageToken) {
                        const user = await User.findOne({ id: userId });
                        const connectedPage = user?.connectedPages?.find(p => p.id === accountId);
                        if (connectedPage) pageToken = user.getDecryptedPageToken(accountId);
                    }
                    if (!pageToken) throw new Error(`Page ${accountId} not found or invalid token`);

                    // Post Carousel
                    const fbRes = await fb.postCarousel(
                        pageToken,
                        [{ id: accountId, type: 'page' }], // fb.postCarousel expects array but we loop here for PostLog
                        caption,
                        processedCards,
                        {
                            isScheduled: !!scheduleTime,
                            scheduleTime: scheduleTime ? Math.floor(new Date(scheduleTime).getTime() / 1000) : null
                        }
                    );

                    if (fbRes.successCount > 0) {
                        const fbPostId = fbRes.details[0].postId;
                        await PostLog.create({
                            userId,
                            pageId: accountId,
                            fbPostId: fbPostId,
                            type: "carousel",
                            status: scheduleTime ? "scheduled" : "published",
                            scheduledTime: scheduleTime ? new Date(scheduleTime) : null,
                            cloudinaryImageIds: processedCards.map(c => c.url) // Storing URLs as IDs for now, or extract public_id if available
                        });
                        results.successCount++;
                        results.details.push({ accountId, status: "success", postId: fbPostId });
                    } else {
                        throw new Error(fbRes.details[0].error || "Failed to post carousel");
                    }

                } catch (err) {
                    console.error(`❌ Failed for ${accountId}:`, err.message);
                    await PostLog.create({
                        userId,
                        pageId: accountId,
                        type: "carousel",
                        status: "failed",
                        error: err.message
                    });
                    results.failedCount++;
                    results.details.push({ accountId, status: "failed", error: err.message });
                }
            }

        } else {
            // 🎥 Handle Single Post
            const videoFile = req.files?.find(f => f.fieldname === 'video');
            const thumbFile = req.files?.find(f => f.fieldname === 'thumbnail');

            if (videoFile) {
                // ✅ Upload to Cloudinary First (Transformation 1:1)
                console.log(`☁️ Uploading video to Cloudinary: ${videoFile.filename}`);

                videoSizeMB = videoFile.size / (1024 * 1024);

                // Upload with transform=true (1:1 padding)
                const videoResult = await uploadFile(videoFile.path, "eza-post/videos", "video", true, true);
                videoUrlForDB = videoResult.url;
                videoPublicId = videoResult.public_id;

                if (thumbFile) {
                    const thumbResult = await uploadFile(thumbFile.path, "eza-post/thumbnails", "image", true);
                    thumbnailUrlForDB = thumbResult.url;
                }

                // 2. Post to Facebook using Cloudinary URL
                for (const accountId of accountsArray) {
                    try {
                        const page = await FacebookPage.findOne({ pageId: accountId, userId: userId });
                        let pageToken = page ? page.getDecryptedAccessToken() : null;
                        let pageName = page ? page.pageName : 'Unknown Page';

                        if (!pageToken) {
                            const user = await User.findOne({ id: userId });
                            const connectedPage = user?.connectedPages?.find(p => p.id === accountId);
                            if (connectedPage) {
                                pageToken = user.getDecryptedPageToken(accountId);
                                pageName = connectedPage.name;
                            }
                        }
                        if (!pageToken) throw new Error(`Page ${accountId} not found or invalid token`);

                        const fbRes = await fb.postToFB(
                            null, // User token not needed if we pass targetAccounts with tokens
                            [{ id: accountId, type: 'page', access_token: pageToken, name: pageName }],
                            videoUrlForDB, // ✅ Use Cloudinary URL
                            caption,
                            null, // Thumbnail handled by FB or Cloudinary URL if needed
                            {
                                title,
                                isScheduled: !!scheduleTime,
                                scheduleTime: scheduleTime ? Math.floor(new Date(scheduleTime).getTime() / 1000) : null,
                                link: tiktokUrl
                            }
                        );

                        if (fbRes.successCount > 0) {
                            const fbPostId = fbRes.details[0].postId;

                            // 💬 Auto Comment
                            if (req.body.autoComment) {
                                await fb.postComment(pageToken, fbPostId, req.body.autoComment);
                            }

                            await PostLog.create({
                                userId,
                                pageId: accountId,
                                fbPostId: fbPostId,
                                type: tiktokUrl ? "tiktok" : "video",
                                status: scheduleTime ? "scheduled" : "published",
                                scheduledTime: scheduleTime ? new Date(scheduleTime) : null,
                                cloudinaryVideoId: videoPublicId
                            });
                            results.successCount++;
                            results.details.push({ accountId, status: "success", postId: fbPostId });
                        } else {
                            throw new Error(fbRes.details[0].error || "Failed to post video");
                        }

                    } catch (err) {
                        console.error(`❌ Failed for ${accountId}:`, err.message);
                        await PostLog.create({
                            userId,
                            pageId: accountId,
                            type: tiktokUrl ? "tiktok" : "video",
                            status: "failed",
                            error: err.message,
                            cloudinaryVideoId: videoPublicId
                        });
                        results.failedCount++;
                        results.details.push({ accountId, status: "failed", error: err.message });
                    }
                }

            } else if (videoUrl || directMediaUrl) {
                videoUrlForDB = videoUrl || directMediaUrl;

                for (const accountId of accountsArray) {
                    try {
                        const page = await FacebookPage.findOne({ pageId: accountId, userId: userId });
                        let pageToken = page ? page.getDecryptedAccessToken() : null;
                        let pageName = page ? page.pageName : 'Unknown Page';

                        if (!pageToken) {
                            const user = await User.findOne({ id: userId });
                            const connectedPage = user?.connectedPages?.find(p => p.id === accountId);
                            if (connectedPage) {
                                pageToken = user.getDecryptedPageToken(accountId);
                                pageName = connectedPage.name;
                            }
                        }
                        if (!pageToken) throw new Error(`Page ${accountId} not found or invalid token`);

                        const fbRes = await fb.postToFB(
                            null,
                            [{ id: accountId, type: 'page', access_token: pageToken, name: pageName }],
                            videoUrlForDB,
                            caption,
                            null,
                            {
                                title,
                                isScheduled: !!scheduleTime,
                                scheduleTime: scheduleTime ? Math.floor(new Date(scheduleTime).getTime() / 1000) : null,
                                link: tiktokUrl
                            }
                        );

                        if (fbRes.successCount > 0) {
                            const fbPostId = fbRes.details[0].postId;

                            // 💬 Auto Comment
                            if (req.body.autoComment) {
                                await fb.postComment(pageToken, fbPostId, req.body.autoComment);
                            }

                            await PostLog.create({
                                userId,
                                pageId: accountId,
                                fbPostId: fbPostId,
                                type: tiktokUrl ? "tiktok" : "video",
                                status: scheduleTime ? "scheduled" : "published",
                                scheduledTime: scheduleTime ? new Date(scheduleTime) : null,
                                cloudinaryVideoId: videoPublicId
                            });
                            results.successCount++;
                            results.details.push({ accountId, status: "success", postId: fbPostId });
                        } else {
                            throw new Error(fbRes.details[0].error || "Failed to post video");
                        }

                    } catch (err) {
                        console.error(`❌ Failed for ${accountId}:`, err.message);
                        await PostLog.create({
                            userId,
                            pageId: accountId,
                            type: tiktokUrl ? "tiktok" : "video",
                            status: "failed",
                            error: err.message,
                            cloudinaryVideoId: videoPublicId
                        });
                        results.failedCount++;
                        results.details.push({ accountId, status: "failed", error: err.message });
                    }
                }
            }
        }

        // ✅ Respond success
        res.status(201).json({
            success: true,
            message: results.successCount > 0 ? "Post published successfully" : "Failed to publish post",
            results: results,
            video: {
                url: videoUrlForDB,
                name: videoPublicId,
                size: videoSizeMB ? `${videoSizeMB.toFixed(2)} MB` : "0 MB",
            },
            caption,
            accounts: accountsArray
        });
    } catch (err) {
        console.error("❌ Create post error:", err.message);
        res.status(500).json({
            success: false,
            error: "Failed to create post: " + err.message,
        });
    } finally {
        // 🧹 Cleanup Temp Files (Always run)
        if (req.files) {
            req.files.forEach(f => {
                try {
                    if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
                } catch (e) {
                    console.error(`Failed to delete temp file ${f.path}:`, e);
                }
            });
        }
    }
};
