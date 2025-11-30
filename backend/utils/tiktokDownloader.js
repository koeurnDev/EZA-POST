/**
 * ==============================================================
 * 🎬 TikTok Downloader Utility (EZA_POST Final v3)
 * ✅ Downloads videos (no watermark) with multi-source fallback
 * ✅ Handles short URLs, validation, retries, and caching
 * ==============================================================
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");

class TikTokDownloader {
  constructor() {
    // ✅ User-Agent Rotation Pool
    this.userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ];

    this.client = axios.create({
      timeout: 30000,
      headers: this.getRandomHeaders(),
    });

    this.tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
  }

  /* ------------------------------------------------------------ */
  /* ✅ Get Random Headers (Anti-blocking)                        */
  /* ------------------------------------------------------------ */
  getRandomHeaders() {
    return {
      "User-Agent": this.userAgents[Math.floor(Math.random() * this.userAgents.length)],
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Cache-Control": "max-age=0"
    };
  }

  /* ------------------------------------------------------------ */
  /* ✅ Extract TikTok video ID                                   */
  /* ------------------------------------------------------------ */
  async extractVideoId(url) {
    const cleanUrl = url.trim().split("?")[0];
    const patterns = [
      /tiktok\.com\/@[^/]+\/video\/(\d+)/,
      /tiktok\.com\/v\/(\d+)/,
      /tiktok\.com\/embed\/(\d+)/,
      /video\/(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match && match[1]) return match[1];
    }

    if (url.includes("vm.tiktok.com") || url.includes("vt.tiktok.com")) {
      return await this.resolveShortUrl(url);
    }

    throw new Error("❌ Could not extract video ID from URL");
  }

  /* ------------------------------------------------------------ */
  /* ✅ Resolve shortened TikTok URLs                             */
  /* ------------------------------------------------------------ */
  async resolveShortUrl(shortUrl) {
    try {
      const res = await this.client.get(shortUrl, {
        maxRedirects: 0,
        validateStatus: (s) => s >= 300 && s < 400,
      });
      if (res.headers.location) return await this.extractVideoId(res.headers.location);
      throw new Error("Redirect not found");
    } catch (err) {
      throw new Error(`Short URL resolution failed: ${err.message}`);
    }
  }

  /* ------------------------------------------------------------ */
  /* ✅ Main download handler (with retries)                      */
  /* ------------------------------------------------------------ */
  async downloadTiktokVideo(videoUrl, options = {}) {
    const { maxRetries = 3, noWatermark = true } = options;
    let lastError;

    for (let i = 1; i <= maxRetries; i++) {
      console.log(`📥 [Attempt ${i}] Downloading: ${videoUrl}`);
      try {
        const result =
          (await this.downloadViaAPIProxy(videoUrl, noWatermark)) ||
          (await this.downloadViaRapidAPI(videoUrl));

        if (result?.buffer) return result.buffer;
        throw new Error("No valid result from any method");
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ Attempt ${i} failed: ${err.message}`);
        if (i < maxRetries) await this.sleep(2000 * i);
      }
    }

    throw new Error(`All methods failed: ${lastError?.message}`);
  }

  /* ------------------------------------------------------------ */
  /* ✅ Get Playable Video URL (for Preview)                      */
  /* ------------------------------------------------------------ */
  async getPlayableUrl(videoUrl) {
    // Method 1: API Proxy
    const endpoints = [
      `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`,
      `https://api.tikmate.app/api/lookup?url=${encodeURIComponent(videoUrl)}`,
      `https://www.tiklydown.me/api/download?url=${encodeURIComponent(videoUrl)}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await this.client.get(endpoint);
        const data = res.data?.data || res.data;
        const dl = (data.play || data.noWatermark || data.download_url) || data.wmplay;
        if (dl) return dl;
      } catch (err) {
        console.warn(`Preview check failed for ${endpoint}: ${err.message}`);
      }
    }

    // Method 2: RapidAPI
    try {
      const res = await this.client.get(
        `https://tiktok-video-no-watermark2.p.rapidapi.com/?url=${encodeURIComponent(videoUrl)}`,
        {
          headers: {
            "x-rapidapi-host": "tiktok-video-no-watermark2.p.rapidapi.com",
            "x-rapidapi-key": process.env.RAPIDAPI_KEY || "",
          },
        }
      );
      const link = res.data?.data?.play || res.data?.play;
      if (link) return link;
    } catch (err) {
      console.warn(`RapidAPI preview failed: ${err.message}`);
    }

    throw new Error("Could not resolve playable URL");
  }

  /* ------------------------------------------------------------ */
  /* ✅ Method 1 — TikWM / Tikmate API proxy                      */
  /* ------------------------------------------------------------ */
  async downloadViaAPIProxy(videoUrl, noWatermark = true) {
    // ✅ Updated endpoints (as of 2025)
    const endpoints = [
      `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}&hd=1`,
      `https://tikmate.app/api/lookup?url=${encodeURIComponent(videoUrl)}`,
      `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(videoUrl)}`,
      `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?url=${encodeURIComponent(videoUrl)}`
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`🔄 Trying endpoint: ${endpoint.split('?')[0]}...`);

        // ✅ Use fresh headers for each request
        const res = await axios.get(endpoint, {
          timeout: 30000,
          headers: this.getRandomHeaders(),
          validateStatus: (status) => status < 500 // Accept 4xx as valid for parsing
        });

        if (res.status >= 400) {
          console.warn(`⚠️ API returned ${res.status} for ${endpoint.split('/')[2]}`);
          continue;
        }

        const data = res.data?.data || res.data;

        if (!data) {
          console.warn(`⚠️ No data received from ${endpoint.split('/')[2]}`);
          continue;
        }

        // ✅ Try multiple possible video URL keys
        const dl =
          (noWatermark && (data.play || data.hdplay || data.noWatermark || data.download_url)) ||
          data.wmplay ||
          data.play;

        if (!dl) {
          console.warn(`⚠️ No download URL found in response from ${endpoint.split('/')[2]}`);
          console.log(`📋 Available keys:`, Object.keys(data));
          continue;
        }

        console.log(`🔗 Found download URL from ${endpoint.split('/')[2]}`);

        // ✅ Download video with fresh headers
        const vidRes = await axios.get(dl, {
          responseType: "arraybuffer",
          timeout: 60000, // 60s for video download
          headers: this.getRandomHeaders()
        });

        this.validateVideoBuffer(vidRes.data);

        console.log(`✅ API Proxy Success (${endpoint.split('/')[2]})`);
        return { buffer: vidRes.data, method: "api", filename: `tiktok_${Date.now()}.mp4` };
      } catch (err) {
        console.warn(`❌ ${endpoint.split('/')[2]} failed:`, err.message);
        if (err.response) {
          console.warn(`   Status: ${err.response.status}, Data:`, err.response.data);
        }
      }
    }
    return null;
  }

  /* ------------------------------------------------------------ */
  /* ✅ Method 2 — RapidAPI fallback                              */
  /* ------------------------------------------------------------ */
  async downloadViaRapidAPI(videoUrl) {
    try {
      const res = await axios.get(
        `https://tiktok-video-no-watermark2.p.rapidapi.com/?url=${encodeURIComponent(videoUrl)}`,
        {
          timeout: 30000,
          headers: {
            ...this.getRandomHeaders(),
            "x-rapidapi-host": "tiktok-video-no-watermark2.p.rapidapi.com",
            "x-rapidapi-key": process.env.RAPIDAPI_KEY || "",
          },
        }
      );

      const link = res.data?.data?.play || res.data?.play;
      if (!link) throw new Error("No valid video link");

      const vidRes = await axios.get(link, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: this.getRandomHeaders()
      });
      this.validateVideoBuffer(vidRes.data);

      console.log("✅ Downloaded via RapidAPI");
      return { buffer: vidRes.data, method: "rapidapi" };
    } catch (err) {
      console.warn(`⚠️ RapidAPI failed: ${err.message}`);
      return null;
    }
  }

  /* ------------------------------------------------------------ */
  /* 🧩 Validate binary data                                      */
  /* ------------------------------------------------------------ */
  validateVideoBuffer(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 1024)
      throw new Error("Invalid or empty video buffer");
  }

  /* ------------------------------------------------------------ */
  /* 🧠 Get TikTok Metadata (title, author)                       */
  /* ------------------------------------------------------------ */
  async getVideoMetadata(videoUrl) {
    try {
      const html = (await this.client.get(videoUrl)).data;
      const meta = (name) =>
        html.match(new RegExp(`<meta[^>]*property="${name}"[^>]*content="([^"]*)"`, "i"))?.[1];
      return {
        title: meta("og:title") || "TikTok Video",
        author: meta("og:video:actor") || "Unknown",
        description: meta("og:description") || "",
        url: videoUrl,
      };
    } catch {
      return { title: "Unknown", author: "N/A", description: "", url: videoUrl };
    }
  }

  /* ------------------------------------------------------------ */
  /* 🧹 Cleanup old files                                         */
  /* ------------------------------------------------------------ */
  cleanupTempFiles(maxAge = 3600000) {
    const cutoff = Date.now() - maxAge;
    try {
      const files = fs.readdirSync(this.tempDir);
      let cleaned = 0;
      for (const f of files) {
        const filePath = path.join(this.tempDir, f);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      }
      if (cleaned > 0) console.log(`🧹 Cleaned ${cleaned} old TikTok temp files`);
    } catch (err) {
      console.error("Cleanup error:", err.message);
    }
  }

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = new TikTokDownloader();
module.exports.TikTokDownloader = TikTokDownloader;
