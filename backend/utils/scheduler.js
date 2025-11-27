/**
 * 📅 TikTok → Facebook Scheduler Processor
 * Handles scheduled posting queue, retries, cleanup, and analytics
 */

const ScheduledPost = require("../models/ScheduledPost");
const { downloadTiktokVideo } = require("./tiktokDownloader");
const { uploadToFacebook } = require("./facebookUploader");

// ============================================================
// 🧠 Main Queue Processor
// ============================================================
exports.processScheduledPosts = async () => {
  try {
    // 1. Fetch posts ready to be processed
    const posts = await ScheduledPost.find({
      status: "scheduled",
      schedule_time: { $lte: new Date() },
    })
      .sort({ schedule_time: 1 })
      .limit(5);

    if (posts.length === 0) return;

    console.log(`🕒 Processing ${posts.length} scheduled posts...`);

    for (const post of posts) {
      await processSinglePost(post);
    }
  } catch (err) {
    console.error("❌ Scheduler error:", err.message);
  }
};

async function processSinglePost(post) {
  try {
    console.log(`🚀 Running post ${post.id}: ${post.caption?.slice(0, 60)}...`);

    // Mark as processing
    post.status = "processing";
    await post.save();

    let videoBuffer;
    if (post.video_url.startsWith("/uploads")) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, "..", post.video_url);
      if (fs.existsSync(filePath)) {
        videoBuffer = fs.readFileSync(filePath);
      } else {
        throw new Error("Video file not found on server");
      }
    } else {
      videoBuffer = await downloadTiktokVideo(post.video_url, {
        timeout: 60000,
        maxRetries: 3,
        noWatermark: true,
      });
    }

    if (!videoBuffer || videoBuffer.length < 1000)
      throw new Error("Download failed or empty video buffer");

    console.log(
      `✅ Video ready (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`
    );

    // Step 2️⃣ Upload to Facebook
    const fbToken = process.env.FB_ACCESS_TOKEN;
    if (!fbToken) throw new Error("No Facebook Access Token available");

    console.log(`📤 Uploading to Facebook...`);

    const results = await uploadToFacebook(
      fbToken,
      post.accounts,
      videoBuffer,
      post.caption
    );

    // Mark as completed
    post.status = "completed";
    post.posted_at = new Date();

    // Save published IDs
    if (results.details && results.details.length > 0) {
      post.publishedIds = results.details
        .filter(r => r.success && r.postId)
        .map(r => ({ accountId: r.accountId, postId: r.postId }));
    }

    await post.save();

    console.log(`✅ Published post ${post.id}`);

  } catch (error) {
    console.error(`❌ Post ${post.id} failed:`, error.message);

    // Retry logic
    post.status = "failed";
    post.attempts = (post.attempts || 0) + 1;
    await post.save();
  }
}

// ============================================================
// 🧹 Cleanup Old Posts (24 hours)
// ============================================================
exports.cleanupOldPosts = async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await ScheduledPost.deleteMany({
      status: { $in: ["completed", "failed"] },
      createdAt: { $lt: oneDayAgo },
    });

    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned ${result.deletedCount} old posts`);
    }
  } catch (err) {
    console.error("Cleanup error:", err.message);
  }
};

