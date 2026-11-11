const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isThreadsMediaUrl,
  maxThreadsMediaBytes,
  normalizeThreadsPostUrl,
} = require("../utils/threadsUrl");

test("Threads URL validation accepts secure post links on supported domains", () => {
  assert.equal(
    normalizeThreadsPostUrl("https://www.threads.net/@person/post/ABC123?share=1"),
    "https://www.threads.net/@person/post/ABC123/"
  );
  assert.equal(
    normalizeThreadsPostUrl("https://threads.com/@person/post/ABC123/"),
    "https://threads.com/@person/post/ABC123/"
  );
});

test("Threads URL validation rejects deceptive, insecure, and invalid hosts", () => {
  for (const value of [
    "http://threads.net/@person/post/abc",
    "https://threads.net.attacker.example/@person/post/abc",
    "https://attacker.example/?url=https://threads.net/@person/post/abc",
    "https://user:password@threads.net/@person/post/abc",
    "https://threads.net:8443/@person/post/abc",
    "https://threads.net/",
    "not a URL",
    "x".repeat(2049),
  ]) {
    assert.equal(normalizeThreadsPostUrl(value), null, value.slice(0, 80));
  }
});

test("Threads media URL validation allows only HTTPS Threads and Meta CDN hosts", () => {
  for (const value of [
    "https://threads.net/media/clip.mp4",
    "https://scontent.cdninstagram.com/image.jpg",
    "https://video.xx.fbcdn.net/clip.mp4",
  ]) {
    assert.equal(isThreadsMediaUrl(value), true);
  }
  for (const value of [
    "http://scontent.cdninstagram.com/image.jpg",
    "https://cdninstagram.com.attacker.example/image.jpg",
    "https://attacker.example/?fbcdn=1",
    "https://user:pass:threads.net@attacker.example/clip.mp4",
    "https://threads.net:8443/media/clip.mp4",
  ]) {
    assert.equal(isThreadsMediaUrl(value), false, value);
  }
  assert.equal(maxThreadsMediaBytes, 100 * 1024 * 1024);
});
