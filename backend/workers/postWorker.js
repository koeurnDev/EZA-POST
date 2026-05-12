/**
 * 👷 postWorker.js — The background worker for EZA-POST
 * Handles heavy FFmpeg processing and Facebook API publishing.
 */

const { Worker } = require('bullmq');
const { connection } = require('../utils/queue');
const prisma = require('../utils/prisma');
const postService = require('../services/postService');

console.log("🚀 Post Worker is starting...");

const worker = new Worker('post-queue', async (job) => {
    const { type, payload, userId } = job.data;
    console.log(`📦 Processing job ${job.id} [Type: ${type}] for user ${userId}`);

    try {
        if (type === 'mixed-carousel') {
            // 🎠 Process Mixed Carousel using the Service
            console.log(`   👉 Task: Processing Carousel for ${payload.accountsArray.length} accounts`);
            
            const results = await postService.processAndPostCarouselLogic(
                { userId, ...payload },
                (percent) => job.updateProgress(percent) // ✅ Report progress to BullMQ
            );

            console.log(`   ✅ Job ${job.id} results:`, results.successCount, "success,", results.failedCount, "failed");
            return results;
        } else if (type === 'single-post') {
            // 🎥 Process Single Post using the Service
            console.log(`   👉 Task: Processing Single Post for ${payload.accountsArray.length} accounts`);

            const results = await postService.processSinglePostLogic(
                { userId, ...payload },
                (percent) => job.updateProgress(percent)
            );

            console.log(`   ✅ Job ${job.id} results:`, results.successCount, "success,", results.failedCount, "failed");
            return results;
        }

        return { success: true };
    } catch (err) {
        console.error(`❌ Job ${job.id} failed:`, err.message);
        throw err; 
    }
}, { 
    connection,
    concurrency: 2 // Allow 2 heavy tasks to run simultaneously per worker node
});

worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
    console.error(`💥 Job ${job.id} failed after retries:`, err.message);
});

module.exports = worker;
