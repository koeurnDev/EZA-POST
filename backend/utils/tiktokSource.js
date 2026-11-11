const fs = require("fs");
const path = require("path");

const tiktokPageHosts = new Set([
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
]);

const tiktokMediaSuffixes = [
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
];

function parseHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 8192) return null;

  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      (parsed.port && parsed.port !== "443")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isTikTokPageUrl(value) {
  const parsed = parseHttpsUrl(value);
  return Boolean(parsed && tiktokPageHosts.has(parsed.hostname.toLowerCase()));
}

function isTikTokMediaUrl(value) {
  const parsed = parseHttpsUrl(value);
  if (!parsed) return false;
  const hostname = parsed.hostname.toLowerCase();
  if (tiktokPageHosts.has(hostname)) return false;
  return tiktokMediaSuffixes.some((suffix) => hostname.endsWith(suffix));
}

function resolveLocalVideoPath(value, tempDir) {
  if (typeof value !== "string" || !path.isAbsolute(value)) return null;

  try {
    const root = fs.realpathSync(tempDir);
    const resolved = fs.realpathSync(value);
    const relative = path.relative(root, resolved);
    if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
      return null;
    }
    return fs.statSync(resolved).isFile() ? resolved : null;
  } catch {
    return null;
  }
}

module.exports = {
  isTikTokMediaUrl,
  isTikTokPageUrl,
  resolveLocalVideoPath,
};
