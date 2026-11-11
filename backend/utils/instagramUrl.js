const instagramHosts = new Set(["instagram.com"]);
const mediaHosts = new Set(["cdninstagram.com", "fbcdn.net"]);
const maxInstagramMediaBytes = 25 * 1024 * 1024;

function isHostOrSubdomain(hostname, roots) {
  return [...roots].some((root) => hostname === root || hostname.endsWith(`.${root}`));
}

function normalizeInstagramPostUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    const validPath = /^\/(?:p|reel|reels|tv|share\/reel)\/[A-Za-z0-9_-]+\/?$/i.test(url.pathname);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !isHostOrSubdomain(hostname, instagramHosts) ||
      !validPath
    ) {
      return null;
    }

    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isInstagramMediaUrl(value) {
  if (typeof value !== "string" || value.length > 8192) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      isHostOrSubdomain(url.hostname.toLowerCase(), mediaHosts);
  } catch {
    return false;
  }
}

module.exports = {
  isInstagramMediaUrl,
  maxInstagramMediaBytes,
  normalizeInstagramPostUrl,
};
