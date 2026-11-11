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
        scheduleTime: { lte: new Date() },
      },
      orderBy: { scheduleTime: 'asc' },
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

    // 🛑 Check if this post was already scheduled or published on Meta Graph API
    let existingPublished = post.publishedIds;
    if (typeof existingPublished === 'string') {
      try { existingPublished = JSON.parse(existingPublished); } catch (e) { }
    }
    if (Array.isArray(existingPublished) && existingPublished.length > 0) {
      console.log(`⏩ Post ${post.id} already registered on Meta Graph API. Marking as published.`);
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "published", postedAt: new Date() }
      });
      return;
    }

    // Mark as processing
    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: { status: "processing" }
    });

    // 📥 Handle Video Source
    let videoInput = post.videoUrl;

    // 🎵 1.5. Check for Direct TikTok URL (Auto-Sync for Scheduled)
    if (post.videoUrl && post.videoUrl.includes("tiktok.com")) {
      try {
        console.log(`🕒 [Auto-Sync] Processing scheduled TikTok URL: ${post.videoUrl}`);
        const tiktokRes = await downloadTiktokVideo(post.videoUrl);
        if (tiktokRes && tiktokRes.buffer) {
          videoInput = tiktokRes.buffer;
          console.log(`✅ [Auto-Sync] TikTok video buffered for upload.`);
        }
      } catch (syncErr) {
        console.warn(`⚠️ [Auto-Sync] Could not buffer TikTok video: ${syncErr.message}. Falling back to URL.`);
      }
    }

    // If it's a local file (legacy support or fallback), read it
    if (post.videoUrl && post.videoUrl.startsWith("/uploads")) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, "..", post.videoUrl);
      if (fs.existsSync(filePath)) {
        videoInput = fs.readFileSync(filePath);
        console.log(`📂 Loaded local video: ${post.videoUrl}`);
      } else {
        // If file missing, maybe it's a full URL?
        console.warn(`⚠️ Local file not found: ${post.videoUrl}. Trying as URL...`);
      }
    } else if (post.videoUrl && !post.videoUrl.startsWith("http")) {
      console.log(`ℹ️ Using video URL: ${post.videoUrl}`);
    }

    // ✅ Fix: Use user_id from the post record (Prisma model)
    const user = await prisma.user.findFirst({ where: { id: post.userId } });

    if (!user) throw new Error(`User not found (ID: ${post.userId})`);

    // Parse accounts safely (support string, JSON string, or array)
    let accountsList = post.accounts;
    if (typeof accountsList === 'string') {
      try { accountsList = JSON.parse(accountsList); } catch (e) { accountsList = [post.accounts]; }
    }
    if (!Array.isArray(accountsList)) accountsList = [];

    if (accountsList.length === 0) {
      throw new Error(`Scheduled post ${post.id} has no target accounts`);
    }

    // Parse pageSettings if stored as string (legacy)
    let pageSettings = user.pageSettings;
    if (typeof pageSettings === 'string') {
      try { pageSettings = JSON.parse(pageSettings); } catch (e) { }
    }
    if (!Array.isArray(pageSettings)) pageSettings = [];

    // 🔑 Resolve individual Page Access Tokens (Meta Graph API requires Page Token for posting)
    const accountObjects = [];
    for (const accId of accountsList) {
      const settings = pageSettings.find(s => s.pageId === accId);
      if (settings && settings.enableSchedule === false) {
        console.warn(`⏩ Scheduled posting is disabled for page ${accId}. Skipping.`);
        continue;
      }

      const page = await prisma.facebookPage.findFirst({
        where: { id: accId, userId: user.id }
      });

      if (page && page.accessToken) {
        const decryptedPageToken = decrypt(page.accessToken);
        if (decryptedPageToken) {
          accountObjects.push({
            id: page.id,
            name: page.name,
            type: 'page',
            access_token: decryptedPageToken
          });
        }
      }
    }

    if (accountObjects.length === 0) {
      throw new Error("No valid Facebook Pages with active tokens found for this scheduled post.");
    }

    console.log(`📤 Uploading scheduled post to ${accountObjects.length} pages for User ${user.name}...`);

    const results = await fb.postToFB(
      null, // Each account object has its own decrypted Page Access Token
      accountObjects,
      videoInput, // URL or Buffer
      post.caption
    );

    // Save published IDs & update PostTarget records
    let publishedIds = [];
    if (results.details && results.details.length > 0) {
      for (const r of results.details) {
        if (r.status === 'success' && r.postId) {
          publishedIds.push({ accountId: r.accountId, postId: r.postId });
        }
        try {
          await prisma.postTarget.updateMany({
            where: { scheduledPostId: post.id, pageId: r.accountId },
            data: {
              status: r.status === 'success' ? 'published' : 'failed',
              facebookPostId: r.postId || null,
              postedAt: r.status === 'success' ? new Date() : null,
              error: r.error || null
            }
          });
        } catch (targetErr) {
          console.warn("Could not update postTarget status:", targetErr.message);
        }
      }
    }

    // Mark as published
    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: {
        status: "published",
        postedAt: new Date(),
        publishedIds: publishedIds
      }
    });

    console.log(`✅ Published post ${post.id}`);

    // 🏷️ Soft Delete Cloudinary Assets (1-Day Delay)
    if (post.videoUrl && post.videoUrl.includes("cloudinary.com")) {
      try {
        const matches = post.videoUrl.match(/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
        if (matches && matches[1]) {
          await softDeleteAsset(matches[1]);
        }
      } catch (e) {
        console.warn("Could not extract publicId for soft delete:", post.videoUrl);
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
    // 🧹 Run Hard Delete for Cloudinary Assets (Phase 2 - only if Cloudinary is configured)
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      await deleteExpiredAssets();
    }

    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // 1. Find posts to delete first (to get file paths)
    const postsToDelete = await prisma.scheduledPost.findMany({
      where: {
        status: { in: ["published", "failed", "cancelled", "expired"] },
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
        if (post.videoUrl) {
          const publicId = getPublicId(post.videoUrl);
          if (publicId) await deleteFile(publicId, "video");
        }

        // Delete Thumbnail
        if (post.thumbnailUrl) {
          const publicId = getPublicId(post.thumbnailUrl);
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
        scheduleTime: { lt: twoDaysAgo },
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
