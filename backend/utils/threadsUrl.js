const threadsHosts = new Set(["threads.net", "threads.com"]);
const mediaHosts = new Set(["threads.net", "threads.com", "cdninstagram.com", "fbcdn.net"]);
const maxThreadsMediaBytes = 100 * 1024 * 1024;

function isHostOrSubdomain(hostname, roots) {
  return [...roots].some((root) => hostname === root || hostname.endsWith(`.${root}`));
}

function normalizeThreadsPostUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !isHostOrSubdomain(hostname, threadsHosts) ||
      url.pathname === "/"
    ) {
      return null;
    }

    url.search = "";
    url.hash = "";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return url.toString();
  } catch {
    return null;
  }
}

function isThreadsMediaUrl(value) {
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
  isThreadsMediaUrl,
  maxThreadsMediaBytes,
  normalizeThreadsPostUrl,
};
