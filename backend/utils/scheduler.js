/**
 * 📅 TikTok → Facebook Scheduler Processor
 * Handles scheduled posting queue, retries, cleanup, and analytics
 */

const ScheduledPost = require("../models/ScheduledPost");
const { downloadTiktokVideo } = require("./tiktokDownloader");
const fb = require("./fb");
const { deleteFile, softDeleteAsset, deleteExpiredAssets } = require("./cloudinary"); // ✅ Import deleteFile

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

    // 📥 Handle Video Source
    let videoInput = post.video_url;

    // If it's a local file (legacy support or fallback), read it
    if (post.video_url.startsWith("/uploads")) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, "..", post.video_url);
      if (fs.existsSync(filePath)) {
        videoInput = fs.readFileSync(filePath);
        console.log(`📂 Loaded local video: ${post.video_url}`);
      } else {
        // If file missing, maybe it's a full URL?
        console.warn(`⚠️ Local file not found: ${post.video_url}. Trying as URL...`);
      }
    } else if (!post.video_url.startsWith("http")) {
      // If it's not local /uploads and not http, assume it's a TikTok URL that needs downloading?
      // But wait, create.js now saves Cloudinary URL.
      // If it is a TikTok URL that wasn't uploaded to Cloudinary (legacy?), we might need to download.
      // But for now, let's assume it's a URL we can pass to FB or a Cloudinary URL.
      console.log(`ℹ️ Using video URL: ${post.video_url}`);
    }

    // If it's a TikTok URL that needs downloading (legacy behavior where we didn't upload to Cloudinary first?)
    // The new create.js uploads to Cloudinary first, so video_url will be http...cloudinary...
    // So we can just pass videoInput (which is the URL) to fb.postToFB.

    // ... (User check logic) ...
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
      videoInput, // ✅ Pass URL or Buffer
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

    // 🏷️ Soft Delete Cloudinary Assets (1-Day Delay)
    if (post.video_url && post.video_url.includes("cloudinary.com")) {
      try {
        const matches = post.video_url.match(/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
        if (matches && matches[1]) {
          await softDeleteAsset(matches[1]);
        }
      } catch (e) {
        console.warn("Could not extract publicId for soft delete:", post.video_url);
      }
    }

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
    // 🧹 Run Hard Delete for Cloudinary Assets (Phase 2)
    await deleteExpiredAssets();

    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // 1. Find posts to delete first (to get file paths)
    const postsToDelete = await ScheduledPost.find({
      status: { $in: ["completed", "failed", "cancelled", "expired"] },
      updatedAt: { $lt: twoDaysAgo },
    });

    if (postsToDelete.length > 0) {
      console.log(`🧹 Found ${postsToDelete.length} posts to cleanup...`);

      for (const post of postsToDelete) {
        // Helper to extract Cloudinary Public ID
        const getPublicId = (url) => {
          if (!url || !url.includes("cloudinary.com")) return null;
          try {
            // Matches everything after 'upload/' (and optional version) up to extension
            const matches = url.match(/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
            return matches ? matches[1] : null;
          } catch (e) {
            return null;
          }
        };

        // Delete Video
        if (post.video_url) {
          const publicId = getPublicId(post.video_url);
          if (publicId) {
            await deleteFile(publicId, "video");
          }
        }

        // Delete Thumbnail
        if (post.thumbnail_url) {
          const publicId = getPublicId(post.thumbnail_url);
          if (publicId) {
            await deleteFile(publicId, "image");
          }
        }
      }

      // Now delete from DB
      const result = await ScheduledPost.deleteMany({
        _id: { $in: postsToDelete.map(p => p._id) }
      });

      console.log(`🧹 Cleaned ${result.deletedCount} old posts & Cloudinary files`);
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
