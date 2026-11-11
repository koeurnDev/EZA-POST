function normalizeCapCutUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (hostname !== "capcut.com" && !hostname.endsWith(".capcut.com")) ||
      url.pathname === "/"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

module.exports = { normalizeCapCutUrl };
