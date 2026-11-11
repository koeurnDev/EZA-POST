import { Hono } from "hono";
import { requireAuth } from "./auth.js";

const tools = new Hono();
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

    if (
      String(current.id ?? current.videoId ?? "") === expectedId &&
      (typeof current.playAddr === "string" ||
        typeof current.downloadAddr === "string")
    ) {
      const mediaUrl =
        validateTikTokMediaUrl(current.playAddr) ??
        validateTikTokMediaUrl(current.downloadAddr);
      return {
        id: expectedId,
        title:
          typeof current.desc === "string" && current.desc.trim()
            ? current.desc.trim().slice(0, 300)
            : `TikTok video ${expectedId}`,
        cover:
          typeof current.cover === "string" && current.cover.startsWith("https://")
            ? current.cover
            : "",
        type: "video",
        embedUrl: `https://www.tiktok.com/player/v1/${expectedId}`,
        web_url: "",
        author: { nickname: "", unique_id: "" },
        stats: { plays: 0, likes: 0 },
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
      headers: { Accept: "text/html,application/xhtml+xml" },
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

  // 1. Try native public-page extraction
  try {
    const html = await fetchTikTokPage(pageUrl);
    const video = extractTikTokVideoData(html, videoId);
    video.web_url = pageUrl.href;
    video.author = {
      nickname: creator,
      unique_id: creator,
    };
    video.downloadUrl = video.mediaUrl
      ? `/tools/tiktok/download?url=${encodeURIComponent(pageUrl.href)}`
      : null;
    delete video.mediaUrl;
    return video;
  } catch (nativeErr) {
    console.warn("Native TikTok page scraping failed, trying TikWM fallback:", nativeErr?.message);
  }

  // 2. Fallback to TikWM
  const targetUrl = originalInputUrl || pageUrl.href;
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
      cover: tikwm.cover || "",
      type: isSlideshow ? "slideshow" : "video",
      embedUrl: `https://www.tiktok.com/player/v1/${resolvedId}`,
      web_url: pageUrl.href || targetUrl,
      author: {
        nickname: authorName,
        unique_id: authorId,
      },
      stats: {
        plays: Number(tikwm.play_count || 0),
        likes: Number(tikwm.digg_count || 0),
      },
      images: tikwm.images || [],
      no_watermark_url: playMediaUrl,
      playUrl: playMediaUrl,
      downloadUrl: playMediaUrl
        ? `/tools/tiktok/download?url=${encodeURIComponent(pageUrl.href)}&direct=${encodeURIComponent(playMediaUrl)}`
        : null,
    };
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
    downloadUrl: null,
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
      const preview = createTikTokPreview(pageUrl);
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

    if (!sourceUrl && pageUrl) {
      try {
        const html = await fetchTikTokPage(pageUrl);
        const match = pageUrl.pathname.match(/^\/@[^/]+\/video\/(\d+)\/?$/);
        if (match) {
          const extracted = extractTikTokVideoData(html, match[1]);
          sourceUrl = validateTikTokMediaUrl(extracted.mediaUrl);
        }
      } catch (nativeErr) {
        console.warn("Native download extraction failed, trying TikWM:", nativeErr?.message);
      }
    }

    if (!sourceUrl && (pageUrl || rawUrl)) {
      const target = pageUrl ? pageUrl.href : rawUrl;
      const tikwm = await extractFromTikWM(target);
      if (tikwm) {
        sourceUrl = validateTikTokMediaUrl(tikwm.play || tikwm.hdplay);
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

export default tools;
