const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
    isTikTokMediaUrl,
    isTikTokPageUrl,
    resolveLocalVideoPath,
} = require("../utils/tiktokSource");
const { TikTokDownloader } = require("../utils/tiktokDownloader");

test("accepts only secure TikTok page URLs and short links", () => {
    assert.equal(isTikTokPageUrl("https://www.tiktok.com/@user/video/123"), true);
    assert.equal(isTikTokPageUrl("https://vm.tiktok.com/abc/"), true);
    assert.equal(isTikTokPageUrl("https://vt.tiktok.com/abc/"), true);
    assert.equal(isTikTokPageUrl("http://www.tiktok.com/@user/video/123"), false);
    assert.equal(isTikTokPageUrl("https://tiktok.com.example.org/video/123"), false);
    assert.equal(isTikTokPageUrl("https://user@tiktok.com/video/123"), false);
});

test("accepts known TikTok media CDN hosts and rejects lookalikes", () => {
    assert.equal(isTikTokMediaUrl("https://v16-webapp.tiktok.com/video.mp4"), true);
    assert.equal(isTikTokMediaUrl("https://p16-sign.tiktokcdn-us.com/video.mp4"), true);
    assert.equal(isTikTokMediaUrl("https://tiktokcdn.com/video.mp4"), false);
    assert.equal(isTikTokMediaUrl("https://evil.example/video.mp4?tiktokcdn.com"), false);
    assert.equal(isTikTokMediaUrl("https://tiktokcdn.com.evil.example/video.mp4"), false);
    assert.equal(isTikTokMediaUrl("http://v16-webapp.tiktok.com/video.mp4"), false);
});

test("only resolves local video files within the configured temporary directory", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tiktok-source-test-"));
    const insideFile = path.join(root, "inside.mp4");
    const outsideFile = path.join(os.tmpdir(), `tiktok-source-outside-${process.pid}.mp4`);
    fs.writeFileSync(insideFile, "video");
    fs.writeFileSync(outsideFile, "video");
    t.after(() => {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(outsideFile, { force: true });
    });

    assert.equal(resolveLocalVideoPath(insideFile, root), fs.realpathSync(insideFile));
    assert.equal(resolveLocalVideoPath(outsideFile, root), null);
    assert.equal(resolveLocalVideoPath(path.join(root, "missing.mp4"), root), null);
});

test("TikTok downloader rejects non-platform URLs before extraction or fetch", async () => {
    const downloader = Object.create(TikTokDownloader.prototype);
    const unsafeUrl = "https://attacker.example/video";

    await assert.rejects(downloader.extractVideoId(unsafeUrl), /valid HTTPS TikTok URL/);
    await assert.rejects(downloader.downloadTiktokVideo(unsafeUrl), /valid HTTPS TikTok URL/);
    await assert.rejects(downloader.getPlayableUrl(unsafeUrl), /valid HTTPS TikTok URL/);
    await assert.rejects(downloader.getVideoMetadata(unsafeUrl), /valid HTTPS TikTok URL/);
    await assert.rejects(downloader.downloadMedia(unsafeUrl), /unsupported host/);
    assert.equal(TikTokDownloader.prototype.downloadViaAPIProxy, undefined);
    assert.equal(TikTokDownloader.prototype.downloadViaRapidAPI, undefined);
});
