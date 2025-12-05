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
const axios = require("axios"); // ✅ Added for downloading images

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
        console.log("📦 Body:", JSON.stringify(req.body, null, 2));
        console.log("📂 Files:", req.files ? req.files.map(f => f.fieldname) : "None");

        try {
            if (req.body.carouselCards) {
                const cards = JSON.parse(req.body.carouselCards);
                console.log("🃏 Parsed Cards:", cards);
                hasPageCard = cards.some(c => c.imageUrl); // Page Card has imageUrl
                console.log("✅ Has Page Card:", hasPageCard);
            } else {
                console.warn("⚠️ No carouselCards in body");
            }
        } catch (e) {
            console.error("❌ JSON Parse Error:", e.message);
        }

        if (!hasVideo || !hasPageCard) {
            throw new Error("Video and Page Card are required for mixed carousel");
        }

        // 🔄 Phase 1: Preparation (Upload & Process)
        let finalVideoUrl = videoUrl;
        let finalVideoPublicId = null;
        let finalThumbnailUrl = null; // ✅ Define variable for thumbnail URL
        let finalVideoPath = null; // Path to processed video
        let finalThumbnailPath = null; // Path to thumbnail
        let finalRightSideImagePath = null; // ✅ Path to custom right side image

        const { processMediaToSquare, generateThumbnail } = require("../utils/videoProcessor");

        // 1.1 Process Video
        if (videoFile) {
            console.log("🎬 Phase 1: Processing video locally (1080x1080)...");
            const processedVideoPath = await processMediaToSquare(videoFile.path);
            localVideoPath = processedVideoPath;
            finalVideoPath = processedVideoPath;

            // ✅ Generate Thumbnail (or use Custom Upload)
            const customThumbnailFile = req.files?.find(f => f.fieldname === 'thumbnail');

            if (customThumbnailFile) {
                console.log("🖼️ Using Custom Thumbnail uploaded by user");
                localThumbnailPath = customThumbnailFile.path;
                finalThumbnailPath = customThumbnailFile.path;
            } else {
                try {
                    localThumbnailPath = await generateThumbnail(localVideoPath);
                    finalThumbnailPath = localThumbnailPath;
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
        } else if (videoUrl) {
            console.log("🔗 Phase 1: Processing video from URL (TikTok/External)...");

            // 1. Download Video to Temp
            const tempVideoName = `temp_video_url_${Date.now()}.mp4`;
            const tempDownloadPath = path.join(__dirname, "../temp", tempVideoName);

            // Ensure temp dir exists
            const tempDir = path.dirname(tempDownloadPath);
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            console.log(`⬇️ Downloading video from URL: ${videoUrl}`);
            const response = await axios({
                url: videoUrl,
                method: 'GET',
                responseType: 'stream'
            });

            await new Promise((resolve, reject) => {
                const writer = fs.createWriteStream(tempDownloadPath);
                response.data.pipe(writer);
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // 2. Process to Square (Black Padding & Centered)
            console.log("🎬 Processing downloaded video to 1:1 Square...");
            const processedVideoPath = await processMediaToSquare(tempDownloadPath);

            // Mark for cleanup
            localVideoPath = processedVideoPath;
            finalVideoPath = processedVideoPath;

            // Cleanup the raw download immediately as we have the processed version
            try { fs.unlinkSync(tempDownloadPath); } catch (e) { console.warn("⚠️ Failed to delete temp download"); }

            // 3. Generate Thumbnail
            const customThumbnailFile = req.files?.find(f => f.fieldname === 'thumbnail');
            if (customThumbnailFile) {
                localThumbnailPath = customThumbnailFile.path;
                finalThumbnailPath = customThumbnailFile.path;
            } else {
                try {
                    localThumbnailPath = await generateThumbnail(localVideoPath);
                    finalThumbnailPath = localThumbnailPath;
                } catch (thumbErr) {
                    console.warn("⚠️ Failed to generate thumbnail:", thumbErr.message);
                }
            }

            // 4. Upload Processed Video to Cloudinary
            console.log("☁️ Uploading processed video to Cloudinary...");
            const vRes = await uploadFile(processedVideoPath, "eza-post/carousel_videos", "video", false, false);
            finalVideoUrl = vRes.url;
            finalVideoPublicId = vRes.public_id;

            // 5. Upload Thumbnail
            if (localThumbnailPath) {
                try {
                    const tRes = await uploadFile(localThumbnailPath, "eza-post/carousel_thumbnails", "image", false, false);
                    finalThumbnailUrl = tRes.url;
                } catch (thumbUploadErr) { console.warn("⚠️ Failed to upload thumbnail:", thumbUploadErr.message); }
            }
        }

        // ✅ 1.2 Process Right Side Image (Custom Page Card Image)
        let finalRightSideImageUrl = null;
        const rightSideImageFile = req.files?.find(f => f.fieldname === 'rightSideImage');
        if (rightSideImageFile) {
            console.log("🖼️ Uploading Custom Right Side Image to Cloudinary...");
            const rRes = await uploadFile(rightSideImageFile.path, "eza-post/carousel_images", "image", false, false);
            finalRightSideImageUrl = rRes.url;
        }

        // 🚀 Phase 2: Create Attachments & Publish (Link Carousel Method)
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

                console.log(`🚀 Starting Link Carousel for ${pageName} (${accountId})...`);

                // 🔄 Construct Child Attachments (JSON Payload)
                let carouselCards = [];
                try {
                    if (req.body.carouselCards) {
                        carouselCards = JSON.parse(req.body.carouselCards);
                    }
                } catch (e) {
                    console.warn("⚠️ Invalid carouselCards JSON, using default logic");
                }

                // ✅ Auto-Generate Cards if missing
                if (!carouselCards || carouselCards.length === 0) {
                    carouselCards.push({ type: 'video' });
                    carouselCards.push({ type: 'image', isPageCard: true });
                }

                const finalChildAttachments = [];
                const pageUrl = `https://facebook.com/${accountId}`;

                // 1. Auto-Fill Defaults
                const defaultHeadline = pageName || "EZA Post";
                const defaultDescription = "Swipe to see more";
                const defaultLink = pageUrl;

                // 2. Extract User Input (if any)
                const unifiedDescription = carouselCards[0].description || defaultDescription;
                const unifiedHeadline = carouselCards[0].headline || defaultHeadline;
                const unifiedLink = carouselCards[0].link || defaultLink;

                for (const [index, card] of carouselCards.entries()) {
                    let link = unifiedLink;
                    let headline = unifiedHeadline;
                    let description = unifiedDescription;
                    let pictureUrl = null;

                    const isEndCard = index >= 2 && index === carouselCards.length - 1;

                    if (isEndCard) {
                        headline = `Follow ${pageName}`;
                        description = "Don't miss our next post!";
                        link = pageUrl;
                    }

                    if (card.type === 'video') {
                        // 🎥 Video Card -> Use Thumbnail as Picture, Video URL as Link
                        pictureUrl = finalThumbnailUrl;
                        link = finalVideoUrl || link; // Link to video
                        if (!pictureUrl) console.warn("⚠️ No thumbnail available for video card");
                    } else {
                        // 🖼️ Image Card (Page Card)
                        if (finalRightSideImageUrl && card.isPageCard) {
                            pictureUrl = finalRightSideImageUrl;
                        } else if (card.imageUrl) {
                            pictureUrl = card.imageUrl;
                        }
                        // Ensure we have a picture
                        if (!pictureUrl) {
                            // Fallback to page picture if possible, or skip
                            // For now, let's use a placeholder or the thumbnail again if really missing
                            pictureUrl = finalThumbnailUrl;
                        }
                    }

                    // 3. Construct Attachment Object
                    const attachment = {
                        link: link,
                        name: headline,
                        description: description,
                        picture: pictureUrl
                    };

                    finalChildAttachments.push(attachment);
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

        // 🧹 Cleanup Right Side Image
        if (finalRightSideImagePath && fs.existsSync(finalRightSideImagePath)) {
            try {
                fs.unlinkSync(finalRightSideImagePath);
                console.log(`🧹 Cleaned up right side image file: ${finalRightSideImagePath}`);
            } catch (cleanupErr) {
                console.warn(`⚠️ Failed to delete right side image file: ${cleanupErr.message}`);
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
