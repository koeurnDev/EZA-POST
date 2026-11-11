/**
 * ============================================================
 * 🧹 pageCleanerService.js — Bulk Facebook Post Deletion Service
 * ============================================================
 * Enables fast 1-click bulk removal of published posts across
 * user pages using Meta Graph API v21.0 Batching (50 items/batch).
 */

const prisma = require("../utils/prisma");
const fb = require("../utils/fb");
const { decrypt } = require("../utils/crypto");

class PageCleanerService {
  /**
   * Get connected Facebook pages for a user
   */
  async getUserPages(userId) {
    const pages = await prisma.facebookPage.findMany({
      where: { userId, isConnected: true },
      select: {
        id: true,
        name: true,
        category: true,
        picture: true,
        followersCount: true,
        lastSync: true,
      },
    });
    return pages;
  }

  /**
   * Helper to retrieve decrypted Page Access Token for a specific user & page
   */
  async getDecryptedPageToken(userId, pageId) {
    const page = await prisma.facebookPage.findFirst({
      where: { id: pageId, userId },
    });

    if (!page) {
      throw new Error(`Page ${pageId} not found or not connected to this account`);
    }

    if (!page.accessToken) {
      throw new Error(`Page ${page.name} does not have a valid access token`);
    }

    return {
      page,
      token: decrypt(page.accessToken),
    };
  }

  /**
   * Fetch published posts with optional pagination & date filters
   */
  async getPagePosts(userId, pageId, options = {}) {
    const { token, page } = await this.getDecryptedPageToken(userId, pageId);

    const result = await fb.getPublishedPosts(pageId, token, options);
    if (!result.success) {
      throw new Error(result.error || "Failed to fetch posts from Facebook");
    }

    const rawPosts = result.data || [];
    const formatted = rawPosts.map((post) => {
      // Determine best thumbnail
      let thumbnail = post.full_picture || null;
      let mediaType = "status";

      if (post.attachments && post.attachments.data && post.attachments.data.length > 0) {
        const primary = post.attachments.data[0];
        mediaType = primary.type || "post";
        if (primary.media?.image?.src) {
          thumbnail = primary.media.image.src;
        }
      }

      return {
        id: post.id,
        message: post.message || post.story || "(No text caption)",
        created_time: post.created_time,
        thumbnail,
        mediaType,
        permalink_url: post.permalink_url || `https://facebook.com/${post.id}`,
        likes: post.reactions?.summary?.total_count ?? 0,
        comments: post.comments?.summary?.total_count ?? 0,
        shares: post.shares?.count ?? 0,
      };
    });

    return {
      page: {
        id: page.id,
        name: page.name,
        picture: page.picture,
      },
      posts: formatted,
      paging: result.paging,
    };
  }

  /**
   * Batch delete selected post IDs from the page
   */
  async batchDelete(userId, pageId, postIds = []) {
    if (!Array.isArray(postIds) || postIds.length === 0) {
      throw new Error("No post IDs provided for deletion");
    }

    // Safety limit per single invocation: up to 500 posts
    if (postIds.length > 500) {
      throw new Error("Maximum 500 posts can be deleted in a single batch operation");
    }

    const { token, page } = await this.getDecryptedPageToken(userId, pageId);

    console.log(
      `🗑️ PageCleaner: User ${userId} starting batch delete of ${postIds.length} posts on page "${page.name}" (${pageId})...`
    );

    const batchRes = await fb.batchDeletePosts(token, postIds);

    // Clean up local database records if tracked
    const successfulIds = batchRes.results
      .filter((r) => r.success)
      .map((r) => r.id);

    if (successfulIds.length > 0) {
      try {
        await prisma.postLog.updateMany({
          where: {
            userId,
            pageId,
            fbPostId: { in: successfulIds },
          },
          data: { status: "deleted" },
        });

        await prisma.postTarget.updateMany({
          where: {
            pageId,
            facebookPostId: { in: successfulIds },
          },
          data: { status: "cancelled", error: "Deleted by Page Cleaner" },
        });
      } catch (dbErr) {
        console.warn("⚠️ Failed to update local DB status after batch delete:", dbErr.message);
      }
    }

    return {
      success: true,
      pageId,
      pageName: page.name,
      total: postIds.length,
      deletedCount: batchRes.deletedCount,
      failedCount: batchRes.failedCount,
      results: batchRes.results,
    };
  }
}

module.exports = new PageCleanerService();

