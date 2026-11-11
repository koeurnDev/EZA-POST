const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isInstagramMediaUrl,
  maxInstagramMediaBytes,
  normalizeInstagramPostUrl,
} = require("../utils/instagramUrl");

test("Instagram permalink validation accepts supported secure post URLs", () => {
  for (const value of [
    "https://www.instagram.com/p/ABC123/",
    "https://instagram.com/reel/ABC123/?igsh=tracking",
    "https://m.instagram.com/tv/ABC123",
    "https://www.instagram.com/share/reel/ABC123/",
  ]) {
    const normalized = normalizeInstagramPostUrl(value);
    assert.ok(normalized);
    assert.equal(new URL(normalized).search, "");
  }
});

test("Instagram permalink validation rejects unrelated and unsupported URLs", () => {
  for (const value of [
    "http://www.instagram.com/p/ABC123/",
    "https://instagram.com.attacker.example/p/ABC123/",
    "https://attacker.example/?url=https://instagram.com/p/ABC123/",
    "https://user:password@instagram.com/p/ABC123/",
    "https://instagram.com:8443/p/ABC123/",
    "https://www.instagram.com/accounts/login/",
    "https://www.instagram.com/stories/user/123/",
    "not a URL",
    "x".repeat(2049),
  ]) {
    assert.equal(normalizeInstagramPostUrl(value), null, value.slice(0, 80));
  }
});

test("Instagram fallback media accepts only HTTPS CDN URLs", () => {
  for (const value of [
    "https://scontent.cdninstagram.com/image.jpg?sig=abc",
    "https://scontent-lax3-1.xx.fbcdn.net/image.jpg",
  ]) {
    assert.equal(isInstagramMediaUrl(value), true);
  }
  for (const value of [
    "http://scontent.cdninstagram.com/image.jpg",
    "https://cdninstagram.com.attacker.example/image.jpg",
    "https://attacker.example/image.jpg",
    "https://user:pass@scontent.cdninstagram.com/image.jpg",
    "https://scontent.cdninstagram.com:8443/image.jpg",
  ]) {
    assert.equal(isInstagramMediaUrl(value), false, value);
  }
  assert.equal(maxInstagramMediaBytes, 25 * 1024 * 1024);
});
