import { Hono } from "hono";
import { requireAuth } from "./auth.js";
import { proxyToBackend } from "../lib/proxy.js";

const tools = new Hono();
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const maxPageBytes = 2 * 1024 * 1024;
const maxMediaBytes = 100 * 1024 * 1024;
const pageHosts = new Set(["tiktok.com", "www.tiktok.com", "vt.tiktok.com", "vm.tiktok.com", "m.tiktok.com"]);
const mediaHostSuffixes = [
  ".tiktok.com",
  ".tiktokcdn.com",
  ".tiktokcdn-us.com",
  ".tiktokcdn-eu.com",
  ".tiktokv.com",
  ".byteoversea.com",
  ".byteoversea.net",
  ".byteicdn.com",
  ".bytevc.com",
  ".ibytedtos.com",
  ".muscdn.com",
  ".tikwm.com",
];

export function validateTikTokUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;

  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !pageHosts.has(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }

    if (!/^\/@[^/]+\/video\/\d+\/?$/.test(url.pathname)) return null;
    return url;
  } catch {
    return null;
  }
}

export function validateTikTokMediaUrl(value) {
  if (typeof value !== "string" || value.length > 8192) return null;

  try {
    const url = new URL(value);
    const allowedHost =
      mediaHostSuffixes.some((suffix) => url.hostname.endsWith(suffix)) ||
      url.hostname === "tiktok.com";
    if (
      url.protocol !== "https:" ||
      !allowedHost ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function createTikTokPreview(url) {
  const match = url.pathname.match(/^\/@([^/]+)\/video\/(\d+)\/?$/);
  if (!match) {
    throw new Error("Only canonical TikTok video URL paths are supported for preview");
  }

  const [, creator, id] = match;
  return {
    id,
    title: `TikTok video by @${creator}`,
    cover: "",
    type: "preview",
    embedUrl: `https://www.tiktok.com/player/v1/${id}`,
    web_url: url.href,
    author: { nickname: creator, unique_id: creator },
    stats: { plays: 0, likes: 0 },
  };
}

async function readBoundedText(response, limit) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("TikTok page has no response body");

  const decoder = new TextDecoder();
  let result = "";
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error("TikTok page exceeds the supported size limit");
    }
    result += decoder.decode(value, { stream: true });
  }
  return result + decoder.decode();
}

export function extractTikTokVideoData(html, expectedId) {
  const scripts = html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi);
  let data;
  for (const [, attributes, contents] of scripts) {
    if (
      !/\bid\s*=\s*["']__UNIVERSAL_DATA_FOR_REHYDRATION__["']/i.test(attributes)
    ) {
      continue;
    }
    try {
      data = JSON.parse(contents);
    } catch {
      throw new Error("TikTok video metadata could not be parsed");
    }
    break;
  }
  if (!data) throw new Error("TikTok page did not include public video metadata");

  const pending = [data];
  let nodesVisited = 0;
  while (pending.length && nodesVisited < 100_000) {
    const current = pending.pop();
    nodesVisited += 1;
    if (!current || typeof current !== "object") continue;

    const playAddr = current.playAddr || current.video?.playAddr;
    const downloadAddr = current.downloadAddr || current.video?.downloadAddr;
    const cover = current.cover || current.video?.cover || current.origin_cover;
    if (
      String(current.id ?? current.videoId ?? "") === expectedId &&
      (typeof playAddr === "string" || typeof downloadAddr === "string")
    ) {
      const mediaUrl =
        validateTikTokMediaUrl(playAddr) ??
        validateTikTokMediaUrl(downloadAddr);
      const nickname = current.author?.nickname || "";
      const uniqueId = current.author?.uniqueId || current.author?.unique_id || "";
      return {
        id: expectedId,
        title:
          typeof current.desc === "string" && current.desc.trim()
            ? current.desc.trim().slice(0, 300)
            : `TikTok video ${expectedId}`,
        cover:
          typeof cover === "string" && cover.startsWith("https://")
            ? cover
            : "",
        type: "video",
        embedUrl: `https://www.tiktok.com/player/v1/${expectedId}`,
        web_url: "",
        author: { nickname, unique_id: uniqueId },
        stats: {
          plays: Number(current.stats?.playCount || current.statsV2?.playCount || 0),
          likes: Number(current.stats?.diggCount || current.statsV2?.diggCount || 0),
        },
        mediaUrl,
      };
    }

    for (const value of Array.isArray(current) ? current : Object.values(current)) {
      pending.push(value);
    }
  }

  throw new Error("TikTok public metadata did not contain the requested video");
}

async function fetchTikTokPage(pageUrl) {
  let url = pageUrl;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      const nextUrl = location ? validateTikTokUrl(new URL(location, url).href) : null;
      if (!nextUrl || redirects === 3) {
        throw new Error("TikTok redirected to an unsupported page");
      }
      url = nextUrl;
      continue;
    }
    if (!response.ok) {
      const error = new Error(`TikTok page request failed with status ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error("TikTok returned an unexpected page format");
    }
    return readBoundedText(response, maxPageBytes);
  }
  throw new Error("TikTok page redirect limit exceeded");
}

export async function resolveTikTokUrl(input) {
  if (typeof input !== "string" || input.length > 2048) return null;
  const trimmed = input.trim();

  // First check if already canonical
  const canonical = validateTikTokUrl(trimmed);
  if (canonical) return canonical;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" || !pageHosts.has(parsed.hostname)) {
      return null;
    }

    // Follow redirect for short links (e.g. vt.tiktok.com, vm.tiktok.com)
    const res = await fetch(parsed.href, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(6_000),
    });

    if (res.url) {
      const resolved = validateTikTokUrl(res.url);
      if (resolved) return resolved;
    }
  } catch (err) {
    console.warn("TikTok URL redirect resolution failed:", err.message);
  }

  return null;
}

async function extractFromTikWM(url) {
  try {
    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(7_000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.code === 0 && json?.data) {
      return json.data;
    }
  } catch (err) {
    console.warn("TikWM lookup failed:", err.message);
  }
  return null;
}

async function extractFromOEmbed(url) {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function extractTikTokVideo(pageUrl, originalInputUrl) {
  const match = pageUrl.pathname.match(/^\/@[^/]+\/video\/(\d+)\/?$/);
  const videoId = match ? match[1] : "";
  const creator = match ? pageUrl.pathname.split("/")[1].slice(1) : "";
  const targetUrl = originalInputUrl || pageUrl.href;

  // 1. Try TikWM first (fastest, direct HD MP4 without watermark)
  const tikwm = await extractFromTikWM(targetUrl);
  if (tikwm) {
    const isSlideshow = Array.isArray(tikwm.images) && tikwm.images.length > 0;
    const resolvedId = String(tikwm.id || videoId);
    const authorName = tikwm.author?.nickname || creator || "TikTok User";
    const authorId = tikwm.author?.unique_id || creator || "user";
    const playMediaUrl = tikwm.play || tikwm.hdplay || null;

    return {
      id: resolvedId,
      title: tikwm.title || `TikTok video by @${authorId}`,
      cover: tikwm.origin_cover || tikwm.cover || "",
      type: isSlideshow ? "slideshow" : "video",
      embedUrl: `https://www.tiktok.com/player/v1/${resolvedId}`,
      web_url: pageUrl.href || targetUrl,
      author: {
        nickname: authorName,
        unique_id: authorId,
      },
      music: tikwm.music || null,
      stats: {
        plays: Number(tikwm.play_count || 0),
        likes: Number(tikwm.digg_count || 0),
      },
      images: tikwm.images || [],
      no_watermark_url: playMediaUrl,
      playUrl: playMediaUrl,
      downloadUrl: `/tools/tiktok/download?url=${encodeURIComponent(pageUrl.href || targetUrl)}&direct=${encodeURIComponent(playMediaUrl || "")}`,
    };
  }

  // 2. Fallback to native public-page extraction
  try {
    const html = await fetchTikTokPage(pageUrl);
    const video = extractTikTokVideoData(html, videoId);
    video.web_url = pageUrl.href;
    video.author = {
      nickname: creator,
      unique_id: creator,
    };
    video.downloadUrl = `/tools/tiktok/download?url=${encodeURIComponent(pageUrl.href)}`;
    delete video.mediaUrl;
    return video;
  } catch (nativeErr) {
    console.warn("Native TikTok page scraping failed, trying oEmbed fallback:", nativeErr?.message);
  }

  // 3. Fallback to oEmbed + Preview player
  const oembed = await extractFromOEmbed(pageUrl.href);
  const fallbackCreator = oembed?.author_name || creator || "user";
  return {
    id: videoId || String(oembed?.embed_product_id || ""),
    title: oembed?.title || `TikTok video by @${fallbackCreator}`,
    cover: oembed?.thumbnail_url || "",
    type: "preview",
    embedUrl: `https://www.tiktok.com/player/v1/${videoId || oembed?.embed_product_id}`,
    web_url: pageUrl.href,
    author: {
      nickname: fallbackCreator,
      unique_id: fallbackCreator,
    },
    stats: { plays: 0, likes: 0 },
    downloadUrl: `/tools/tiktok/download?url=${encodeURIComponent(pageUrl.href)}`,
  };
}

tools.post("/tiktok/lookup", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }

  const rawUrl = body?.url;
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return c.json({ success: false, error: "A canonical HTTPS TikTok video URL is required" }, 400);
  }

  let pageUrl = validateTikTokUrl(rawUrl.trim());
  if (!pageUrl) {
    pageUrl = await resolveTikTokUrl(rawUrl.trim());
  }

  if (!pageUrl) {
    const tikwm = await extractFromTikWM(rawUrl.trim());
    if (tikwm && tikwm.id) {
      const authorId = tikwm.author?.unique_id || "tiktok";
      try {
        pageUrl = new URL(`https://www.tiktok.com/@${authorId}/video/${tikwm.id}`);
      } catch {}
    }
  }

  if (!pageUrl) {
    return c.json({ success: false, error: "A canonical HTTPS TikTok video URL is required" }, 400);
  }

  try {
    const video = await extractTikTokVideo(pageUrl, rawUrl);
    return c.json({ success: true, video });
  } catch (error) {
    console.error("TikTok public video lookup failed:", {
      error: error instanceof Error ? error.message : "Unknown error",
      status: error?.status,
    });
    try {
      const preview = {
        ...createTikTokPreview(pageUrl),
        downloadUrl: `/tools/tiktok/download?url=${encodeURIComponent(pageUrl.href)}`,
      };
      return c.json({ success: true, video: preview });
    } catch {
      return c.json(
        { success: false, error: "TikTok's public video page is temporarily unavailable." },
        502
      );
    }
  }
});

tools.get("/tiktok/download", requireAuth, async (c) => {
  const rawUrl = c.req.query("url");
  const directUrl = c.req.query("direct");

  let pageUrl = validateTikTokUrl(rawUrl);
  if (!pageUrl && typeof rawUrl === "string") {
    pageUrl = await resolveTikTokUrl(rawUrl);
  }

  if (!pageUrl && !directUrl) {
    return c.json({ success: false, error: "A canonical HTTPS TikTok video URL is required" }, 400);
  }

  const videoId =
    pageUrl?.pathname?.match(/^\/@[^/]+\/video\/(\d+)\/?$/)?.[1] ||
    (typeof rawUrl === "string" ? rawUrl.match(/\/video\/(\d+)/)?.[1] : null) ||
    "video";

  try {
    let sourceUrl = null;

    if (directUrl) {
      sourceUrl = validateTikTokMediaUrl(directUrl);
    }

    if (!sourceUrl && (pageUrl || rawUrl)) {
      const target = pageUrl ? pageUrl.href : rawUrl;
      const tikwm = await extractFromTikWM(target);
      if (tikwm) {
        sourceUrl = validateTikTokMediaUrl(tikwm.play || tikwm.hdplay);
      }
    }

    if (!sourceUrl && pageUrl) {
      try {
        const html = await fetchTikTokPage(pageUrl);
        const match = pageUrl.pathname.match(/^\/@[^/]+\/video\/(\d+)\/?$/);
        if (match) {
          const extracted = extractTikTokVideoData(html, match[1]);
          sourceUrl = validateTikTokMediaUrl(extracted.mediaUrl);
        }
      } catch (nativeErr) {
        console.warn("Native download extraction failed:", nativeErr?.message);
      }
    }

    if (!sourceUrl) {
      return c.json(
        { success: false, error: "TikTok did not publish a supported media URL for this video." },
        502
      );
    }

    let url = sourceUrl;
    let upstream;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      upstream = await fetch(url, {
        headers: {
          Accept: "video/*,application/octet-stream",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: pageUrl ? pageUrl.href : "https://www.tiktok.com/",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(20_000),
      });
      if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get("Location");
        const nextUrl = location
          ? validateTikTokMediaUrl(new URL(location, url).href)
          : null;
        if (!nextUrl || redirects === 3) {
          return c.json({ success: false, error: "TikTok redirected to an unsupported media host." }, 502);
        }
        url = nextUrl;
        continue;
      }
      break;
    }

    if (upstream.status === 403) {
      return c.json(
        { success: false, error: "TikTok denied access to this video's media from the Worker." },
        502
      );
    }
    if (!upstream.ok || !upstream.body) {
      return c.json(
        { success: false, error: "TikTok's video media is temporarily unavailable." },
        502
      );
    }

    const contentType = upstream.headers.get("Content-Type") ?? "";
    if (
      !contentType.toLowerCase().startsWith("video/") &&
      !contentType.toLowerCase().includes("application/octet-stream")
    ) {
      return c.json({ success: false, error: "TikTok returned an unsupported media format." }, 502);
    }
    const contentLength = Number(upstream.headers.get("Content-Length"));
    if (Number.isFinite(contentLength) && contentLength > maxMediaBytes) {
      return c.json({ success: false, error: "This video exceeds the 100 MiB download limit." }, 413);
    }

    let bytesSent = 0;
    const limitedBody = upstream.body.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          bytesSent += chunk.byteLength;
          if (bytesSent > maxMediaBytes) {
            controller.error(new Error("TikTok video exceeds the 100 MiB download limit"));
            return;
          }
          controller.enqueue(chunk);
        },
      })
    );
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="tiktok-${videoId}.mp4"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (upstream.headers.has("Content-Length")) {
      headers.set("Content-Length", upstream.headers.get("Content-Length"));
    }
    return new Response(limitedBody, { status: upstream.status, headers });
  } catch (error) {
    console.error("TikTok public video download failed:", {
      error: error instanceof Error ? error.message : "Unknown error",
      status: error?.status,
    });
    return c.json(
      { success: false, error: "TikTok's video media is temporarily unavailable." },
      502
    );
  }
});

// ============================================================
// 🌐 UNIVERSAL NATIVE EDGE STREAM PROXY
// ============================================================
async function streamEdgeMedia(c, rawTargetUrl, defaultFilename, defaultType = "video/mp4") {
  const targetUrl = rawTargetUrl || c.req.query("url");
  if (!targetUrl) {
    return c.json({ success: false, error: "Missing media stream URL" }, 400);
  }

  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return c.json({ success: false, error: "Invalid stream URL protocol" }, 400);
    }

    const upstream = await fetch(parsed.href, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "*/*",
        Range: c.req.header("range") || "bytes=0-",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
    });

    if (!upstream.ok && upstream.status !== 206) {
      return c.json({ success: false, error: "Upstream media source unavailable." }, 502);
    }

    const contentType = upstream.headers.get("Content-Type") || defaultType;
    const filename = c.req.query("filename") || defaultFilename || "media_file.mp4";

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    headers.set("Cache-Control", "public, max-age=3600");
    if (upstream.headers.has("Content-Length")) {
      headers.set("Content-Length", upstream.headers.get("Content-Length"));
    }
    if (upstream.headers.has("Content-Range")) {
      headers.set("Content-Range", upstream.headers.get("Content-Range"));
    }

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    console.error("Edge media stream error:", err);
    return c.json({ success: false, error: "Failed to stream media: " + err.message }, 502);
  }
}

// ============================================================
// 📘 1. FACEBOOK NATIVE EDGE DOWNLOADER
// ============================================================
async function extractFacebookEdge(rawUrl) {
  let targetUrl = String(rawUrl || "").trim();
  if (targetUrl.includes("fb.watch") || targetUrl.includes("fb.me")) {
    try {
      const red = await fetch(targetUrl, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": BROWSER_UA },
      });
      if (red.url) targetUrl = red.url;
    } catch {
      // continue
    }
  }

  const res = await fetch(targetUrl, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) throw new Error("Could not load Facebook page");
  const html = await res.text();

  const cleanSlash = (str) =>
    str ? str.replace(/\\u0025/g, "%").replace(/\\u0026/g, "&").replace(/\\/g, "") : null;

  const hdMatch =
    html.match(/"browser_native_hd_url":"([^"]+)"/) ||
    html.match(/"playable_url_quality_hd":"([^"]+)"/) ||
    html.match(/hd_src:"([^"]+)"/);

  const sdMatch =
    html.match(/"browser_native_sd_url":"([^"]+)"/) ||
    html.match(/"playable_url":"([^"]+)"/) ||
    html.match(/sd_src:"([^"]+)"/);

  const ogVid =
    html.match(/property=["']og:video(?::url)?["'] content=["']([^"']+)["']/i) ||
    html.match(/name=["']twitter:player:stream["'] content=["']([^"']+)["']/i);

  const ogImg =
    html.match(/property=["']og:image["'] content=["']([^"']+)["']/i) ||
    html.match(/name=["']twitter:image["'] content=["']([^"']+)["']/i);

  const titleMatch =
    html.match(/property=["']og:title["'] content=["']([^"']+)["']/i) ||
    html.match(/<title>([^<]+)<\/title>/i);

  const videoUrl = cleanSlash(hdMatch?.[1] || sdMatch?.[1] || ogVid?.[1]);
  const imageUrl = cleanSlash(ogImg?.[1]);
  const title = (titleMatch?.[1] || "Facebook Content").replace(/\s*\|\s*Facebook$/i, "").trim();

  if (!videoUrl && !imageUrl) {
    throw new Error("Could not find public video or image on this Facebook link. Ensure post is Public.");
  }

  return {
    isVideo: Boolean(videoUrl),
    mediaUrl: videoUrl || imageUrl,
    title,
    thumbnail: imageUrl || videoUrl,
  };
}

tools.post("/facebook/download", async (c) => {
  if (c.env.BACKEND_ORIGIN) return proxyToBackend(c);

  const body = await c.req.json().catch(() => ({}));
  if (!body?.url) return c.json({ success: false, error: "Facebook URL is required" }, 400);

  try {
    const data = await extractFacebookEdge(body.url);
    const filename = `facebook-${Date.now()}.${data.isVideo ? "mp4" : "jpg"}`;
    const streamUrl = `/api/tools/facebook/stream?url=${encodeURIComponent(data.mediaUrl)}&filename=${filename}`;

    return c.json({
      success: true,
      url: streamUrl,
      video: {
        url: streamUrl,
        type: data.isVideo ? "video" : "image",
        is_video: data.isVideo,
      },
      meta: { title: data.title },
    });
  } catch (err) {
    return c.json({ success: false, error: err.message || "Failed to download Facebook media." }, 502);
  }
});

tools.post("/facebook/lookup", async (c) => {
  if (c.env.BACKEND_ORIGIN) return proxyToBackend(c);

  const body = await c.req.json().catch(() => ({}));
  if (!body?.url) return c.json({ success: false, error: "Facebook URL is required" }, 400);

  try {
    const data = await extractFacebookEdge(body.url);
    const filename = `facebook-${Date.now()}.${data.isVideo ? "mp4" : "jpg"}`;
    const streamUrl = `/api/tools/facebook/stream?url=${encodeURIComponent(data.mediaUrl)}&filename=${filename}`;

    return c.json({
      success: true,
      video: {
        title: data.title,
        thumbnail: data.thumbnail,
        url: streamUrl,
        type: data.isVideo ? "video" : "image",
        is_video: data.isVideo,
      },
    });
  } catch (err) {
    return c.json({ success: false, error: err.message || "Failed to find Facebook media." }, 502);
  }
});

tools.get("/facebook/stream", (c) => streamEdgeMedia(c, null, "facebook-video.mp4"));

// ============================================================
// 📸 2. INSTAGRAM NATIVE EDGE DOWNLOADER
// ============================================================
async function extractInstagramEdge(rawUrl) {
  const shortcodeMatch = String(rawUrl || "").match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  const shortcode = shortcodeMatch ? shortcodeMatch[1] : `ig-${Date.now()}`;

  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
  const res = await fetch(embedUrl, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(10_000),
  });

  const html = await res.text();
  const cleanSlash = (str) => (str ? str.replace(/\\u0026/g, "&").replace(/\\/g, "") : null);

  const videoMatch =
    html.match(/class=["']EmbeddedMediaImage["'][^>]*src=["']([^"']+)["']/i) ||
    html.match(/<video[^>]*src=["']([^"']+)["']/i) ||
    html.match(/"video_url":"([^"]+)"/);

  const ogImg =
    html.match(/property=["']og:image["'] content=["']([^"']+)["']/i) ||
    html.match(/"display_url":"([^"]+)"/);

  const titleMatch = html.match(/property=["']og:title["'] content=["']([^"']+)["']/i);

  const isVideo = html.includes("<video") || html.includes("video_url") || rawUrl.includes("/reel");
  const mediaUrl = cleanSlash(videoMatch?.[1] || ogImg?.[1]) || `https://www.instagram.com/p/${shortcode}/media/?size=l`;
  const title = titleMatch?.[1] || `Instagram Media ${shortcode}`;

  return { isVideo, mediaUrl, title, shortcode };
}

tools.post("/instagram/download", async (c) => {
  if (c.env.BACKEND_ORIGIN) return proxyToBackend(c);

  const body = await c.req.json().catch(() => ({}));
  if (!body?.url) return c.json({ success: false, error: "Instagram URL is required" }, 400);

  try {
    const data = await extractInstagramEdge(body.url);
    const filename = `instagram-${data.shortcode}.${data.isVideo ? "mp4" : "jpg"}`;
    const streamUrl = `/api/tools/instagram/stream?url=${encodeURIComponent(data.mediaUrl)}&filename=${filename}`;

    return c.json({
      success: true,
      url: streamUrl,
      meta: {
        title: data.title,
        type: data.isVideo ? "video" : "image",
      },
    });
  } catch (err) {
    return c.json({ success: false, error: err.message || "Failed to download Instagram media." }, 502);
  }
});

tools.post("/instagram/lookup", async (c) => {
  if (c.env.BACKEND_ORIGIN) return proxyToBackend(c);

  const body = await c.req.json().catch(() => ({}));
  if (!body?.url) return c.json({ success: false, error: "Instagram URL is required" }, 400);

  try {
    const data = await extractInstagramEdge(body.url);
    const filename = `instagram-${data.shortcode}.${data.isVideo ? "mp4" : "jpg"}`;
    const streamUrl = `/api/tools/instagram/stream?url=${encodeURIComponent(data.mediaUrl)}&filename=${filename}`;

    return c.json({
      success: true,
      video: {
        title: data.title,
        url: streamUrl,
        type: data.isVideo ? "video" : "image",
      },
    });
  } catch (err) {
    return c.json({ success: false, error: err.message || "Failed to find Instagram media." }, 502);
  }
});

tools.get("/instagram/stream", (c) => streamEdgeMedia(c, null, "instagram-media.mp4"));

// ============================================================
// 📌 3. PINTEREST NATIVE EDGE DOWNLOADER
// ============================================================
async function extractPinterestEdge(rawUrl) {
  let targetUrl = String(rawUrl || "").trim();
  if (targetUrl.includes("pin.it")) {
    try {
      const red = await fetch(targetUrl, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": BROWSER_UA },
      });
      if (red.url) targetUrl = red.url;
    } catch {
      // continue
    }
  }

  const res = await fetch(targetUrl, {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error("Could not access Pinterest link");
  const html = await res.text();

  const vidMatch =
    html.match(/(https:\/\/v\.pinimg\.com\/videos\/mc\/720p\/[^"'\s]+\.mp4)/i) ||
    html.match(/(https:\/\/v\.pinimg\.com\/videos\/[^"'\s]+\.mp4)/i) ||
    html.match(/property=["']og:video["'] content=["']([^"']+)["']/i);

  const imgMatches = html.match(/https:\/\/i\.pinimg\.com\/[^"'\s]+\.(?:jpg|png|webp)/gi) || [];
  let bestImg = imgMatches.find((u) => u.includes("/originals/"));
  if (!bestImg && imgMatches.length > 0) {
    bestImg = imgMatches[0].replace(/\/\d+x\//, "/originals/");
  }

  const titleMatch = html.match(/property=["']og:title["'] content=["']([^"']+)["']/i);
  const title = titleMatch?.[1] || "Pinterest Pin";

  const isVideo = Boolean(vidMatch);
  const mediaUrl = vidMatch ? vidMatch[1] : bestImg;

  if (!mediaUrl) throw new Error("Could not find media in this Pinterest Pin");

  return { isVideo, mediaUrl, title, thumbnail: bestImg || mediaUrl };
}

tools.post("/pinterest/download", async (c) => {
  if (c.env.BACKEND_ORIGIN) return proxyToBackend(c);

  const body = await c.req.json().catch(() => ({}));
  if (!body?.url) return c.json({ success: false, error: "Pinterest URL is required" }, 400);

  try {
    const data = await extractPinterestEdge(body.url);
    const filename = `pinterest-${Date.now()}.${data.isVideo ? "mp4" : "jpg"}`;
    const streamUrl = `/api/tools/pinterest/stream?url=${encodeURIComponent(data.mediaUrl)}&filename=${filename}`;

    return c.json({
      success: true,
      url: streamUrl,
      meta: {
        title: data.title,
        type: data.isVideo ? "video" : "image",
      },
    });
  } catch (err) {
    return c.json({ success: false, error: err.message || "Failed to download Pinterest media." }, 502);
  }
});

tools.post("/pinterest/lookup", async (c) => {
  if (c.env.BACKEND_ORIGIN) return proxyToBackend(c);

  const body = await c.req.json().catch(() => ({}));
  if (!body?.url) return c.json({ success: false, error: "Pinterest URL is required" }, 400);

  try {
    const data = await extractPinterestEdge(body.url);
    const filename = `pinterest-${Date.now()}.${data.isVideo ? "mp4" : "jpg"}`;
    const streamUrl = `/api/tools/pinterest/stream?url=${encodeURIComponent(data.mediaUrl)}&filename=${filename}`;

    return c.json({
      success: true,
      video: {
        title: data.title,
        url: streamUrl,
        type: data.isVideo ? "video" : "image",
      },
    });
  } catch (err) {
    return c.json({ success: false, error: err.message || "Failed to find Pinterest media." }, 502);
  }
});

tools.get("/pinterest/stream", (c) => streamEdgeMedia(c, null, "pinterest-media.jpg"));

// ============================================================
// 🎬 4. CAPCUT NATIVE EDGE DOWNLOADER
// ============================================================
async function extractCapCutEdge(rawUrl) {
  let targetUrl = String(rawUrl || "").trim();
  if (targetUrl.includes("/t/")) {
    try {
      const red = await fetch(targetUrl, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": BROWSER_UA },
      });
      if (red.url) targetUrl = red.url;
    } catch {
      // continue
    }
  }

  const res = await fetch(targetUrl, {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error("Could not access CapCut template");
  const html = await res.text();

  const vidMatch =
    html.match(/https:\/\/[^"'\s]+\.tiktokcdn\.com\/[^"'\s]+\.mp4/i) ||
    html.match(/https:\/\/[^"'\s]+\.byteoversea\.com\/[^"'\s]+\.mp4/i) ||
    html.match(/property=["']og:video["'] content=["']([^"']+)["']/i);

  const imgMatch =
    html.match(/property=["']og:image["'] content=["']([^"']+)["']/i) ||
    html.match(/https:\/\/[^"'\s]+\.tiktokcdn\.com\/[^"'\s]+\.(?:jpg|png|webp)/i);

  const titleMatch = html.match(/property=["']og:title["'] content=["']([^"']+)["']/i);
  const title = titleMatch?.[1] || "CapCut Template Video";

  if (!vidMatch && !imgMatch) {
    throw new Error("Could not locate template video. Ensure template is Public.");
  }

  return {
    isVideo: Boolean(vidMatch),
    mediaUrl: vidMatch ? vidMatch[0] : imgMatch[0],
    title,
    thumbnail: imgMatch ? imgMatch[0] : null,
  };
}

tools.post("/capcut/download", async (c) => {
  if (c.env.BACKEND_ORIGIN) return proxyToBackend(c);

  const body = await c.req.json().catch(() => ({}));
  if (!body?.url) return c.json({ success: false, error: "CapCut URL is required" }, 400);

  try {
    const data = await extractCapCutEdge(body.url);
    const filename = `capcut-${Date.now()}.${data.isVideo ? "mp4" : "jpg"}`;
    const streamUrl = `/api/tools/capcut/stream?url=${encodeURIComponent(data.mediaUrl)}&filename=${filename}`;

    return c.json({
      success: true,
      url: streamUrl,
      meta: {
        filename,
        title: data.title,
        type: data.isVideo ? "video" : "image",
      },
    });
  } catch (err) {
    return c.json({ success: false, error: err.message || "Failed to download CapCut media." }, 502);
  }
});

tools.post("/capcut/lookup", async (c) => {
  if (c.env.BACKEND_ORIGIN) return proxyToBackend(c);

  const body = await c.req.json().catch(() => ({}));
  if (!body?.url) return c.json({ success: false, error: "CapCut URL is required" }, 400);

  try {
    const data = await extractCapCutEdge(body.url);
    const filename = `capcut-${Date.now()}.${data.isVideo ? "mp4" : "jpg"}`;
    const streamUrl = `/api/tools/capcut/stream?url=${encodeURIComponent(data.mediaUrl)}&filename=${filename}`;

    return c.json({
      success: true,
      video: {
        title: data.title,
        url: streamUrl,
        type: data.isVideo ? "video" : "image",
      },
    });
  } catch (err) {
    return c.json({ success: false, error: err.message || "Failed to find CapCut media." }, 502);
  }
});

tools.get("/capcut/stream", (c) => streamEdgeMedia(c, null, "capcut-video.mp4"));

// ============================================================
// 🧵 5. THREADS NATIVE EDGE DOWNLOADER
// ============================================================
async function extractThreadsEdge(rawUrl) {
  const res = await fetch(String(rawUrl || "").trim(), {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error("Could not access Threads post");
  const html = await res.text();

  const vidMatch =
    html.match(/property=["']og:video(?::url)?["'] content=["']([^"']+)["']/i) ||
    html.match(/name=["']twitter:player:stream["'] content=["']([^"']+)["']/i);

  const imgMatch =
    html.match(/property=["']og:image["'] content=["']([^"']+)["']/i) ||
    html.match(/name=["']twitter:image["'] content=["']([^"']+)["']/i);

  const titleMatch =
    html.match(/property=["']og:description["'] content=["']([^"']+)["']/i) ||
    html.match(/property=["']og:title["'] content=["']([^"']+)["']/i);

  const title = titleMatch?.[1] || "Threads Post";
  const isVideo = Boolean(vidMatch);
  const mediaUrl = vidMatch ? vidMatch[1] : imgMatch?.[1];

  if (!mediaUrl) throw new Error("Could not find media in this Threads post");

  return { isVideo, mediaUrl, title, thumbnail: imgMatch?.[1] || null };
}

tools.post("/threads/lookup", async (c) => {
  if (c.env.BACKEND_ORIGIN) return proxyToBackend(c);

  const body = await c.req.json().catch(() => ({}));
  if (!body?.url) return c.json({ success: false, error: "Threads URL is required" }, 400);

  try {
    const data = await extractThreadsEdge(body.url);
    const filename = `threads-${Date.now()}.${data.isVideo ? "mp4" : "jpg"}`;
    const streamUrl = `/api/tools/threads/proxy?url=${encodeURIComponent(data.mediaUrl)}&filename=${filename}`;

    return c.json({
      success: true,
      video: {
        title: data.title,
        url: streamUrl,
        thumbnail: data.thumbnail,
        type: data.isVideo ? "video" : "image",
      },
      url: streamUrl,
    });
  } catch (err) {
    return c.json({ success: false, error: err.message || "Failed to find Threads media." }, 502);
  }
});

tools.post("/threads/download", async (c) => {
  if (c.env.BACKEND_ORIGIN) return proxyToBackend(c);

  const body = await c.req.json().catch(() => ({}));
  if (!body?.url) return c.json({ success: false, error: "Threads URL is required" }, 400);

  try {
    const data = await extractThreadsEdge(body.url);
    const filename = `threads-${Date.now()}.${data.isVideo ? "mp4" : "jpg"}`;
    const streamUrl = `/api/tools/threads/proxy?url=${encodeURIComponent(data.mediaUrl)}&filename=${filename}`;

    return c.json({
      success: true,
      url: streamUrl,
    });
  } catch (err) {
    return c.json({ success: false, error: err.message || "Failed to download Threads media." }, 502);
  }
});

tools.get("/threads/proxy", (c) => {
  if (c.env.BACKEND_ORIGIN) return proxyToBackend(c);
  return streamEdgeMedia(c, null, "threads-media.mp4");
});

// ============================================================
// 📺 6. YOUTUBE NATIVE EDGE DOWNLOADER
// ============================================================
async function extractYouTubeEdge(rawUrl) {
  const videoIdMatch = String(rawUrl || "").match(
    /(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (!videoIdMatch) throw new Error("Invalid YouTube Video URL");
  const videoId = videoIdMatch[1];

  let title = `YouTube Video ${videoId}`;
  let author = "YouTube Creator";
  let thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  try {
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (oembedRes.ok) {
      const data = await oembedRes.json();
      if (data.title) title = data.title;
      if (data.author_name) author = data.author_name;
      if (data.thumbnail_url) thumbnail = data.thumbnail_url;
    }
  } catch {
    // continue
  }

  return {
    id: videoId,
    title,
    author,
    thumbnail,
    resolutions: [1080, 720, 480, 360],
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
  };
}

tools.post("/youtube/lookup", async (c) => {
  if (c.env.BACKEND_ORIGIN) return proxyToBackend(c);

  const body = await c.req.json().catch(() => ({}));
  if (!body?.url) return c.json({ success: false, error: "YouTube URL is required" }, 400);

  try {
    const data = await extractYouTubeEdge(body.url);
    return c.json({
      success: true,
      video: data,
    });
  } catch (err) {
    return c.json({ success: false, error: err.message || "Failed to lookup YouTube video." }, 502);
  }
});

tools.post("/youtube/download", async (c) => {
  if (c.env.BACKEND_ORIGIN) return proxyToBackend(c);

  const body = await c.req.json().catch(() => ({}));
  if (!body?.url) return c.json({ success: false, error: "YouTube URL is required" }, 400);

  try {
    const data = await extractYouTubeEdge(body.url);
    const format = body.format === "mp3" ? "mp3" : "mp4";
    const filename = `${data.title.replace(/[^a-zA-Z0-9_\u1780-\u17FF]/g, "_").slice(0, 40)}.${format}`;
    const streamUrl = `/api/tools/youtube/stream?id=${data.id}&format=${format}&filename=${encodeURIComponent(filename)}`;

    return c.json({
      success: true,
      url: streamUrl,
    });
  } catch (err) {
    return c.json({ success: false, error: err.message || "Failed to start YouTube download." }, 502);
  }
});

tools.get("/youtube/stream", async (c) => {
  const videoId = c.req.query("id");
  const format = c.req.query("format") || "mp4";
  const filename = c.req.query("filename") || `youtube-${videoId}.${format}`;

  if (!videoId) return c.json({ success: false, error: "Video ID is required" }, 400);

  // Redirect to direct YouTube media delivery or client embed
  const ytFallbackUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return c.redirect(ytFallbackUrl, 302);
});

export default tools;
