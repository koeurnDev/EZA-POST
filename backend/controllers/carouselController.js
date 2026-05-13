/**
 * 🎠 carouselController.js — Handle Mixed Media Carousel (Video + Image)
 * ✅ Native Facebook Uploads (No Cloudinary)
 */

const fs = require("fs");
const path = require("path");
const prisma = require('../utils/prisma');
const fb = require("../utils/fb");
const axios = require("axios");
const { processVideo, extractThumbnail, processImage } = require("../services/videoProcessor");
const tiktokDownloader = require("../utils/tiktokDownloader");

const { postQueue } = require("../utils/queue");

exports.createMixedCarousel = async (req, res) => {
    req.setTimeout(600000);
    try {
        const { caption, accounts, scheduleTime, enableBot, videoUrl, carouselCards, aiOptions } = req.body;
        const userId = req.user?.id;

        if (!accounts) return res.status(400).json({ success: false, error: "Missing accounts" });

        let accountsArray = [];
        try {
            accountsArray = JSON.parse(accounts);
        } catch {
            return res.status(400).json({ success: false, error: "Invalid accounts JSON" });
        }

        // 🤖 Handle Auto-Reply Bot Activation (Update FacebookPage model directly)
        if (enableBot === 'true' || enableBot === true) {
            await prisma.facebookPage.updateMany({
                where: { 
                    id: { in: accountsArray },
                    userId: userId 
                },
                data: { enableBot: true }
            });
        }

        // 📦 Prepare Job Payload
        const videoFile = req.files?.find(f => f.fieldname === 'video');
        const thumbnailFile = req.files?.find(f => f.fieldname === 'thumbnail');
        const rightSideImageFile = req.files?.find(f => f.fieldname === 'rightSideImage');

        const jobPayload = {
            type: 'mixed-carousel',
            userId,
            payload: {
                accountsArray,
                caption,
                scheduleTime,
                videoUrl,
                videoFilePath: videoFile?.path || null,
                thumbnailFilePath: thumbnailFile?.path || null,
                rightSideImageFilePath: rightSideImageFile?.path || null,
                aiOptions: aiOptions ? JSON.parse(aiOptions) : {},
                carouselCards: carouselCards ? JSON.parse(carouselCards) : []
            }
        };

        // 🚀 Add to Queue (with Fallback for environments without Redis)
        try {
            const job = await postQueue.add('process-carousel', jobPayload);
            console.log(`✅ [Queue] Job ${job.id} created for user ${userId}`);

            res.status(202).json({ 
                success: true, 
                message: "Post added to queue for processing",
                jobId: job.id 
            });
        } catch (queueErr) {
            if (queueErr.message.includes('ECONNREFUSED') || queueErr.message.includes('Redis')) {
                console.warn("⚠️ [Fallback] Redis unreachable. Processing carousel synchronously...");
                
                // Process immediately (Synchronous)
                const postService = require("../services/postService");
                const results = await postService.processAndPostCarouselLogic({ userId, ...jobPayload.payload });

                res.json({ 
                    success: true, 
                    message: "Post processed successfully (Synchronous Fallback)",
                    results 
                });
            } else {
                throw queueErr; // Re-throw if it's a different error
            }
        }

    } catch (err) {
        console.error("❌ Carousel Controller Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

