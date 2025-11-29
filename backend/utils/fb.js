/**
 * =============================================================
 * 🌐 Facebook API Utility (EZA_POST FINAL v3)
 * ✅ Handles upload, TikTok integration, token validation & insights
 * =============================================================
 */

const axios = require("axios");
const FormData = require("form-data");
const { downloadTiktokVideo } = require("./tiktokDownloader");

class FacebookAPI {
  constructor() {
    this.graph = "https://graph.facebook.com/v19.0";
    this.http = axios.create({
      timeout: 90000, // Allow longer uploads (90s)
      maxContentLength: 100 * 1024 * 1024,
      maxBodyLength: Infinity,
      headers: { "User-Agent": "EZA_POST_BACKEND/1.0" },
    });
  }

  /* ------------------------------------------------------------ */
  /* ✅ Upload video to Facebook Page                              */
  /* ------------------------------------------------------------ */
  async uploadVideoToFacebook(accessToken, pageId, videoInput, caption, thumbnailBuffer = null, options = {}) {
    try {
      console.log(`📤 Uploading video to Facebook Page: ${pageId}`);

      const form = new FormData();
      form.append("access_token", accessToken);
      form.append("description", caption || "Shared via KR POST");

      // Check if videoInput is a URL or a Buffer
      if (typeof videoInput === 'string' && videoInput.startsWith('http')) {
        // It's a URL (Cloudinary)
        console.log(`🔗 Using video URL: ${videoInput}`);
        form.append("file_url", videoInput);
      } else if (Buffer.isBuffer(videoInput)) {
        // It's a Buffer (Local)
        if (videoInput.length < 1024) throw new Error("Invalid or empty video buffer");
        form.append("source", videoInput, {
          filename: `video_${Date.now()}.mp4`,
          contentType: "video/mp4",
        });
      } else {
        throw new Error("Invalid video input: Must be a URL string or a Buffer");
      }

      if (thumbnailBuffer) {
        form.append("thumb", thumbnailBuffer, {
          filename: "thumb.jpg",
          contentType: "image/jpeg",
        });
      }

      // 🕒 Scheduling Logic
      if (options.isScheduled && options.scheduleTime) {
        console.log(`📅 Scheduling for: ${new Date(options.scheduleTime * 1000).toISOString()}`);
        form.append("published", "false");
        form.append("scheduled_publish_time", options.scheduleTime);
      }

      // ✅ Critical for fast processing
      form.append("upload_phase", "finish");

      const res = await this.http.post(`${this.graph}/${pageId}/videos`, form, {
        headers: form.getHeaders(),
      });

      console.log(`✅ Video uploaded successfully (Post ID: ${res.data.id})`);
      return { success: true, postId: res.data.id, pageId };
    } catch (error) {
      const fbErr = error.response?.data?.error;
      console.error("❌ Facebook video upload failed:", fbErr || error.message);
      return {
        success: false,
        error: fbErr?.message || error.message,
        code: fbErr?.code || "UPLOAD_ERROR",
      };
    }
  }

  /* ------------------------------------------------------------ */
  /* ✅ Post video/link to multiple pages or groups                */
  /* ------------------------------------------------------------ */
  async postToFB(accessToken, accounts, videoInput, caption, thumbnail = null, options = {}) {
    const results = { successCount: 0, failedCount: 0, details: [] };

    if (!Array.isArray(accounts) || accounts.length === 0) {
      console.warn("⚠️ No Facebook accounts provided.");
      return results;
    }

    for (const account of accounts) {
      try {
        console.log(`🚀 Posting to ${account.name} (${account.type})...`);
        let postResult;

        if (account.type === "page") {
          if (videoInput) {
            // 🎥 Video/Image Post
            postResult = await this.uploadVideoToFacebook(
              account.access_token || accessToken,
              account.id,
              videoInput,
              caption,
              thumbnail?.buffer,
              options
            );
          } else if (options.link) {
            // 🔗 Link Post Fallback
            console.log(`🔗 Fallback: Posting link to Page ${account.name}...`);
            postResult = await this.shareAsLink(
              account.access_token || accessToken,
              account.id,
              caption,
              options.link,
              options // ✅ Pass options for scheduling
            );
          } else {
            postResult = { success: false, error: "No media or link provided for Page post" };
          }
        } else {
          // Groups
          if (options.isScheduled) {
            console.warn(`⚠️ Scheduling not supported for Groups (${account.name}). Skipping.`);
            postResult = { success: false, error: "Scheduling not supported for groups" };
          } else {
            const linkToShare = videoInput && typeof videoInput === 'string' ? videoInput : (options.link || "https://www.tiktok.com/");
            postResult = await this.shareAsLink(accessToken, account.id, caption, linkToShare);
          }
        }

        if (postResult.success) results.successCount++;
        else results.failedCount++;

        results.details.push({
          accountId: account.id,
          type: account.type,
          status: postResult.success ? "success" : "failed",
          postId: postResult.postId || null,
          error: postResult.error || null,
        });

        await new Promise((r) => setTimeout(r, 1500)); // prevent rate limit
      } catch (err) {
        const parsed = this.handleFacebookError(err);
        results.failedCount++;
        results.details.push({
          accountId: account.id,
          type: account.type,
          status: "failed",
          error: parsed.message,
          code: parsed.code,
        });
        if (parsed.retryable) await this.handleRateLimit();
      }
    }

    console.log(`📊 Summary → ✅ ${results.successCount}, ❌ ${results.failedCount}`);
    return results;
  }

  /* ------------------------------------------------------------ */
  /* ✅ Fallback: Share link (Pages & Groups)                      */
  /* ------------------------------------------------------------ */
  async shareAsLink(accessToken, targetId, caption, link, options = {}) {
    try {
      const payload = {
        message: caption,
        link: link,
        access_token: accessToken,
      };

      // 🕒 Scheduling Logic for Links
      if (options.isScheduled && options.scheduleTime) {
        console.log(`📅 Scheduling Link Post for: ${new Date(options.scheduleTime * 1000).toISOString()}`);
        payload.published = false;
        payload.scheduled_publish_time = options.scheduleTime;
      }

      const res = await this.http.post(`${this.graph}/${targetId}/feed`, payload);
      console.log(`✅ Shared link to ${targetId}`);
      return { success: true, postId: res.data.id };
    } catch (error) {
      const fbErr = error.response?.data?.error;
      console.error(`❌ Link share failed (${targetId}):`, fbErr?.message || error.message);
      return { success: false, error: fbErr?.message || error.message };
    }
  }

  /* ------------------------------------------------------------ */
  /* ✅ Get Pages                                                  */
  /* ------------------------------------------------------------ */
  async getFacebookPages(accessToken) {
    try {
      const res = await this.http.get(`${this.graph}/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: "id,name,category,access_token,picture{url},fan_count,link",
        },
      });

      const pages = res.data.data.map((p) => ({
        id: p.id,
        name: p.name,
        type: "page",
        category: p.category,
        access_token: p.access_token,
        picture: p.picture?.data?.url,
        fan_count: p.fan_count,
        link: p.link,
      }));

      console.log(`✅ Found ${pages.length} Facebook pages`);
      return pages;
    } catch (err) {
      console.error("❌ Failed to get pages:", err.message);
      return [];
    }
  }

  /* ------------------------------------------------------------ */
  /* ✅ Get Groups                                                 */
  /* ------------------------------------------------------------ */
  async getFacebookGroups(accessToken) {
    try {
      const res = await this.http.get(`${this.graph}/me/groups`, {
        params: {
          access_token: accessToken,
          fields: "id,name,privacy,icon,cover{source}",
          admin_only: true,
        },
      });

      const groups = res.data.data.map((g) => ({
        id: g.id,
        name: g.name,
        type: "group",
        privacy: g.privacy,
        cover: g.cover?.source,
      }));

      console.log(`✅ Found ${groups.length} Facebook groups`);
      return groups;
    } catch (err) {
      console.warn("⚠️ Could not fetch groups (missing permission)");
      return [];
    }
  }

  /* ------------------------------------------------------------ */
  /* ✅ Validate Access Token                                     */
  /* ------------------------------------------------------------ */
  async validateAccessToken(accessToken) {
    try {
      const res = await this.http.get(`${this.graph}/debug_token`, {
        params: {
          input_token: accessToken,
          access_token: `${process.env.FB_APP_ID}|${process.env.FB_APP_SECRET}`,
        },
      });

      const data = res.data.data;
      return {
        isValid: data.is_valid,
        userId: data.user_id,
        appId: data.app_id,
        expiresAt: new Date(data.expires_at * 1000),
        scopes: data.scopes,
      };
    } catch (err) {
      console.error("❌ Token validation failed:", err.message);
      return { isValid: false, error: err.message };
    }
  }

  /* ------------------------------------------------------------ */
  /* ✅ Get User Profile                                          */
  /* ------------------------------------------------------------ */
  async getUserProfile(accessToken) {
    try {
      const res = await this.http.get(`${this.graph}/me`, {
        params: { access_token: accessToken, fields: "id,name,email,picture{url}" },
      });
      return {
        id: res.data.id,
        name: res.data.name,
        email: res.data.email,
        avatar: res.data.picture?.data?.url,
      };
    } catch (err) {
      console.error("❌ Failed to fetch profile:", err.message);
      return null;
    }
  }

  /* ------------------------------------------------------------ */
  /* 🧠 Handle Facebook Error Mapping                             */
  /* ------------------------------------------------------------ */
  handleFacebookError(error) {
    const fbErr = error.response?.data?.error;
    if (!fbErr) return { message: error.message, code: "UNKNOWN", retryable: false };

    const retryableCodes = [4, 341];
    const codeMap = {
      10: "PERMISSION_DENIED",
      100: "INVALID_PARAM",
      190: "INVALID_TOKEN",
      200: "ACCESS_DENIED",
    };

    return {
      message: fbErr.message,
      code: codeMap[fbErr.code] || `FB_${fbErr.code}`,
      retryable: retryableCodes.includes(fbErr.code),
    };
  }

  /* ------------------------------------------------------------ */
  /* 🕒 Exponential Backoff Retry                                 */
  /* ------------------------------------------------------------ */
  async handleRateLimit(attempt = 1) {
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
    console.log(`⏳ Rate limit — retrying in ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
  }
}

// ✅ Singleton export
module.exports = new FacebookAPI();
module.exports.FacebookAPI = FacebookAPI;
