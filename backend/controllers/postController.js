/**
 * 🎥 postController.js — Handle post creation logic
 */

const fs = require("fs");
const ScheduledPost = require("../models/ScheduledPost");
const { uploadFile } = require("../utils/cloudinary");
const fb = require("../utils/fb");
const User = require("../models/User");

exports.createPost = async (req, res) => {
    // ✅ Increase timeout for this route to 10 minutes
    req.setTimeout(600000);

    try {
        const { title, caption, accounts, scheduleTime, tiktokUrl, directMediaUrl, postType, carouselCards } = req.body;
        const userId = req.user?.id;

        // 🛑 Validate fields
        if (postType === 'carousel') {
            if (!carouselCards || !accounts) return res.status(400).json({ success: false, error: "Missing carousel cards or accounts" });
        } else {
            // Single Post Validation
            const videoFile = req.files?.find(f => f.fieldname === 'video');
            if (!videoFile && !directMediaUrl && !tiktokUrl && !caption)
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

        // 💾 Save post record (MongoDB)
        const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        let newPostData = {
            id: postId,
            user_id: userId,
            title, // ✅ Save Title
            caption,
            accounts: accountsArray,
            schedule_time: scheduleTime ? new Date(scheduleTime) : new Date(),
            status: "processing",
            is_scheduled: !!scheduleTime,
            type: postType === 'carousel' ? 'carousel' : (directMediaUrl || req.files?.find(f => f.fieldname === 'video') ? "media" : "link")
        };

        // Get User Token
        const user = await User.findOne({ id: userId });
        if (!user || !user.facebookAccessToken) {
            throw new Error("User not connected to Facebook");
        }

        let results;
        let videoUrlForDB = null;
        let thumbnailUrlForDB = null;
        let videoSizeMB = 0;
        let videoPublicId;

        if (postType === 'carousel') {
            // 🎠 Handle Carousel (Existing Logic)
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
                    const result = await uploadFile(cardFile.path, "kr_post/carousel", card.type === 'video' ? 'video' : 'image');
                    mediaUrl = result.url;
                } else if (card.previewUrl) {
                    mediaUrl = card.previewUrl;
                }

                if (cardThumbnail) {
                    console.log(`📤 Uploading carousel card thumbnail: ${cardThumbnail.filename}`);
                    const thumbResult = await uploadFile(cardThumbnail.path, "kr_post/thumbnails", "image");
                    thumbnailUrl = thumbResult.url;
                }

                return {
                    ...card,
                    url: mediaUrl,
                    thumbnailUrl: thumbnailUrl
                };
            }));

            newPostData.carousel_cards = processedCards;

            results = await fb.postCarousel(
                user.getDecryptedAccessToken(),
                accountsArray.map(id => ({ id, type: 'page' })),
                caption,
                processedCards,
                {
                    isScheduled: !!scheduleTime,
                    scheduleTime: scheduleTime ? Math.floor(new Date(scheduleTime).getTime() / 1000) : null
                }
            );

        } else {
            // 🎥 Handle Single Post
            const videoFile = req.files?.find(f => f.fieldname === 'video');
            const thumbFile = req.files?.find(f => f.fieldname === 'thumbnail');

            if (videoFile) {
                // ✅ Direct Stream Upload to Facebook (Bypass Cloudinary for main video)
                console.log(`📤 Streaming local video to Facebook: ${videoFile.filename}`);

                // Create streams
                const videoStream = fs.createReadStream(videoFile.path);
                const thumbStream = thumbFile ? fs.createReadStream(thumbFile.path) : null;

                videoSizeMB = videoFile.size / (1024 * 1024);

                // 1. Upload to Cloudinary for DB Record (Async/Optional but good for history)
                // ⚠️ Pass false to keep file for Facebook Stream
                const videoResult = await uploadFile(videoFile.path, "kr_post/videos", "video", false);
                videoUrlForDB = videoResult.url;
                videoPublicId = videoResult.public_id;

                if (thumbFile) {
                    const thumbResult = await uploadFile(thumbFile.path, "kr_post/thumbnails", "image", false);
                    thumbnailUrlForDB = thumbResult.url;
                }

                // 2. Post to Facebook using Stream
                const fbVideoStream = fs.createReadStream(videoFile.path);
                const fbThumbStream = thumbFile ? fs.createReadStream(thumbFile.path) : null;

                // 🔍 Find Page Access Tokens
                const targetAccounts = accountsArray.map(id => {
                    const page = user.connectedPages.find(p => p.id === id);
                    return {
                        id,
                        type: 'page',
                        name: page?.name || 'Unknown Page',
                        access_token: user.getDecryptedPageToken(id) // ✅ Decrypt Page Token
                    };
                });

                results = await fb.postToFB(
                    user.getDecryptedAccessToken(),
                    targetAccounts, // ✅ Pass Full Account Objects
                    fbVideoStream,
                    caption,
                    fbThumbStream,
                    {
                        title,
                        isScheduled: !!scheduleTime,
                        scheduleTime: scheduleTime ? Math.floor(new Date(scheduleTime).getTime() / 1000) : null,
                        link: tiktokUrl
                    }
                );

            } else if (directMediaUrl) {
                videoUrlForDB = directMediaUrl;

                // 🔍 Find Page Access Tokens
                const targetAccounts = accountsArray.map(id => {
                    const page = user.connectedPages.find(p => p.id === id);
                    return {
                        id,
                        type: 'page',
                        name: page?.name || 'Unknown Page',
                        access_token: user.getDecryptedPageToken(id) // ✅ Decrypt Page Token
                    };
                });

                results = await fb.postToFB(
                    user.getDecryptedAccessToken(),
                    targetAccounts, // ✅ Pass Full Account Objects
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
            }

            newPostData.video_url = videoUrlForDB || tiktokUrl;
            newPostData.thumbnail_url = thumbnailUrlForDB;
        }

        const newPost = await ScheduledPost.create(newPostData);

        // Update Status
        const successCount = results.successCount;
        newPost.status = successCount > 0 ? "completed" : "failed";
        newPost.posted_at = new Date();
        if (results.details) {
            newPost.publishedIds = results.details
                .filter(r => r.status === 'success' && r.postId)
                .map(r => ({ accountId: r.accountId, postId: r.postId }));
        }
        await newPost.save();

        // ✅ Respond success
        res.status(201).json({
            success: true,
            message: successCount > 0 ? "Post published successfully" : "Failed to publish post",
            results: results,
            video: {
                url: videoUrlForDB,
                name: videoPublicId,
                size: videoSizeMB ? `${videoSizeMB.toFixed(2)} MB` : "0 MB",
            },
            caption,
            accounts: accountsArray,
            postId: newPost.id,
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
