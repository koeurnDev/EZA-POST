/**
 * 🎥 postController.js — Handle post creation logic
 */

const fs = require("fs");
const path = require("path");
const prisma = require('../utils/prisma');
const { uploadFile } = require("../utils/cloudinary");
const fb = require("../utils/fb");
// Decryption helper local or imported if centralized
const { decrypt } = require("../utils/crypto");


const { postQueue } = require("../utils/queue");

exports.createPost = async (req, res) => {
    req.setTimeout(600000);
    try {
        const { title, caption, accounts, scheduleTime, tiktokUrl, videoUrl, postType, enableBot, staggerDelay, autoComment, aiOptions } = req.body;
        const userId = req.user?.id;

        if (postType === 'carousel') {
             // Delegation: Pass to carouselController
             const carouselController = require("./carouselController");
             return carouselController.createMixedCarousel(req, res);
        }

        // 🛑 Single Post Validation
        const videoFile = req.files?.find(f => f.fieldname === 'video');
        if (!videoFile && !tiktokUrl && !caption && !videoUrl)
            return res.status(400).json({ success: false, error: "No media, link, or caption provided" });

        let accountsArray = [];
        if (accounts) {
            try { accountsArray = JSON.parse(accounts); } catch {
                return res.status(400).json({ success: false, error: "Invalid accounts JSON" });
            }
        }

        // ✅ Auto-Select All Pages if accounts is missing
        if (!accountsArray || accountsArray.length === 0) {
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { connectedPages: true } });
            let connectedPages = user?.connectedPages;
            if (typeof connectedPages === 'string') try { connectedPages = JSON.parse(connectedPages) } catch (e) { }
            if (Array.isArray(connectedPages)) accountsArray = connectedPages.map(p => p.id);
        }

        // 🤖 Handle Auto-Reply Bot Activation
        if (enableBot === 'true' || enableBot === true) {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            let pageSettings = user.pageSettings || [];
            if (typeof pageSettings === 'string') try { pageSettings = JSON.parse(pageSettings) } catch(e) { pageSettings = [] }
            accountsArray.forEach(pageId => {
                const idx = pageSettings.findIndex(s => s.pageId === pageId);
                if (idx > -1) pageSettings[idx].enableBot = true;
                else pageSettings.push({ pageId, enableBot: true });
            });
            await prisma.user.update({ where: { id: userId }, data: { pageSettings } });
        }

        // 📦 Prepare Job Payload
        const thumbnailFile = req.files?.find(f => f.fieldname === 'thumbnail');

        const jobPayload = {
            type: 'single-post',
            userId,
            payload: {
                accountsArray,
                caption,
                title,
                scheduleTime,
                staggerDelay,
                videoUrl,
                videoFilePath: videoFile?.path || null,
                thumbnailFilePath: thumbnailFile?.path || null,
                aiOptions: aiOptions ? JSON.parse(aiOptions) : {},
                autoComment,
                tiktokUrl
            }
        };

        // 🚀 Add to Queue
        const job = await postQueue.add('process-single-post', jobPayload);

        console.log(`✅ [Queue] Single post job ${job.id} created for user ${userId}`);

        res.status(202).json({ 
            success: true, 
            message: "Single post added to queue",
            jobId: job.id 
        });

    } catch (err) {
        console.error("❌ Post Controller Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

