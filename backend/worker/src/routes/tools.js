import { Hono } from "hono";
import { requireAuth } from "./auth.js";

const tools = new Hono();
const maxPageBytes = 2 * 1024 * 1024;
const maxMediaBytes = 100 * 1024 * 1024;
const pageHosts = new Set(["tiktok.com", "www.tiktok.com", "vt.tiktok.com", "vm.tiktok.com", "m.tiktok.com"]);
const mediaHostSuffixes = [
  ".tiktok.com",
  ".tiktokcdn.com",
  ".tiktokv.com",
  ".byteoversea.com",
  ".bytevc.com",
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

async function extractTikTokVideo(pageUrl) {
  const match = pageUrl.pathname.match(/^\/@[^/]+\/video\/(\d+)\/?$/);
  if (!match) throw new TypeError("Expected a canonical TikTok video URL");
  const html = await fetchTikTokPage(pageUrl);
  const video = extractTikTokVideoData(html, match[1]);
  video.web_url = pageUrl.href;
  video.author = {
    nickname: pageUrl.pathname.split("/")[1].slice(1),
    unique_id: pageUrl.pathname.split("/")[1].slice(1),
  };
  video.downloadUrl = video.mediaUrl
    ? `/tools/tiktok/download?url=${encodeURIComponent(pageUrl.href)}`
    : null;
  delete video.mediaUrl;
  return video;
}

tools.post("/tiktok/lookup", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }
  const pageUrl = validateTikTokUrl(body?.url);
  if (!pageUrl) {
    return c.json({ success: false, error: "A canonical HTTPS TikTok video URL is required" }, 400);
  }

  try {
    return c.json({ success: true, video: await extractTikTokVideo(pageUrl) });
  } catch (error) {
    console.error("TikTok public video lookup failed:", {
      error: error instanceof Error ? error.message : "Unknown error",
      status: error?.status,
    });
    return c.json(
      { success: false, error: "TikTok's public video page is temporarily unavailable." },
      502
    );
  }
});

tools.get("/tiktok/download", requireAuth, async (c) => {
  const pageUrl = validateTikTokUrl(c.req.query("url"));
  if (!pageUrl) {
    return c.json({ success: false, error: "A canonical HTTPS TikTok video URL is required" }, 400);
  }

  try {
    const html = await fetchTikTokPage(pageUrl);
    const videoId = pageUrl.pathname.match(/^\/@[^/]+\/video\/(\d+)\/?$/)[1];
    const extracted = extractTikTokVideoData(html, videoId);
    const sourceUrl = validateTikTokMediaUrl(extracted.mediaUrl);
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
          Referer: pageUrl.href,
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
