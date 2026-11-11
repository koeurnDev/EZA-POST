const axios = require("axios");
const fs = require("fs");
const path = require("path");
const {
  isTikTokMediaUrl,
  isTikTokPageUrl,
} = require("./tiktokSource");

const maxVideoBytes = 100 * 1024 * 1024;
const maxRedirects = 5;

class TikTokDownloader {
  constructor() {
    this.userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    ];
    this.client = axios.create({ timeout: 30000, maxRedirects: 0 });
    this.tempDir = path.join(__dirname, "../temp");
    fs.mkdirSync(this.tempDir, { recursive: true });
  }

  getRandomHeaders() {
    return {
      "User-Agent": this.userAgents[Math.floor(Math.random() * this.userAgents.length)],
      Accept: "*/*",
      Referer: "https://www.tiktok.com/",
    };
  }

  async extractVideoId(value) {
    if (!isTikTokPageUrl(value)) throw new Error("Enter a valid HTTPS TikTok URL.");
    const parsed = new URL(value);
    const patterns = [
      /\/@[^/]+\/video\/(\d+)/,
      /\/v\/(\d+)/,
      /\/embed\/(\d+)/,
      /\/video\/(\d+)/,
    ];
    for (const pattern of patterns) {
      const match = parsed.pathname.match(pattern);
      if (match) return match[1];
    }

    if (["vm.tiktok.com", "vt.tiktok.com"].includes(parsed.hostname)) {
      const resolved = await this.resolveShortUrl(value);
      return this.extractVideoId(resolved);
    }
    throw new Error("Could not extract a TikTok video ID from this URL.");
  }

  async resolveShortUrl(shortUrl) {
    if (!isTikTokPageUrl(shortUrl)) throw new Error("Invalid TikTok short URL.");
    let currentUrl = shortUrl;

    for (let attempt = 0; attempt < maxRedirects; attempt++) {
      const response = await this.client.get(currentUrl, {
        responseType: "stream",
        validateStatus: (status) => status >= 200 && status < 400,
        headers: this.getRandomHeaders(),
      });
      response.data.destroy();
      if (response.status < 300) return currentUrl;

      const location = response.headers.location;
      if (!location) throw new Error("TikTok short URL has no redirect target.");
      const nextUrl = new URL(location, currentUrl).toString();
      if (!isTikTokPageUrl(nextUrl)) {
        throw new Error("TikTok short URL redirected outside TikTok.");
      }
      currentUrl = nextUrl;
    }
    throw new Error("TikTok short URL exceeded the redirect limit.");
  }

  async downloadTiktokVideo(videoUrl) {
    if (!isTikTokPageUrl(videoUrl)) throw new Error("Enter a valid HTTPS TikTok URL.");
    const result = await this.downloadViaYtDlp(videoUrl);
    if (!result?.buffer) throw new Error("The local TikTok extractor could not download this video.");
    this.validateVideoBuffer(result.buffer);
    return result;
  }

  async downloadViaYtDlp(videoUrl) {
    if (!isTikTokPageUrl(videoUrl)) throw new Error("Enter a valid HTTPS TikTok URL.");
    const youtubedl = require("./ytdlp");
    const output = await youtubedl(videoUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noPlaylist: true,
      maxFilesize: "100M",
    });

    if (!isTikTokMediaUrl(output.url)) {
      throw new Error("The local extractor returned an unsupported media URL.");
    }
    const buffer = await this.downloadMedia(output.url);
    return {
      buffer,
      method: "yt-dlp",
      filename: `tiktok_${Date.now()}.mp4`,
    };
  }

  async downloadMedia(mediaUrl) {
    let currentUrl = mediaUrl;
    for (let attempt = 0; attempt <= maxRedirects; attempt++) {
      if (!isTikTokMediaUrl(currentUrl)) {
        throw new Error("TikTok media redirected to an unsupported host.");
      }

      const response = await this.client.get(currentUrl, {
        responseType: "stream",
        validateStatus: (status) => status >= 200 && status < 400,
        maxContentLength: maxVideoBytes,
        headers: this.getRandomHeaders(),
      });
      if (response.status >= 300) {
        response.data.destroy();
        const location = response.headers.location;
        if (!location) throw new Error("TikTok media redirect has no location.");
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      const declaredSize = Number(response.headers["content-length"]);
      if (Number.isFinite(declaredSize) && declaredSize > maxVideoBytes) {
        response.data.destroy();
        throw new Error("TikTok video exceeds the 100 MiB download limit.");
      }

      const chunks = [];
      let totalBytes = 0;
      for await (const chunk of response.data) {
        totalBytes += chunk.length;
        if (totalBytes > maxVideoBytes) {
          response.data.destroy();
          throw new Error("TikTok video exceeds the 100 MiB download limit.");
        }
        chunks.push(chunk);
      }
      return Buffer.concat(chunks, totalBytes);
    }
    throw new Error("TikTok media exceeded the redirect limit.");
  }

  async getPlayableUrl(videoUrl) {
    if (!isTikTokPageUrl(videoUrl)) throw new Error("Enter a valid HTTPS TikTok URL.");
    const youtubedl = require("./ytdlp");
    const output = await youtubedl(videoUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noPlaylist: true,
    });
    if (!isTikTokMediaUrl(output.url)) {
      throw new Error("The local extractor returned an unsupported media URL.");
    }
    return output.url;
  }

  validateVideoBuffer(data) {
    const length = Buffer.isBuffer(data) ? data.length : 0;
    if (length < 1024 || length > maxVideoBytes) {
      throw new Error("Downloaded TikTok video is empty or exceeds the 100 MiB limit.");
    }
  }

  async getVideoMetadata(videoUrl) {
    if (!isTikTokPageUrl(videoUrl)) throw new Error("Enter a valid HTTPS TikTok URL.");
    const youtubedl = require("youtube-dl-exec");
    const bundledBinary = path.join(__dirname, "../bin/yt-dlp");
    const execPath = process.env.NODE_ENV === "production" && fs.existsSync(bundledBinary)
      ? bundledBinary
      : undefined;
    const output = await youtubedl(videoUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noPlaylist: true,
      skipDownload: true,
    }, { execPath });
    return {
      title: output.title || "TikTok Video",
      author: output.uploader || output.uploader_id || "Unknown",
      description: output.description || "",
      thumbnail: output.thumbnail || "",
      url: output.webpage_url || videoUrl,
    };
  }

  cleanupTempFiles(maxAge = 3600000) {
    const cutoff = Date.now() - maxAge;
    try {
      for (const file of fs.readdirSync(this.tempDir)) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile() && stats.mtimeMs < cutoff) fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error("TikTok temp cleanup failed:", error.message);
    }
  }
}

module.exports = new TikTokDownloader();
module.exports.TikTokDownloader = TikTokDownloader;
