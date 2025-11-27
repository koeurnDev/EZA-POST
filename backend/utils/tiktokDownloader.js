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
    this.client = axios.create({
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "keep-alive",
      },
    });

    this.tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
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
          (await this.downloadViaRapidAPI(videoUrl)) ||
          (await this.downloadViaThirdParty(videoUrl));

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
    const endpoints = [
      `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`,
      `https://api.tikmate.app/api/lookup?url=${encodeURIComponent(videoUrl)}`,
      `https://www.tiklydown.me/api/download?url=${encodeURIComponent(videoUrl)}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await this.client.get(endpoint);
        const data = res.data?.data || res.data;

        const dl =
          (noWatermark && (data.play || data.noWatermark || data.download_url)) ||
          data.wmplay ||
          data.play;
        if (!dl) continue;

        const vidRes = await this.client.get(dl, { responseType: "arraybuffer" });
        this.validateVideoBuffer(vidRes.data);

        console.log(`✅ API Proxy Success (${endpoint})`);
        return { buffer: vidRes.data, method: "api", filename: `tiktok_${Date.now()}.mp4` };
      } catch (err) {
        console.warn(`⚠️ ${endpoint.split("/")[2]} failed: ${err.message}`);
      }
    }
    return null;
  }

  /* ------------------------------------------------------------ */
  /* ✅ Method 2 — RapidAPI fallback                              */
  /* ------------------------------------------------------------ */
  async downloadViaRapidAPI(videoUrl) {
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
      if (!link) throw new Error("No valid video link");

      const vidRes = await this.client.get(link, { responseType: "arraybuffer" });
      this.validateVideoBuffer(vidRes.data);

      console.log("✅ Downloaded via RapidAPI");
      return { buffer: vidRes.data, method: "rapidapi" };
    } catch (err) {
      console.warn(`⚠️ RapidAPI failed: ${err.message}`);
      return null;
    }
  }

  /* ------------------------------------------------------------ */
  /* ✅ Method 3 — Third-party scraping fallback                  */
  /* ------------------------------------------------------------ */
  async downloadViaThirdParty(videoUrl) {
    const services = [
      {
        name: "snaptik",
        url: `https://snaptik.app/abc.php?url=${encodeURIComponent(videoUrl)}`,
        pattern: /href="([^"]*\.mp4)"/i,
      },
      {
        name: "ssstik",
        url: `https://ssstik.io/abc?url=${encodeURIComponent(videoUrl)}`,
        pattern: />Without watermark<\/a><a href="([^"]+)"/i,
      },
    ];

    for (const svc of services) {
      try {
        const res = await this.client.get(svc.url);
        const match = res.data.match(svc.pattern);
        if (!match) continue;

        const videoRes = await this.client.get(match[1], { responseType: "arraybuffer" });
        this.validateVideoBuffer(videoRes.data);

        console.log(`✅ Downloaded via ${svc.name}`);
        return { buffer: videoRes.data, method: svc.name };
      } catch (err) {
        console.warn(`${svc.name} failed: ${err.message}`);
      }
    }

    return null;
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
