/**
 * 🎠 carouselController.js — Handle Mixed Media Carousel (Video + Image)
 */

const fs = require("fs");
const path = require("path");
const ScheduledPost = require("../models/ScheduledPost");
const User = require("../models/User");
const fb = require("../utils/fb");
const { uploadFile } = require("../utils/cloudinary");
const { processMediaToSquare } = require("../utils/videoProcessor");

exports.createMixedCarousel = async (req, res) => {
    req.setTimeout(600000); // 10 minutes timeout

    try {
        const { caption, accounts, scheduleTime, videoUrl, imageUrl } = req.body;
        const userId = req.user?.id;

        // 🛑 Validation
        if (!accounts) return res.status(400).json({ success: false, error: "Missing accounts" });

        const videoFile = req.files?.find(f => f.fieldname === 'video');
        const imageFile = req.files?.find(f => f.fieldname === 'image');

        // Check if we have either Files OR URLs
        const hasVideo = videoFile || videoUrl;
        const hasImage = imageFile || imageUrl;

        if (!hasVideo || !hasImage) {
            return res.status(400).json({ success: false, error: "Both video and image are required for mixed carousel" });
        }

        let accountsArray = [];
        try {
            accountsArray = JSON.parse(accounts);
        } catch {
            return res.status(400).json({ success: false, error: "Invalid accounts JSON" });
        }

        // Get User
        const user = await User.findOne({ id: userId });
        if (!user || !user.facebookAccessToken) {
            throw new Error("User not connected to Facebook");
        }

        // ☁️ Step 1: Prepare Media (Upload to Cloudinary if needed)
        let finalVideoUrl = videoUrl;
        let finalImageUrl = imageUrl;

        // Upload Video if file provided
        if (videoFile) {
            console.log("☁️ Uploading video to Cloudinary...");
            const vRes = await uploadFile(videoFile.path, "kr_post/carousel_videos", "video", true, true); // true = transform 1:1
            finalVideoUrl = vRes.url;
        }

        // Upload Image if file provided
        if (imageFile) {
            console.log("☁️ Uploading image to Cloudinary...");
            const iRes = await uploadFile(imageFile.path, "kr_post/carousel_images", "image", true, true); // true = transform 1:1
            finalImageUrl = iRes.url;
        }

        // 💾 Save to DB
        const postId = `carousel_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newPost = await ScheduledPost.create({
            id: postId,
            user_id: userId,
            caption,
            accounts: accountsArray,
            schedule_time: scheduleTime ? new Date(scheduleTime) : new Date(),
            status: "processing",
            is_scheduled: !!scheduleTime,
            type: 'mixed_carousel',
            carousel_cards: [
                { type: 'video', url: finalVideoUrl },
                { type: 'image', url: finalImageUrl }
            ]
        });

        // 🚀 Step 2: Post to Facebook
        const results = { successCount: 0, failedCount: 0, details: [] };

        for (const accountId of accountsArray) {
            try {
                const page = user.connectedPages.find(p => p.id === accountId);
                const pageToken = user.getDecryptedPageToken(accountId);

                if (!page || !pageToken) throw new Error(`Page ${accountId} not found or invalid token`);

                console.log(`🚀 Starting Mixed Carousel for ${page.name}...`);

                // 2.1 Upload Video (Unpublished) - Using Cloudinary URL
                // fb.uploadVideoToFacebook supports URL input
                const videoUpload = await fb.uploadVideoToFacebook(pageToken, accountId, finalVideoUrl, "Video Part", null, {
                    isScheduled: false,
                    published: false
                });

                if (!videoUpload.success) throw new Error("Failed to upload video part: " + videoUpload.error);
                const videoId = videoUpload.postId;

                // 2.2 Upload Image (Unpublished) - Using Cloudinary URL
                const photoForm = new (require("form-data"))();
                photoForm.append("access_token", pageToken);
                photoForm.append("url", finalImageUrl); // ✅ Use 'url' for remote upload
                photoForm.append("published", "false");

                const photoRes = await require("axios").post(`https://graph.facebook.com/v19.0/${accountId}/photos`, photoForm, {
                    headers: photoForm.getHeaders()
                });
                const photoId = photoRes.data.id;

                console.log(`✅ Media Uploaded: Video ${videoId}, Photo ${photoId}`);

                // 2.3 Publish Carousel Feed
                const feedPayload = {
                    access_token: pageToken,
                    message: caption,
                    attached_media: [
                        { media_fbid: videoId },
                        { media_fbid: photoId }
                    ]
                };

                if (scheduleTime) {
                    feedPayload.published = false;
                    feedPayload.scheduled_publish_time = Math.floor(new Date(scheduleTime).getTime() / 1000);
                }

                const feedRes = await require("axios").post(`https://graph.facebook.com/v19.0/${accountId}/feed`, feedPayload);

                results.successCount++;
                results.details.push({ accountId, status: "success", postId: feedRes.data.id });
                console.log(`✅ Mixed Carousel Published: ${feedRes.data.id}`);

            } catch (err) {
                console.error(`❌ Failed for ${accountId}:`, err.message);
                results.failedCount++;
                results.details.push({ accountId, status: "failed", error: err.message });
            }
        }

        // Update DB
        newPost.status = results.successCount > 0 ? "completed" : "failed";
        newPost.posted_at = new Date();
        await newPost.save();

        res.status(201).json({
            success: true,
            results,
            postId: newPost.id
        });

    } catch (err) {
        console.error("❌ Mixed Carousel Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};
