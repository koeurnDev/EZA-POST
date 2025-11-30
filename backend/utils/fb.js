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
      timeout: 600000, // ✅ Increased to 10 minutes for large files
      maxContentLength: 500 * 1024 * 1024, // 500MB
      maxBodyLength: Infinity,
      headers: { "User-Agent": "EZA_POST_BACKEND/1.0" },
    });
  }

  /* ------------------------------------------------------------ */
  /* ✅ Upload video to Facebook Page                              */
  /* ------------------------------------------------------------ */
  /* ------------------------------------------------------------ */
  /* ✅ Upload video to Facebook Page                              */
  /* ------------------------------------------------------------ */
  async uploadVideoToFacebook(accessToken, pageId, videoInput, caption, thumbnailBuffer = null, options = {}) {
    try {
      console.log(`📤 Uploading video to Facebook Page: ${pageId}`);

      const form = new FormData();
      form.append("access_token", accessToken);
      form.append("description", caption || "Shared via KR POST");

      if (options.title) {
        form.append("title", options.title); // ✅ Add Title
      }

      // Check if videoInput is a URL, Buffer, or Stream
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
      } else if (videoInput && typeof videoInput.pipe === 'function') {
        // ✅ It's a Stream (fs.createReadStream)
        console.log(`🌊 Using video Stream`);
        form.append("source", videoInput, {
          filename: `video_${Date.now()}.mp4`,
          contentType: "video/mp4",
        });
      } else {
        throw new Error("Invalid video input: Must be a URL string, Buffer, or Stream");
      }

      if (thumbnailBuffer) {
        // Handle Thumbnail (Buffer or Stream)
        if (Buffer.isBuffer(thumbnailBuffer)) {
          form.append("thumb", thumbnailBuffer, {
            filename: "thumb.jpg",
            contentType: "image/jpeg",
          });
        } else if (thumbnailBuffer && typeof thumbnailBuffer.pipe === 'function') {
          form.append("thumb", thumbnailBuffer, {
            filename: "thumb.jpg",
            contentType: "image/jpeg",
          });
        }
      }

      // 🕒 Scheduling & Publishing Logic
      if (options.hasOwnProperty('published')) {
        form.append("published", options.published.toString());
      }

      if (options.isScheduled && options.scheduleTime) {
        console.log(`📅 Scheduling for: ${new Date(options.scheduleTime * 1000).toISOString()}`);
        if (!options.hasOwnProperty('published')) form.append("published", "false");
        form.append("scheduled_publish_time", options.scheduleTime);
      }

      // ✅ Critical for fast processing
      // form.append("upload_phase", "finish"); // ❌ Removed: Causes (#194) error for non-resumable uploads

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
  /* ⏳ Poll Video Processing Status                              */
  /* ------------------------------------------------------------ */
  async waitForVideoProcessing(accessToken, videoId) {
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds max
    const delay = 2000; // 2 seconds

    while (attempts < maxAttempts) {
      try {
        const res = await this.http.get(`${this.graph}/${videoId}`, {
          params: {
            access_token: accessToken,
            fields: "status"
          }
        });

        const status = res.data.status;
        const videoStatus = status?.video_status;
        console.log(`⏳ Video ${videoId} status: ${videoStatus}`);

        if (videoStatus === 'ready') {
          console.log(`✅ Video ${videoId} is ready!`);
          return true;
        }

        if (videoStatus === 'error') {
          throw new Error("Video processing failed on Facebook side.");
        }

      } catch (err) {
        console.warn(`⚠️ Error checking video status: ${err.message}`);
      }

      await new Promise(r => setTimeout(r, delay));
      attempts++;
    }

    throw new Error("Video processing timed out.");
  }

  /* ------------------------------------------------------------ */
  /* ✅ Upload Video for Carousel (Container ID)                   */
  /* ------------------------------------------------------------ */
  async uploadVideoForCarousel(accessToken, pageId, videoInput, thumbnailInput = null) {
    try {
      console.log(`📤 Uploading video container for carousel: ${pageId}`);
      const form = new FormData();
      form.append("access_token", accessToken);

      // ✅ Support Direct File Upload (Stream/Buffer) OR URL
      if (typeof videoInput === 'string' && videoInput.startsWith('http')) {
        console.log(`🔗 Using video URL: ${videoInput}`);
        form.append("file_url", videoInput);
      } else {
        console.log(`🌊 Using video Stream/Buffer (Direct Upload)`);
        form.append("source", videoInput, {
          filename: `video_${Date.now()}.mp4`,
          contentType: "video/mp4",
        });
      }

      // ✅ Handle Thumbnail (Buffer or Stream)
      if (thumbnailInput) {
        console.log(`🖼️ Attaching thumbnail to video upload...`);
        if (Buffer.isBuffer(thumbnailInput)) {
          form.append("thumb", thumbnailInput, {
            filename: "thumb.jpg",
            contentType: "image/jpeg",
          });
        } else if (typeof thumbnailInput.pipe === 'function') {
          form.append("thumb", thumbnailInput, {
            filename: "thumb.jpg",
            contentType: "image/jpeg",
          });
        }
      }

      form.append("published", "false"); // CRITICAL: Draft mode

      const res = await this.http.post(`${this.graph}/${pageId}/videos`, form, {
        headers: form.getHeaders(),
      });

      const videoId = res.data.id;
      console.log(`✅ Video container created (ID: ${videoId}). Waiting for processing...`);

      // ⏳ Wait for processing to complete
      await this.waitForVideoProcessing(accessToken, videoId);

      return { success: true, id: videoId };
    } catch (error) {
      console.error("❌ Video container upload failed:", error.response?.data?.error || error.message);
      throw error;
    }
  }

  /* ------------------------------------------------------------ */
  /* ✅ Upload Photo for Carousel (Container ID)                   */
  /* ------------------------------------------------------------ */
  async uploadPhotoForCarousel(accessToken, pageId, photoInput) {
    try {
      console.log(`📤 Uploading photo container for carousel: ${pageId}`);
      const form = new FormData();
      form.append("access_token", accessToken);

      // ✅ Support Direct File Upload (Stream/Buffer) OR URL
      if (typeof photoInput === 'string' && photoInput.startsWith('http')) {
        console.log(`🔗 Using photo URL: ${photoInput}`);
        form.append("url", photoInput);
      } else {
        console.log(`🌊 Using photo Stream/Buffer (Direct Upload)`);
        form.append("source", photoInput, {
          filename: `photo_${Date.now()}.jpg`,
          contentType: "image/jpeg",
        });
      }

      form.append("published", "false"); // CRITICAL: Draft mode

      const res = await this.http.post(`${this.graph}/${pageId}/photos`, form, {
        headers: form.getHeaders(),
      });

      console.log(`✅ Photo container created (ID: ${res.data.id})`);

      // ⏳ Brief delay to allow Facebook to index the photo
      await new Promise(resolve => setTimeout(resolve, 2000));

      return { success: true, id: res.data.id };
    } catch (error) {
      console.error("❌ Photo container upload failed:", error.response?.data?.error || error.message);
      throw error;
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
  /* ✅ Create Attachment (For Mixed Media Carousel)               */
  /* ------------------------------------------------------------ */
  async createAttachment(accessToken, pageId, type, url, targetLink, headline, description, ctaType) {
    try {
      console.log(`📎 Creating ${type} attachment for Page ${pageId}...`);

      const payload = {
        access_token: accessToken,
        link: targetLink || "https://facebook.com",
        picture: url, // The media URL (Video or Image)
        name: headline,
        description: description,
        published: false
      };

      if (ctaType) {
        payload.call_to_action = {
          type: ctaType,
          value: { link: targetLink || "https://facebook.com" }
        };
      }

      // If it's a video, we might need to ensure it's treated as such, 
      // but the /links endpoint often auto-detects or treats 'picture' as the media source.
      // For explicit video support in carousels, sometimes 'source' is used instead of 'picture' for videos,
      // but the user request specifies 'picture' for Image and 'source' for Video in the prompt description?
      // WAIT: The user prompt says:
      // Video: source (CRITICAL: Use the $CLOUDINARY_VIDEO_URL)
      // Image: picture ($CLOUDINARY_IMAGE_URL)

      if (type === 'video') {
        delete payload.picture;
        payload.source = url;
      }

      const res = await this.http.post(`${this.graph}/${pageId}/links`, payload);

      console.log(`✅ Attachment created (ID: ${res.data.id})`);
      return { success: true, id: res.data.id };

    } catch (error) {
      console.error(`❌ Create Attachment failed:`, error.response?.data?.error || error.message);
      return { success: false, error: error.message };
    }
  }

  /* ------------------------------------------------------------ */
  /* ✅ Post Carousel (Mixed Media Support)                        */
  /* ------------------------------------------------------------ */
  async postCarousel(accessToken, accounts, caption, cards, options = {}) {
    const results = { successCount: 0, failedCount: 0, details: [] };

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return results;
    }

    // Check if cards are already attachment IDs (strings) or objects
    // If they are objects, we might need to create attachments first (handled in controller)
    // But let's assume the controller passes the constructed child_attachments array if it did the work.
    // OR we can make this flexible.

    // Actually, the controller will likely pass the ready-to-use child_attachments array 
    // OR we update this method to just take the payload.

    // Let's keep it simple: The controller will do the heavy lifting of creating attachments 
    // and passing the final `child_attachments` array structure to a generic feed poster?
    // OR we update this method to handle the final step.

    // Let's assume 'cards' here is the `child_attachments` array if it's already processed.
    // But to maintain backward compatibility or clarity, let's check.

    let childAttachments = cards;

    // If cards contains raw data (not attachment IDs), we might be in legacy mode or need to process.
    // But for this specific workflow, the controller will likely pass the constructed array of IDs.
    // Let's assume the controller passes the *final* child_attachments array.

    for (const account of accounts) {
      try {
        console.log(`🚀 Posting Carousel to ${account.name}...`);

        // 🔍 Debug: Log Payload
        console.log("📦 Carousel Payload (child_attachments):", JSON.stringify(childAttachments, null, 2));

        const payload = {
          child_attachments: childAttachments,
          access_token: account.access_token || accessToken,
          // ✅ Fix (#194): Top-level link is required for carousel posts
          link: childAttachments[0]?.link || "https://facebook.com"
        };

        if (caption && caption.trim().length > 0) {
          payload.message = caption;
        }

        if (options.isScheduled && options.scheduleTime) {
          payload.published = false;
          payload.scheduled_publish_time = options.scheduleTime;
        } else {
          // ✅ CRITICAL: Explicitly publish immediately if not scheduled
          payload.published = true;
        }

        const res = await this.http.post(`${this.graph}/${account.id}/feed`, payload);

        results.successCount++;
        results.details.push({
          accountId: account.id,
          type: account.type,
          status: "success",
          postId: res.data.id
        });
        console.log(`✅ Carousel posted to ${account.name || account.id} (ID: ${res.data.id})`);

      } catch (err) {
        const parsed = this.handleFacebookError(err);
        results.failedCount++;
        results.details.push({
          accountId: account.id,
          type: account.type,
          status: "failed",
          error: parsed.message
        });
        console.error(`❌ Carousel failed for ${account.name}:`, parsed.message);
      }
    }
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
  /* ✅ Post Comment                                               */
  /* ------------------------------------------------------------ */
  async postComment(accessToken, postId, message) {
    try {
      console.log(`💬 Posting comment to ${postId}...`);
      const res = await this.http.post(`${this.graph}/${postId}/comments`, {
        message: message,
        access_token: accessToken,
      });
      console.log(`✅ Comment posted (ID: ${res.data.id})`);
      return { success: true, commentId: res.data.id };
    } catch (error) {
      console.error(`❌ Comment failed for ${postId}:`, error.message);
      return { success: false, error: error.message };
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
