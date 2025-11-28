/**
 * 📅 TikTok → Facebook Scheduler Processor
 * Handles scheduled posting queue, retries, cleanup, and analytics
 */

const ScheduledPost = require("../models/ScheduledPost");
const { downloadTiktokVideo } = require("./tiktokDownloader");
const fb = require("./fb");

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

    // ✅ Fix: Use user_id from the post record
    const user = await User.findOne({ id: post.user_id });

    if (!user) throw new Error(`User not found (ID: ${post.user_id})`);

    // Check Page Settings (Check first account for now)
    const accountId = post.accounts[0];

    const pageSettings = user.pageSettings?.find(s => s.pageId === accountId);
    if (pageSettings && pageSettings.enableSchedule === false) {
      throw new Error("Scheduled posting is disabled for this page");
    }

    const fbToken = user.getDecryptedAccessToken();
    if (!fbToken) throw new Error("User has no Facebook Access Token");

    console.log(`📤 Uploading to Facebook (User: ${user.name})...`);

    // Convert string IDs to objects for uploader
    const accountObjects = post.accounts.map(id => ({ id, type: 'page' }));

    const results = await fb.postToFB(
      fbToken,
      accountObjects,
      videoBuffer,
      post.caption
    );

    // Mark as completed
    post.status = "completed";
    post.posted_at = new Date();

    // Save published IDs
    if (results.details && results.details.length > 0) {
      post.publishedIds = results.details
        .filter(r => r.status === 'success' && r.postId)
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
// 🧹 Cleanup Old Posts (48 hours) & Mark Expired
// ============================================================
exports.cleanupOldPosts = async () => {
  try {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // 1. Find posts to delete first (to get file paths)
    const postsToDelete = await ScheduledPost.find({
      status: { $in: ["completed", "failed", "cancelled", "expired"] },
      updatedAt: { $lt: twoDaysAgo },
    });

    if (postsToDelete.length > 0) {
      const fs = require('fs');
      const path = require('path');

      for (const post of postsToDelete) {
        // Delete Video File
        if (post.video_url && post.video_url.startsWith("/uploads")) {
          const videoPath = path.join(__dirname, "..", post.video_url);
          if (fs.existsSync(videoPath)) {
            try {
              fs.unlinkSync(videoPath);
              console.log(`🗑️ Deleted video file: ${post.video_url}`);
            } catch (e) {
              console.error(`❌ Failed to delete video: ${post.video_url}`, e.message);
            }
          }
        }

        // Delete Thumbnail File
        if (post.thumbnail_url && post.thumbnail_url.startsWith("/uploads")) {
          const thumbPath = path.join(__dirname, "..", post.thumbnail_url);
          if (fs.existsSync(thumbPath)) {
            try {
              fs.unlinkSync(thumbPath);
              console.log(`🗑️ Deleted thumbnail file: ${post.thumbnail_url}`);
            } catch (e) {
              console.error(`❌ Failed to delete thumbnail: ${post.thumbnail_url}`, e.message);
            }
          }
        }
      }

      // Now delete from DB
      const result = await ScheduledPost.deleteMany({
        _id: { $in: postsToDelete.map(p => p._id) }
      });

      console.log(`🧹 Cleaned ${result.deletedCount} old posts & files`);
    }

    // 2. Mark "scheduled" posts as "expired" if they are past due by 48 hours
    // This handles cases where the scheduler might have missed them or they got stuck
    const expiredResult = await ScheduledPost.updateMany(
      {
        status: "scheduled",
        schedule_time: { $lt: twoDaysAgo },
      },
      {
        $set: { status: "expired" },
      }
    );

    if (expiredResult.modifiedCount > 0) {
      console.log(`⚠️ Marked ${expiredResult.modifiedCount} posts as expired`);
    }

  } catch (err) {
    console.error("Cleanup error:", err.message);
  }
};
