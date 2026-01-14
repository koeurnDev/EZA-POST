/**
 * 🎥 postController.js — Handle post creation logic
 */

const fs = require("fs");
const prisma = require('../utils/prisma');
const { uploadFile } = require("../utils/cloudinary");
const fb = require("../utils/fb");
// Decryption helper local or imported if centralized
const { decrypt } = require("../utils/crypto");


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

        let accountsArray = [];
        if (accounts) {
            try {
                accountsArray = JSON.parse(accounts);
                if (!Array.isArray(accountsArray)) throw new Error("Invalid accounts format");
            } catch {
                return res.status(400).json({ success: false, error: "Invalid accounts JSON" });
            }
        }

        // ✅ Auto-Select All Pages if accounts is missing/empty
        if (!accountsArray || accountsArray.length === 0) {
            console.log("⚠️ No accounts provided. Auto-selecting all connected pages.");
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { connectedPages: true }
            });

            // Prisma stores JSON. We need to cast or ensure it's iterable.
            // If default is "[]" string, we might get a string or object depending on Prisma version/DB handling.
            // Usually Json type in Prisma returns an Object/Array in JS.
            let connectedPages = user?.connectedPages;
            if (typeof connectedPages === 'string') {
                try { connectedPages = JSON.parse(connectedPages) } catch (e) { }
            }

            if (Array.isArray(connectedPages) && connectedPages.length > 0) {
                accountsArray = connectedPages.map(p => p.id);
            } else {
                return res.status(400).json({ success: false, error: "No connected pages found. Please connect a page first." });
            }
        }

        let results = { successCount: 0, failedCount: 0, details: [] };
        let videoUrlForDB = null;
        let thumbnailUrlForDB = null;
        let videoSizeMB = 0;
        let videoPublicId = null;

        if (postType === 'carousel') {
            // 🎠 Delegation: Pass the heavy lifting to the dedicated controller
            const carouselController = require("./carouselController");

            // We pass the raw request and accounts; the controller handles file processing, 
            // ID creation, and posting.
            results = await carouselController.processAndPostCarousel(
                req,
                accountsArray,
                userId,
                caption,
                scheduleTime
            );

        } else {
            // 🎥 Handle Single Post
            const videoFile = req.files?.find(f => f.fieldname === 'video');
            const thumbFile = req.files?.find(f => f.fieldname === 'thumbnail');

            if (videoFile) {
                // ✅ Upload to Cloudinary First (Transformation 1:1)
                console.log(`☁️ Uploading video to Cloudinary: ${videoFile.filename}`);

                videoSizeMB = videoFile.size / (1024 * 1024);

                // Upload with transform=false (Upload Original - No Padding)
                let videoResult = await uploadFile(videoFile.path, "eza-post/videos", "video", true, false);
                videoUrlForDB = videoResult.url;
                videoPublicId = videoResult.public_id;

                if (thumbFile) {
                    const thumbResult = await uploadFile(thumbFile.path, "eza-post/thumbnails", "image", true);
                    thumbnailUrlForDB = thumbResult.url;
                }

                // 🪄 AI Randomizer Processing
                let finalVideoPath = videoFile.path;
                let processedVideoPath = null;
                const aiOptions = req.body.aiOptions ? JSON.parse(req.body.aiOptions) : null;

                if (aiOptions && (aiOptions.pitchShift || aiOptions.flip || aiOptions.safeMode)) {
                    console.log("🤖 Applying AI Randomizer...", aiOptions);
                    try {
                        const { processVideo } = require("../services/videoProcessor");
                        const tempDir = require("path").join(__dirname, "../../temp/videos");
                        processedVideoPath = await processVideo(videoFile.path, tempDir, aiOptions);
                        finalVideoPath = processedVideoPath; // Swap to processed file
                    } catch (procErr) {
                        console.error("❌ AI Processing failed, falling back to original:", procErr);
                        // Fallback to original
                    }
                }

                // ✅ Upload to Cloudinary (Using Final Path)
                console.log(`☁️ Uploading video to Cloudinary: ${finalVideoPath}`);
                videoSizeMB = fs.statSync(finalVideoPath).size / (1024 * 1024);

                // Upload with transform=false (Upload Original - No Padding)
                videoResult = await uploadFile(finalVideoPath, "eza-post/videos", "video", true, false);
                videoUrlForDB = videoResult.url;
                videoPublicId = videoResult.public_id;
                for (let i = 0; i < accountsArray.length; i++) {
                    const accountId = accountsArray[i];
                    try {
                        // 1. Try finding in FacebookPage table
                        const page = await prisma.facebookPage.findUnique({
                            where: { id: accountId }
                        });

                        let pageToken = page ? decrypt(page.accessToken) : null;
                        let pageName = page ? page.name : 'Unknown Page';

                        // 2. Fallback: User's connectedPages JSON
                        if (!pageToken) {
                            const user = await prisma.user.findUnique({
                                where: { id: userId },
                                select: { connectedPages: true }
                            });

                            let connectedPages = user?.connectedPages;
                            if (typeof connectedPages === 'string') {
                                try { connectedPages = JSON.parse(connectedPages) } catch (e) { }
                            }

                            const connectedPage = Array.isArray(connectedPages) ? connectedPages.find(p => p.id === accountId) : null;

                            if (connectedPage) {
                                pageToken = decrypt(connectedPage.access_token);
                                pageName = connectedPage.name;
                            }
                        }

                        if (!pageToken) throw new Error(`Page ${accountId} not found or invalid token`);

                        // 🕒 Stagger Calculation
                        let finalScheduleTime = scheduleTime ? new Date(scheduleTime) : null;
                        const staggerDelay = parseInt(req.body.staggerDelay || 0);

                        if (finalScheduleTime && staggerDelay > 0) {
                            // Add delay based on index: 0, 10, 20, 30...
                            finalScheduleTime.setMinutes(finalScheduleTime.getMinutes() + (i * staggerDelay));
                        }

                        // ✅ Use Direct File Upload (Stream) for Reliability
                        const videoStream = fs.createReadStream(finalVideoPath);

                        const fbRes = await fb.postToFB(
                            null, // User token not needed if we pass targetAccounts with tokens
                            [{ id: accountId, type: 'page', access_token: pageToken, name: pageName }],
                            videoStream, // ✅ Pass Stream instead of URL
                            caption,
                            thumbFile ? { buffer: fs.readFileSync(thumbFile.path) } : null,
                            {
                                title,
                                isScheduled: !!finalScheduleTime,
                                scheduleTime: finalScheduleTime ? Math.floor(finalScheduleTime.getTime() / 1000) : null,
                                link: tiktokUrl
                            }
                        );

                        if (fbRes.successCount > 0) {
                            const fbPostId = fbRes.details[0].postId;

                            // 💬 Auto Comment
                            if (req.body.autoComment) {
                                await fb.postComment(pageToken, fbPostId, req.body.autoComment);
                            }

                            // 🏷️ Soft Delete Cloudinary Assets (1-Day Delay)
                            const { softDeleteAsset } = require("../utils/cloudinary");
                            if (videoPublicId) await softDeleteAsset(videoPublicId);
                            // if (thumbnailPublicId) await softDeleteAsset(thumbnailPublicId);

                            await prisma.postLog.create({
                                data: {
                                    userId,
                                    pageId: accountId,
                                    fbPostId: fbPostId,
                                    type: tiktokUrl ? "tiktok" : "video",
                                    status: finalScheduleTime ? "scheduled" : "published",
                                    scheduledTime: finalScheduleTime || null,
                                    cloudinaryVideoId: videoPublicId
                                }
                            });
                            results.successCount++;
                            results.details.push({ accountId, status: "success", postId: fbPostId });
                        } else {
                            throw new Error(fbRes.details[0].error || "Failed to post video");
                        }

                    } catch (err) {
                        console.error(`❌ Failed for ${accountId}:`, err.message);
                        await prisma.postLog.create({
                            data: {
                                userId,
                                pageId: accountId,
                                type: tiktokUrl ? "tiktok" : "video",
                                status: "failed",
                                error: err.message,
                                cloudinaryVideoId: videoPublicId
                            }
                        });
                        results.failedCount++;
                        results.details.push({ accountId, status: "failed", error: err.message });
                    }
                }

            } else if (videoUrl || directMediaUrl) {
                videoUrlForDB = videoUrl || directMediaUrl;

                // Extract Public ID if it's a Cloudinary URL
                if (videoUrlForDB && videoUrlForDB.includes("cloudinary.com")) {
                    try {
                        const matches = videoUrlForDB.match(/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
                        if (matches) videoPublicId = matches[1];
                    } catch (e) {
                        console.warn("Could not extract publicId from URL:", videoUrlForDB);
                    }
                }

                for (let i = 0; i < accountsArray.length; i++) {
                    const accountId = accountsArray[i];
                    try {
                        // 1. Try finding in FacebookPage table
                        const page = await prisma.facebookPage.findUnique({
                            where: { id: accountId }
                        });

                        let pageToken = page ? decrypt(page.accessToken) : null;
                        let pageName = page ? page.name : 'Unknown Page';

                        // 2. Fallback: User's connectedPages JSON
                        if (!pageToken) {
                            const user = await prisma.user.findUnique({
                                where: { id: userId },
                                select: { connectedPages: true }
                            });

                            let connectedPages = user?.connectedPages;
                            if (typeof connectedPages === 'string') {
                                try { connectedPages = JSON.parse(connectedPages) } catch (e) { }
                            }

                            const connectedPage = Array.isArray(connectedPages) ? connectedPages.find(p => p.id === accountId) : null;

                            if (connectedPage) {
                                pageToken = decrypt(connectedPage.access_token);
                                pageName = connectedPage.name;
                            }
                        }

                        if (!pageToken) throw new Error(`Page ${accountId} not found or invalid token`);

                        // 🕒 Stagger Calculation
                        let finalScheduleTime = scheduleTime ? new Date(scheduleTime) : null;
                        const staggerDelay = parseInt(req.body.staggerDelay || 0);

                        if (finalScheduleTime && staggerDelay > 0) {
                            finalScheduleTime.setMinutes(finalScheduleTime.getMinutes() + (i * staggerDelay));
                        }

                        const fbRes = await fb.postToFB(
                            null,
                            [{ id: accountId, type: 'page', access_token: pageToken, name: pageName }],
                            videoUrlForDB,
                            caption,
                            null,
                            {
                                title,
                                isScheduled: !!finalScheduleTime,
                                scheduleTime: finalScheduleTime ? Math.floor(finalScheduleTime.getTime() / 1000) : null,
                                link: tiktokUrl
                            }
                        );

                        if (fbRes.successCount > 0) {
                            const fbPostId = fbRes.details[0].postId;

                            // 💬 Auto Comment
                            if (req.body.autoComment) {
                                await fb.postComment(pageToken, fbPostId, req.body.autoComment);
                            }

                            await prisma.postLog.create({
                                data: {
                                    userId,
                                    pageId: accountId,
                                    fbPostId: fbPostId,
                                    type: tiktokUrl ? "tiktok" : "video",
                                    status: finalScheduleTime ? "scheduled" : "published",
                                    scheduledTime: finalScheduleTime || null,
                                    cloudinaryVideoId: videoPublicId
                                }
                            });
                            results.successCount++;
                            results.details.push({ accountId, status: "success", postId: fbPostId });
                        } else {
                            throw new Error(fbRes.details[0].error || "Failed to post video");
                        }

                    } catch (err) {
                        console.error(`❌ Failed for ${accountId}:`, err.message);
                        await prisma.postLog.create({
                            data: {
                                userId,
                                pageId: accountId,
                                type: tiktokUrl ? "tiktok" : "video",
                                status: "failed",
                                error: err.message,
                                cloudinaryVideoId: videoPublicId
                            }
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

