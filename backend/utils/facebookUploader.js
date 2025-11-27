// ============================================================
// ✅ Facebook Uploader Utility (EZA_POST FINAL v2)
// Handles all Facebook Graph API uploads, validations & analytics
// ============================================================

const axios = require("axios");

class FacebookUploader {
  constructor() {
    this.api = axios.create({
      baseURL: "https://graph.facebook.com/v19.0",
      timeout: 30000,
      headers: { "User-Agent": "EZA_POST_BACKEND/1.0" },
    });
  }

  // ------------------------------------------------------------
  // 🔐 Validate Facebook Access Token
  // ------------------------------------------------------------
  async validateAccessToken(accessToken) {
    try {
      const { data } = await this.api.get("/me", {
        params: { access_token: accessToken, fields: "id,name,email" },
      });
      console.log(`✅ Valid Facebook token for ${data.name}`);
      return { success: true, user: data };
    } catch (err) {
      const fbErr = err.response?.data?.error;
      console.error("❌ Token validation failed:", fbErr || err.message);
      return {
        success: false,
        error: fbErr?.message || "Token invalid or expired",
        code: fbErr?.code || "TOKEN_ERROR",
      };
    }
  }

  // ------------------------------------------------------------
  // 👥 Get Facebook Pages + Groups
  // ------------------------------------------------------------
  async getUserFacebookAccounts(accessToken) {
    try {
      console.log("📋 Fetching Facebook accounts...");

      const [pages, groups] = await Promise.all([
        this.api
          .get("/me/accounts", {
            params: {
              access_token: accessToken,
              fields: "id,name,category,access_token,picture{url},fan_count,link",
              limit: 100,
            },
          })
          .then((res) => res.data.data || []),
        this.api
          .get("/me/groups", {
            params: {
              access_token: accessToken,
              fields:
                "id,name,privacy,icon,cover{source},member_count,administrator",
              admin_only: true,
              limit: 100,
            },
          })
          .then((res) => res.data.data || []),
      ]);

      console.log(`✅ Found ${pages.length} pages & ${groups.length} groups`);

      return {
        success: true,
        pages: pages.map((p) => ({
          id: p.id,
          name: p.name,
          type: "page",
          category: p.category,
          picture: p.picture?.data?.url,
          access_token: p.access_token,
          fan_count: p.fan_count,
          link: p.link,
        })),
        groups: groups.map((g) => ({
          id: g.id,
          name: g.name,
          type: "group",
          privacy: g.privacy,
          cover: g.cover?.source,
          member_count: g.member_count,
          administrator: g.administrator,
        })),
      };
    } catch (err) {
      const fbErr = err.response?.data?.error;
      console.error("❌ Failed to fetch accounts:", fbErr || err.message);
      return {
        success: false,
        error: fbErr?.message || "Failed to fetch accounts",
      };
    }
  }

  // ------------------------------------------------------------
  // 🎬 Upload Video (as link or message) to Page Feed
  // ------------------------------------------------------------
  async uploadVideoToPage(pageToken, pageId, { videoUrl, caption, thumbnail }) {
    try {
      const payload = {
        access_token: pageToken,
        message: caption || "Check out this post!",
        link: videoUrl,
      };
      if (thumbnail) payload.picture = thumbnail;

      const { data } = await this.api.post(`/${pageId}/feed`, payload);
      console.log(`✅ Posted to Page ${pageId}: ${data.id}`);
      return { success: true, postId: data.id, accountId: pageId };
    } catch (err) {
      const fbErr = err.response?.data?.error;
      console.error(`❌ Page post failed (${pageId}):`, fbErr || err.message);
      return { success: false, error: fbErr?.message || err.message, accountId: pageId };
    }
  }

  // ------------------------------------------------------------
  // 👥 Post to Facebook Group
  // ------------------------------------------------------------
  async postToGroup(userToken, groupId, { message, link, picture }) {
    try {
      const { data } = await this.api.post(`/${groupId}/feed`, {
        message,
        link,
        picture,
        access_token: userToken,
      });
      console.log(`✅ Posted to Group ${groupId}: ${data.id}`);
      return { success: true, postId: data.id, accountId: groupId };
    } catch (err) {
      const fbErr = err.response?.data?.error;
      console.error(`❌ Group post failed (${groupId}):`, fbErr || err.message);
      return { success: false, error: fbErr?.message || err.message, accountId: groupId };
    }
  }

  // ------------------------------------------------------------
  // 🚀 Upload to Multiple Facebook Accounts (with retry)
  // ------------------------------------------------------------
  async uploadToFacebook(userToken, accounts, videoData) {
    const results = { successCount: 0, failedCount: 0, details: [] };

    for (const acc of accounts) {
      let attempt = 0;
      let uploaded = false;
      let result = null;

      while (!uploaded && attempt < 3) {
        attempt++;
        try {
          result =
            acc.type === "page"
              ? await this.uploadVideoToPage(acc.access_token, acc.id, videoData)
              : await this.postToGroup(userToken, acc.id, {
                message: videoData.caption,
                link: videoData.videoUrl,
                picture: videoData.thumbnail,
              });

          uploaded = result.success;
          break;
        } catch (err) {
          console.warn(`⚠️ Retry #${attempt} for ${acc.id}`);
          await new Promise((r) => setTimeout(r, attempt * 1000));
        }
      }

      results.details.push(result);
      result?.success ? results.successCount++ : results.failedCount++;
    }

    console.log(
      `📊 Upload summary: ✅ ${results.successCount}, ❌ ${results.failedCount}`
    );
    return results;
  }

  // ------------------------------------------------------------
  // ⏰ Schedule Page Post
  // ------------------------------------------------------------
  async schedulePost(pageToken, pageId, { caption, videoUrl }, scheduleTime) {
    try {
      const publishTime = Math.floor(new Date(scheduleTime).getTime() / 1000);
      const { data } = await this.api.post(`/${pageId}/feed`, {
        message: caption,
        link: videoUrl,
        scheduled_publish_time: publishTime,
        published: false,
        access_token: pageToken,
      });
      console.log(`⏰ Scheduled post for ${pageId} at ${scheduleTime}`);
      return { success: true, id: data.id, scheduleTime };
    } catch (err) {
      const fbErr = err.response?.data?.error;
      console.error("❌ Schedule failed:", fbErr || err.message);
      return { success: false, error: fbErr?.message || err.message };
    }
  }

  // ------------------------------------------------------------
  // 📊 Get Post Insights
  // ------------------------------------------------------------
  async getPostInsights(accessToken, postId) {
    try {
      const { data } = await this.api.get(`/${postId}/insights`, {
        params: {
          metric: "post_impressions,post_engaged_users,post_video_views",
          access_token: accessToken,
        },
      });
      return { success: true, insights: data?.data || [] };
    } catch (err) {
      console.error("❌ Get insights failed:", err.message);
      return { success: false, insights: [] };
    }
  }

  // ------------------------------------------------------------
  // 🗑️ Delete Facebook Post
  // ------------------------------------------------------------
  async deletePost(accessToken, postId) {
    try {
      await this.api.delete(`/${postId}`, {
        params: { access_token: accessToken },
      });
      console.log(`🗑️ Deleted post ${postId}`);
      return { success: true };
    } catch (err) {
      const fbErr = err.response?.data?.error;
      console.error("❌ Delete failed:", fbErr || err.message);
      return { success: false, error: fbErr?.message || err.message };
    }
  }

  // ------------------------------------------------------------
  // 🔎 Check Permissions
  // ------------------------------------------------------------
  async checkPermissions(accessToken) {
    const required = [
      "pages_manage_posts",
      "pages_read_engagement",
      "groups_access_member_info",
    ];

    try {
      const { data } = await this.api.get("/me/permissions", {
        params: { access_token: accessToken },
      });

      const granted = data.data || [];
      const missing = required.filter(
        (perm) =>
          !granted.some(
            (g) => g.permission === perm && g.status === "granted"
          )
      );

      return {
        success: true,
        hasAll: missing.length === 0,
        granted,
        missing,
      };
    } catch (err) {
      console.error("❌ Permission check failed:", err.message);
      return {
        success: false,
        hasAll: false,
        granted: [],
        missing: required,
      };
    }
  }
}

// ✅ Export Singleton Instance
const fbUploader = new FacebookUploader();

module.exports = {
  validateAccessToken: fbUploader.validateAccessToken.bind(fbUploader),
  getUserFacebookAccounts: fbUploader.getUserFacebookAccounts.bind(fbUploader),
  uploadToFacebook: fbUploader.uploadToFacebook.bind(fbUploader),
  schedulePost: fbUploader.schedulePost.bind(fbUploader),
  getPostInsights: fbUploader.getPostInsights.bind(fbUploader),
  deletePost: fbUploader.deletePost.bind(fbUploader),
  checkPermissions: fbUploader.checkPermissions.bind(fbUploader),
  FacebookUploader,
};
