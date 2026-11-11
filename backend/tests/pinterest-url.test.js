const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isPinterestMediaUrl,
  maxPinterestDownloadBytes,
  normalizePinterestUrl,
} = require("../utils/pinterestUrl");

test("Pinterest URL validation accepts supported secure Pin links", () => {
  for (const value of [
    "https://www.pinterest.com/pin/123456789/",
    "https://pinterest.com/pin/123456789/?tracking=abc",
    "https://pin.it/abc123",
    "https://uk.pinterest.com/pin/123456789/",
  ]) {
    assert.ok(normalizePinterestUrl(value));
  }
});

test("Pinterest URL validation rejects unrelated and unsafe URLs", () => {
  for (const value of [
    "http://pinterest.com/pin/123",
    "https://pinterest.com.attacker.example/pin/123",
    "https://attacker.example/?url=https://pinterest.com/pin/123",
    "https://user:password@pinterest.com/pin/123",
    "https://pinterest.com:8443/pin/123",
    "https://pinterest.com/",
    "not a URL",
    "x".repeat(2049),
  ]) {
    assert.equal(normalizePinterestUrl(value), null, value.slice(0, 80));
  }
});

test("Pinterest media proxy permits only HTTPS pinimg CDN hosts", () => {
  assert.equal(isPinterestMediaUrl("https://i.pinimg.com/originals/a.jpg"), true);
  assert.equal(isPinterestMediaUrl("https://video.pinimg.com/clip.mp4"), true);
  assert.equal(isPinterestMediaUrl("http://i.pinimg.com/image.jpg"), false);
  assert.equal(isPinterestMediaUrl("https://pinimg.com.attacker.example/image.jpg"), false);
  assert.equal(isPinterestMediaUrl("https://attacker.example/image.jpg"), false);
  assert.equal(maxPinterestDownloadBytes, 50 * 1024 * 1024);
});
