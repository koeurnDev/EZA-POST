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

        // ☁️ Step 1: Prepare Media (Upload to Cloudinary if needed)
        let finalVideoUrl = videoUrl;
        let finalVideoPublicId = null;
        let finalImageUrls = [];
        let finalImagePublicIds = [];

        // Upload Video if file provided
        if (videoFile) {
            console.log("☁️ Uploading video to Cloudinary...");
            const vRes = await uploadFile(videoFile.path, "eza-post/carousel_videos", "video", true, true); // true = transform 1:1
            finalVideoUrl = vRes.url;
            finalVideoPublicId = vRes.public_id;
        }

        // Upload Images
        if (imageFiles && imageFiles.length > 0) {
            console.log(`☁️ Uploading ${imageFiles.length} images to Cloudinary...`);
            for (const img of imageFiles) {
                const iRes = await uploadFile(img.path, "eza-post/carousel_images", "image", true, true); // true = transform 1:1
                finalImageUrls.push(iRes.url);
                finalImagePublicIds.push(iRes.public_id);
            }
        }

        // 🚀 Step 2: Post to Facebook
        const results = { successCount: 0, failedCount: 0, details: [] };

        for (const accountId of accountsArray) {
            try {
                // Fetch Page from DB
                const page = await FacebookPage.findOne({ pageId: accountId, userId: userId });

                // Fallback to User.connectedPages if not found in FacebookPage (migration support)
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

                // 2.1 Upload Video (Unpublished) - Using Cloudinary URL
                const videoUpload = await fb.uploadVideoToFacebook(pageToken, accountId, finalVideoUrl, "Video Part", null, {
                    isScheduled: false,
                    published: false
                });

                if (!videoUpload.success) throw new Error("Failed to upload video part: " + videoUpload.error);
                const videoId = videoUpload.postId;

                // 2.2 Upload Images (Unpublished) - Using Cloudinary URLs
                const photoIds = [];
                for (const imgUrl of finalImageUrls) {
                    const photoForm = new (require("form-data"))();
                    photoForm.append("access_token", pageToken);
                    photoForm.append("url", imgUrl); // ✅ Use 'url' for remote upload
                    photoForm.append("published", "false");

                    const photoRes = await require("axios").post(`https://graph.facebook.com/v19.0/${accountId}/photos`, photoForm, {
                        headers: photoForm.getHeaders()
                    });
                    photoIds.push(photoRes.data.id);
                }

                console.log(`✅ Media Uploaded: Video ${videoId}, Photos ${photoIds.join(", ")}`);

                // 2.3 Publish Carousel Feed
                const attachedMedia = [
                    { media_fbid: videoId },
                    ...photoIds.map(id => ({ media_fbid: id }))
                ];

                const feedPayload = {
                    access_token: pageToken,
                    message: caption,
                    attached_media: attachedMedia
                };

                if (scheduleTime) {
                    feedPayload.published = false;
                    feedPayload.scheduled_publish_time = Math.floor(new Date(scheduleTime).getTime() / 1000);
                }

                const feedRes = await require("axios").post(`https://graph.facebook.com/v19.0/${accountId}/feed`, feedPayload);

                // 💬 Auto Comment
                if (req.body.autoComment) {
                    await fb.postComment(pageToken, feedRes.data.id, req.body.autoComment);
                }

                // 📝 Create PostLog
                await PostLog.create({
                    userId,
                    pageId: accountId,
                    fbPostId: feedRes.data.id,
                    type: "carousel",
                    status: scheduleTime ? "scheduled" : "published",
                    scheduledTime: scheduleTime ? new Date(scheduleTime) : null,
                    cloudinaryVideoId: finalVideoPublicId,
                    cloudinaryImageIds: finalImagePublicIds
                });

                results.successCount++;
                results.details.push({ accountId, status: "success", postId: feedRes.data.id });
                console.log(`✅ Mixed Carousel Published: ${feedRes.data.id}`);

            } catch (err) {
                console.error(`❌ Failed for ${accountId}:`, err.message);

                // 📝 Log Failure
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
    }
};
