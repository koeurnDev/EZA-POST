const pinterestHosts = new Set(["pinterest.com", "pin.it"]);
const maxPinterestDownloadBytes = 50 * 1024 * 1024;

function normalizePinterestUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    const supportedHost = [...pinterestHosts].some(
      (root) => hostname === root || hostname.endsWith(`.${root}`)
    );

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !supportedHost ||
      url.pathname === "/"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function isPinterestMediaUrl(value) {
  if (typeof value !== "string" || value.length > 8192) return false;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (hostname === "pinimg.com" || hostname.endsWith(".pinimg.com"));
  } catch {
    return false;
  }
}

module.exports = {
  isPinterestMediaUrl,
  maxPinterestDownloadBytes,
  normalizePinterestUrl,
};
