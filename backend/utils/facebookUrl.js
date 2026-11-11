const facebookHosts = new Set(["facebook.com", "fb.watch", "fb.me"]);

function normalizeFacebookUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    const isFacebookHost = facebookHosts.has(hostname) ||
      hostname.endsWith(".facebook.com");

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !isFacebookHost
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function isSupportedPublicPostPath(value) {
  const url = normalizeFacebookUrl(value);
  if (!url) return false;
  const pathname = new URL(url).pathname.toLowerCase();
  return !pathname.startsWith("/stories/");
}

module.exports = { isSupportedPublicPostPath, normalizeFacebookUrl };
