const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeQuality, normalizeYouTubeUrl } = require("../utils/youtubeUrl");

test("YouTube URL validation accepts supported HTTPS hosts", () => {
  for (const value of [
    "https://www.youtube.com/watch?v=video-id",
    "https://youtube.com/playlist?list=playlist-id",
    "https://youtu.be/video-id",
    "https://music.youtube.com/watch?v=video-id",
  ]) {
    assert.equal(normalizeYouTubeUrl(value), new URL(value).toString());
  }
});

test("YouTube URL validation rejects unrelated, insecure, and deceptive URLs", () => {
  for (const value of [
    "http://www.youtube.com/watch?v=video-id",
    "https://youtube.com.attacker.example/watch?v=video-id",
    "https://attacker.example/?url=https://youtube.com/watch?v=video-id",
    "https://user:password@youtube.com/watch?v=video-id",
    "https://youtube.com:8443/watch?v=video-id",
    "not a URL",
    "x".repeat(2049),
  ]) {
    assert.equal(normalizeYouTubeUrl(value), null, value.slice(0, 80));
  }
});

test("YouTube quality validation accepts supported values only", () => {
  assert.deepEqual(normalizeQuality(1080, "mp4"), { value: 1080 });
  assert.deepEqual(normalizeQuality("720", "mp4"), { value: 720 });
  assert.deepEqual(normalizeQuality(320, "mp3"), { value: 320 });
  assert.deepEqual(normalizeQuality(undefined, "mp4"), { value: null });
  assert.deepEqual(normalizeQuality("1080p", "mp4"), { error: "Unsupported quality" });
  assert.deepEqual(normalizeQuality(9999, "mp4"), { error: "Unsupported quality" });
  assert.deepEqual(normalizeQuality(320, "mp4"), { error: "Unsupported quality" });
  assert.deepEqual(normalizeQuality(128, "mp3"), { value: 128 });
});
