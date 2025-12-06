/**
 * 🎠 carouselController.js — Handle Mixed Media Carousel (Video + Image)
 * ✅ Native Facebook Uploads (No Cloudinary)
 */

const fs = require("fs");
const path = require("path");
const PostLog = require("../models/PostLog");
const FacebookPage = require("../models/FacebookPage");
const User = require("../models/User");
const fb = require("../utils/fb");
const axios = require("axios");

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

        // 2. Parse Cards
        let carouselCards = [];
        try {
            if (req.body.carouselCards) {
                carouselCards = JSON.parse(req.body.carouselCards);
            }
        } catch (e) {
            console.warn("⚠️ Invalid carouselCards JSON");
        }

        // 3. Process Per Account
        const results = { successCount: 0, failedCount: 0, details: [] };

        for (const accountId of accountsArray) {
            try {
                // Fetch Page & Token
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
                            // Only upload video for the FIRST video card (assuming single video for now, or re-upload if multiple)
                            // Optimization: If we already uploaded for this account, reuse? 
                            // FB requires unique upload per post usually, but media_fbid can be reused? 
                            // Actually, for carousel, we upload ONCE per post.

                            // We use the 'videoInput' we prepared earlier
                            // Note: Streams can only be read once. If multiple accounts, we need fresh streams.
                            // FIX: Re-create stream for each account/upload
                            let currentVideoInput = videoInput;
                            if (videoFile) currentVideoInput = fs.createReadStream(videoFile.path);

                            let currentThumbInput = thumbnailInput;
                            if (thumbnailFile) currentThumbInput = fs.createReadStream(thumbnailFile.path);

                            const vRes = await fb.uploadVideoForCarousel(pageToken, accountId, currentVideoInput, currentThumbInput);
                            mediaFbid = vRes.id;

                            // Video Link: usually points to the video itself or a target
                            // If we want the card to open the video, we might not need a link, 
                            // but child_attachments usually requires one.
                            // We can use the page URL or a specific target.

                        } else {
                            // Image Card
                            let currentImageInput = null;

                            if (card.isPageCard && rightSideImageFile) {
                                currentImageInput = fs.createReadStream(rightSideImageFile.path);
                            } else if (card.isPageCard && !rightSideImageFile) {
                                // 🖼️ Auto-Generated Page Card (Robust High-Res Stream)
                                try {
                                    console.log(`🖼️ Fetching High-Res Profile Picture for Page ${accountId}...`);

                                    // 1. Get High-Res URL
                                    const picUrlRes = await axios.get(`https://graph.facebook.com/v19.0/${accountId}/picture`, {
                                        params: { width: 1000, redirect: false, access_token: pageToken }
                                    });
                                    const picUrl = picUrlRes.data?.data?.url;

                                    if (picUrl) {
                                        console.log(`🔗 Downloading stream: ${picUrl}`);
                                        // 2. Download Stream
                                        const picStream = await axios.get(picUrl, { responseType: 'stream' });

                                        // 3. Upload Stream as Photo Container
                                        const pRes = await fb.uploadPhotoForCarousel(pageToken, accountId, picStream.data);
                                        mediaFbid = pRes.id;
                                    } else {
                                        console.warn("⚠️ Could not fetch high-res picture URL");
                                    }
                                } catch (picErr) {
                                    console.error("❌ Failed to process auto-page-card:", picErr.message);
                                }
                            } else if (card.imageUrl) {
                                // Custom Image URL (if any)
                                const pRes = await fb.uploadPhotoForCarousel(pageToken, accountId, card.imageUrl);
                                mediaFbid = pRes.id;
                            }
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

                    if (mediaFbid) {
                        attachment.media_fbid = mediaFbid;
                    } else {
                        console.warn(`⚠️ No media_fbid for card ${index + 1}, skipping media attachment`);
                        // Fallback? If it's a link card, maybe just picture?
                        // But we are doing Native.
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
                    await PostLog.create({
                        userId,
                        pageId: accountId,
                        fbPostId: fbPostId,
                        type: "carousel",
                        status: scheduleTime ? "scheduled" : "published",
                        scheduledTime: scheduleTime ? new Date(scheduleTime) : null
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
        const { caption, accounts, scheduleTime } = req.body;
        const userId = req.user?.id;

        if (!accounts) return res.status(400).json({ success: false, error: "Missing accounts" });

        let accountsArray = [];
        try {
            accountsArray = JSON.parse(accounts);
        } catch {
            return res.status(400).json({ success: false, error: "Invalid accounts JSON" });
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
