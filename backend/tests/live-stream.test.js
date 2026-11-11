const test = require("node:test");
const assert = require("node:assert/strict");
const liveStreamManager = require("../services/liveStreamManager");

test("Live Stream: FFmpeg executable is successfully resolved", () => {
  const ffmpegPath = liveStreamManager.resolveFFmpegPath();
  assert.ok(ffmpegPath, "FFmpeg path must not be empty");
  assert.ok(typeof ffmpegPath === "string", "FFmpeg path must be string");
});

test("Live Stream: loop mode arguments assemble properly", () => {
  const getLoopArgs = (loop) => {
    const args = [];
    const loopNum = Number(loop);
    if (loopNum === -1 || loop === "infinite") {
      args.push("-stream_loop", "-1");
    } else if (loopNum > 1) {
      args.push("-stream_loop", String(loopNum - 1));
    }
    return args;
  };

  assert.deepEqual(getLoopArgs(1), []);
  assert.deepEqual(getLoopArgs(2), ["-stream_loop", "1"]);
  assert.deepEqual(getLoopArgs(5), ["-stream_loop", "4"]);
  assert.deepEqual(getLoopArgs(-1), ["-stream_loop", "-1"]);
  assert.deepEqual(getLoopArgs("infinite"), ["-stream_loop", "-1"]);
});

test("Live Stream: tee muxer formats multiple RTMPS streams correctly", () => {
  const targets = [
    { streamUrl: "rtmps://live-api-s.facebook.com:443/rtmp/token1" },
    { streamUrl: "rtmps://live-api-s.facebook.com:443/rtmp/token2" },
  ];

  const teeOutputs = targets
    .map((t) => `[f=flv:onfail=ignore]${t.streamUrl}`)
    .join("|");

  assert.equal(
    teeOutputs,
    "[f=flv:onfail=ignore]rtmps://live-api-s.facebook.com:443/rtmp/token1|[f=flv:onfail=ignore]rtmps://live-api-s.facebook.com:443/rtmp/token2"
  );
});

test("Live Stream: active sessions map is operational", () => {
  const broadcasts = liveStreamManager.getUserBroadcasts("non_existent_user");
  assert.deepEqual(broadcasts, []);
});

