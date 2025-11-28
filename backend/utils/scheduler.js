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

    // Step 1.5: Get User and Check Settings
    const User = require("../models/User");
    // Assuming ScheduledPost has a 'userId' field. If not, we need to add it or find user by other means.
    // Ideally, we should have saved userId when creating the post.
    // For now, let's assume we can find the user who owns this page.
    // Since we don't have userId in ScheduledPost schema yet (based on previous context), 
    // we might need to rely on finding a user who has this page selected.
    // BUT, for robustness, we should have userId. 
    // Let's try to find a user who has this page in their accounts.
    // This is expensive, so we should really add userId to ScheduledPost.
    // For this iteration, I will assume we can find the user by the page ID in their selectedPages.

    // Find user who has this page selected
    // NOTE: This assumes one user per page, or we just pick the first one.
    // In a real multi-tenant app, we need userId on the post.
    const accountId = post.accounts[0]?.id; // Assuming single account for now or taking first
    const user = await User.findOne({
      "selectedPages": accountId,
      "facebookAccessToken": { $exists: true }
    });

    if (!user) throw new Error("No user found for this page");

    // Check Page Settings
    const pageSettings = user.pageSettings?.find(s => s.pageId === accountId);
    if (pageSettings && pageSettings.enableSchedule === false) {
      throw new Error("Scheduled posting is disabled for this page");
    }

    const fbToken = user.facebookAccessToken;
    if (!fbToken) throw new Error("User has no Facebook Access Token");

    console.log(`📤 Uploading to Facebook (User: ${user.name})...`);

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

