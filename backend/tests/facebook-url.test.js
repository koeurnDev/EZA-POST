const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isSupportedPublicPostPath,
  normalizeFacebookUrl,
} = require("../utils/facebookUrl");

test("Facebook URL validation accepts secure Facebook post hosts", () => {
  for (const value of [
    "https://www.facebook.com/watch/?v=123",
    "https://m.facebook.com/reel/123",
    "https://fb.watch/abc123/",
    "https://fb.me/abc123",
    "https://mbasic.facebook.com/user/posts/pfbid123",
  ]) {
    assert.equal(normalizeFacebookUrl(value), new URL(value).toString());
    assert.equal(isSupportedPublicPostPath(value), true);
  }
});

test("Facebook URL validation rejects non-platform and unsafe URLs", () => {
  for (const value of [
    "http://www.facebook.com/watch/?v=123",
    "https://facebook.com.attacker.example/watch/?v=123",
    "https://attacker.example/?url=https://facebook.com/watch/?v=123",
    "https://fbcdn.net/video.mp4",
    "blob:https://www.facebook.com/video",
    "https://www.facebook.com:8443/watch/?v=123",
    "not a URL",
    "x".repeat(2049),
  ]) {
    assert.equal(normalizeFacebookUrl(value), null, value.slice(0, 80));
  }
});

test("Facebook Story paths are rejected while group and pfbid posts remain eligible", () => {
  assert.equal(isSupportedPublicPostPath("https://www.facebook.com/stories/123/456"), false);
  assert.equal(isSupportedPublicPostPath("https://www.facebook.com/groups/123/posts/456"), true);
  assert.equal(isSupportedPublicPostPath("https://www.facebook.com/user/posts/pfbid123"), true);
});
