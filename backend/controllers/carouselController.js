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
        const { caption, accounts, scheduleTime } = req.body;
        const userId = req.user?.id;

        // 🛑 Validation
        if (!accounts) return res.status(400).json({ success: false, error: "Missing accounts" });

        const videoFile = req.files?.find(f => f.fieldname === 'video');
        const imageFile = req.files?.find(f => f.fieldname === 'image');

        if (!videoFile || !imageFile) {
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

        // 🎬 Step 1: Process Media (Pad to 1:1)
        let finalVideoPath = videoFile.path;
        let finalImagePath = imageFile.path;

        try {
            console.log("🔄 Processing video...");
            finalVideoPath = await processMediaToSquare(videoFile.path);
        } catch (err) {
            console.error("⚠️ FFmpeg processing failed for video, using original:", err.message);
        }

        try {
            console.log("🔄 Processing image...");
            finalImagePath = await processMediaToSquare(imageFile.path);
        } catch (err) {
            console.error("⚠️ FFmpeg processing failed for image, using original:", err.message);
        }

        // ☁️ Step 2: Upload to Cloudinary (for DB Record)
        const videoResult = await uploadFile(finalVideoPath, "kr_post/carousel_videos", "video", false);
        const imageResult = await uploadFile(finalImagePath, "kr_post/carousel_images", "image", false);

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
                { type: 'video', url: videoResult.url },
                { type: 'image', url: imageResult.url }
            ]
        });

        // 🚀 Step 3: Post to Facebook
        const results = { successCount: 0, failedCount: 0, details: [] };

        for (const accountId of accountsArray) {
            try {
                const page = user.connectedPages.find(p => p.id === accountId);
                const pageToken = user.getDecryptedPageToken(accountId);

                if (!page || !pageToken) throw new Error(`Page ${accountId} not found or invalid token`);

                console.log(`🚀 Starting Mixed Carousel for ${page.name}...`);

                // 3.1 Upload Video (Unpublished)
                const videoStream = fs.createReadStream(finalVideoPath);
                const videoUpload = await fb.uploadVideoToFacebook(pageToken, accountId, videoStream, "Video Part", null, {
                    isScheduled: false // Must be unpublished first
                });

                if (!videoUpload.success) throw new Error("Failed to upload video part: " + videoUpload.error);
                const videoId = videoUpload.postId;

                // 3.2 Upload Image (Unpublished)
                const photoForm = new (require("form-data"))();
                photoForm.append("access_token", pageToken);
                photoForm.append("source", fs.createReadStream(finalImagePath));
                photoForm.append("published", "false");

                const photoRes = await require("axios").post(`https://graph.facebook.com/v19.0/${accountId}/photos`, photoForm, {
                    headers: photoForm.getHeaders()
                });
                const photoId = photoRes.data.id;

                console.log(`✅ Media Uploaded: Video ${videoId}, Photo ${photoId}`);

                // 3.3 Publish Carousel Feed
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
    } finally {
        // 🧹 Cleanup
        const filesToDelete = [
            req.files?.find(f => f.fieldname === 'video')?.path,
            req.files?.find(f => f.fieldname === 'image')?.path,
            path.join(path.dirname(req.files?.[0]?.path || ""), `processed_${path.basename(req.files?.find(f => f.fieldname === 'video')?.path || "")}`),
            path.join(path.dirname(req.files?.[0]?.path || ""), `processed_${path.basename(req.files?.find(f => f.fieldname === 'image')?.path || "")}`)
        ];

        filesToDelete.forEach(p => {
            if (p && fs.existsSync(p)) {
                try {
                    fs.unlinkSync(p);
                } catch (e) {
                    console.error("Failed to delete temp file:", p);
                }
            }
        });
    }
};
