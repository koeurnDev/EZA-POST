/**
 * 📅 TikTok → Facebook Scheduler Processor
 * Handles scheduled posting queue, retries, cleanup, and analytics
 */

const prisma = require("../utils/prisma");
const { downloadTiktokVideo } = require("./tiktokDownloader");
const fb = require("./fb");
const { deleteFile, softDeleteAsset, deleteExpiredAssets } = require("./cloudinary"); // ✅ Import deleteFile
const { decrypt } = require("./crypto");

// ============================================================
// 🧠 Main Queue Processor
// ============================================================
exports.processScheduledPosts = async () => {
  try {
    // 1. Fetch posts ready to be processed
    const posts = await prisma.scheduledPost.findMany({
      where: {
        status: "scheduled",
        schedule_time: { lte: new Date() },
      },
      orderBy: { schedule_time: 'asc' },
      take: 5
    });

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
    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: { status: "processing" }
    });

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
      console.log(`ℹ️ Using video URL: ${post.video_url}`);
    }

    // ✅ Fix: Use user_id from the post record (Prisma model)
    const user = await prisma.user.findFirst({ where: { id: post.user_id } });

    if (!user) throw new Error(`User not found (ID: ${post.user_id})`);

    // Check Page Settings
    const accountId = post.accounts[0]; // Assuming array of strings (legacy Mongoose pattern saved as array)

    // Parse pageSettings if stored as string (legacy)
    let pageSettings = user.pageSettings;
    if (typeof pageSettings === 'string') {
      try { pageSettings = JSON.parse(pageSettings); } catch (e) { }
    }
    if (!Array.isArray(pageSettings)) pageSettings = [];

    const settings = pageSettings.find(s => s.pageId === accountId);
    if (settings && settings.enableSchedule === false) {
      throw new Error("Scheduled posting is disabled for this page");
    }

    // Get Token
    const fbToken = decrypt(user.facebookAccessToken);
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

    // Save published IDs
    let publishedIds = [];
    if (results.details && results.details.length > 0) {
      publishedIds = results.details
        .filter(r => r.status === 'success' && r.postId)
        .map(r => ({ accountId: r.accountId, postId: r.postId }));
    }

    // Mark as completed
    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: {
        status: "completed",
        posted_at: new Date(),
        publishedIds: publishedIds // Prisma handles JSON if mapped correctly in schema or passed as object
      }
    });

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
    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: {
        status: "failed",
        attempts: (post.attempts || 0) + 1
      }
    });
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
    const postsToDelete = await prisma.scheduledPost.findMany({
      where: {
        status: { in: ["completed", "failed", "cancelled", "expired"] },
        updatedAt: { lt: twoDaysAgo },
      }
    });

    if (postsToDelete.length > 0) {
      console.log(`🧹 Found ${postsToDelete.length} posts to cleanup...`);

      for (const post of postsToDelete) {
        // Helper to extract Cloudinary Public ID
        const getPublicId = (url) => {
          if (!url || !url.includes("cloudinary.com")) return null;
          try {
            const matches = url.match(/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
            return matches ? matches[1] : null;
          } catch (e) {
            return null;
          }
        };

        // Delete Video
        if (post.video_url) {
          const publicId = getPublicId(post.video_url);
          if (publicId) await deleteFile(publicId, "video");
        }

        // Delete Thumbnail
        if (post.thumbnail_url) {
          const publicId = getPublicId(post.thumbnail_url);
          if (publicId) await deleteFile(publicId, "image");
        }
      }

      // Now delete from DB
      const result = await prisma.scheduledPost.deleteMany({
        where: {
          id: { in: postsToDelete.map(p => p.id) }
        }
      });

      console.log(`🧹 Cleaned ${result.count} old posts & Cloudinary files`);
    }

    // 2. Mark "scheduled" posts as "expired" if they are past due by 48 hours
    const expiredResult = await prisma.scheduledPost.updateMany({
      where: {
        status: "scheduled",
        schedule_time: { lt: twoDaysAgo },
      },
      data: { status: "expired" },
    });

    if (expiredResult.count > 0) {
      console.log(`⚠️ Marked ${expiredResult.count} posts as expired`);
    }

  } catch (err) {
    console.error("Cleanup error:", err.message);
  }
};
