const supportedHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);
const videoQualities = new Set([144, 240, 360, 480, 720, 1080, 1440, 2160]);
const audioQualities = new Set([128, 192, 256, 320]);

function normalizeYouTubeUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;

  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !supportedHosts.has(url.hostname.toLowerCase())
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeQuality(value, format) {
  if (value === undefined) return { value: null };
  const quality = typeof value === "number" && Number.isInteger(value)
    ? value
    : typeof value === "string" && /^\d+$/.test(value)
      ? Number(value)
      : null;
  const allowed = format === "mp3" ? audioQualities : videoQualities;
  return quality !== null && allowed.has(quality)
    ? { value: quality }
    : { error: "Unsupported quality" };
}

module.exports = { normalizeQuality, normalizeYouTubeUrl };
