/**
 * ============================================================
 * 🔴 liveStreamManager.js — Multi-Page Facebook Live Streamer
 * ============================================================
 * Enables streaming pre-recorded videos to multiple Facebook
 * Pages simultaneously via Facebook Live Video API & FFmpeg RTMPS.
 */

const { spawn, exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const prisma = require("../utils/prisma");
const fb = require("../utils/fb");
const { decrypt } = require("../utils/crypto");

class LiveStreamManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> sessionObject
    this.ffmpegPath = this.resolveFFmpegPath();
    console.log(`🎬 LiveStreamManager initialized with FFmpeg at: ${this.ffmpegPath}`);
  }

  resolveFFmpegPath() {
    try {
      const ffmpegStatic = require("ffmpeg-static");
      if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
        return ffmpegStatic;
      }
    } catch (e) {
      // fallback
    }
    return "ffmpeg";
  }

  /**
   * Start a multi-page live broadcast session
   */
  async startBroadcast(userId, options = {}) {
    const {
      title = "Facebook Live Stream",
      description = "",
      videoPath,
      pageIds = [],
      loop = 1, // 1 = play once, 2 = 2x, -1 = infinite
    } = options;

    if (!videoPath || !fs.existsSync(videoPath)) {
      throw new Error(`Video file not found at path: ${videoPath}`);
    }

    if (!Array.isArray(pageIds) || pageIds.length === 0) {
      throw new Error("Please select at least 1 Facebook Page to stream to");
    }

    // 1. Fetch and verify ownership of target pages
    const pages = await prisma.facebookPage.findMany({
      where: {
        id: { in: pageIds },
        userId,
        isConnected: true,
      },
    });

    if (pages.length === 0) {
      throw new Error("No connected pages found for the selected IDs");
    }

    const sessionId = crypto.randomUUID();
    const targets = [];

    // 2. Create Live Video containers on Facebook for each selected page
    for (const page of pages) {
      try {
        const token = decrypt(page.accessToken);
        const liveRes = await fb.createLiveVideo(page.id, token, {
          title,
          description,
          status: "LIVE_NOW",
        });

        if (liveRes.success && liveRes.streamUrl) {
          targets.push({
            pageId: page.id,
            pageName: page.name,
            picture: page.picture,
            liveVideoId: liveRes.liveVideoId,
            streamUrl: liveRes.streamUrl,
            pageAccessToken: token,
            status: "ready",
          });
        } else {
          console.warn(`⚠️ Could not create live video for page ${page.name}:`, liveRes.error);
        }
      } catch (err) {
        console.error(`❌ Error initializing live stream for page ${page.name}:`, err.message);
      }
    }

    if (targets.length === 0) {
      throw new Error("Failed to create live video containers on any selected Facebook page. Check page permissions.");
    }

    // 3. Assemble FFmpeg command args
    // Loop flag:
    const args = ["-re"]; // read at native frame rate
    const loopNum = Number(loop);
    if (loopNum === -1 || loop === "infinite") {
      args.push("-stream_loop", "-1");
    } else if (loopNum > 1) {
      args.push("-stream_loop", String(loopNum - 1));
    }

    args.push("-i", videoPath);

    // Encoding settings optimized for Facebook Live RTMPS:
    args.push(
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-b:v", "3000k",
      "-maxrate", "3500k",
      "-bufsize", "6000k",
      "-pix_fmt", "yuv420p",
      "-g", "60",
      "-keyint_min", "60",
      "-c:a", "aac",
      "-b:a", "128k",
      "-ar", "44100"
    );

    // Use tee muxer for fanning out to multiple RTMPS streams efficiently
    if (targets.length === 1) {
      args.push("-f", "flv", targets[0].streamUrl);
    } else {
      // Tee muxer format: "[f=flv:onfail=ignore]url1|[f=flv:onfail=ignore]url2"
      const teeOutputs = targets
        .map((t) => `[f=flv:onfail=ignore]${t.streamUrl}`)
        .join("|");
      args.push("-f", "tee", "-map", "0:v", "-map", "0:a", teeOutputs);
    }

    console.log(`🚀 Spawning FFmpeg Live Stream for session ${sessionId} across ${targets.length} pages...`);

    const child = spawn(this.ffmpegPath, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const session = {
      id: sessionId,
      userId,
      title,
      description,
      videoPath,
      loop: loopNum,
      process: child,
      pid: child.pid,
      startedAt: new Date(),
      status: "live",
      targets,
      stats: {
        fps: 0,
        speed: "1x",
        bitrate: "3000k",
        lastUpdate: new Date(),
      },
      logs: [],
    };

    // Parse FFmpeg stderr for live telemetry
    child.stderr.on("data", (chunk) => {
      const line = chunk.toString();
      session.logs.push(line);
      if (session.logs.length > 50) session.logs.shift();

      // Example stderr line: frame=  120 fps= 30 q=28.0 size=    1024kB time=00:00:04.00 bitrate=2097.2kbits/s speed=1.0x
      const fpsMatch = line.match(/fps=\s*([\d\.]+)/);
      const speedMatch = line.match(/speed=\s*([\d\.]+x)/);
      const bitrateMatch = line.match(/bitrate=\s*([\d\.]+\s*\w+\/s)/);

      if (fpsMatch) session.stats.fps = parseFloat(fpsMatch[1]);
      if (speedMatch) session.stats.speed = speedMatch[1];
      if (bitrateMatch) session.stats.bitrate = bitrateMatch[1];
      session.stats.lastUpdate = new Date();
    });

    child.on("error", (err) => {
      console.error(`❌ FFmpeg process error for session ${sessionId}:`, err);
      session.status = "error";
      session.error = err.message;
    });

    child.on("close", async (code) => {
      console.log(`⏹️ FFmpeg process for session ${sessionId} closed with code ${code}`);
      session.status = code === 0 ? "completed" : (session.status === "stopping" ? "stopped" : "failed");

      // Auto-end live videos on Facebook if not already ended
      for (const target of session.targets) {
        try {
          await fb.endLiveVideo(target.liveVideoId, target.pageAccessToken);
        } catch (e) {
          // ignore
        }
      }
    });

    this.sessions.set(sessionId, session);

    return {
      success: true,
      sessionId,
      title,
      targetsCount: targets.length,
      targets: targets.map((t) => ({
        pageId: t.pageId,
        pageName: t.pageName,
        picture: t.picture,
        liveVideoId: t.liveVideoId,
      })),
      startedAt: session.startedAt,
    };
  }

  /**
   * Stop an active live stream broadcast
   */
  async stopBroadcast(userId, sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Live stream session not found or already ended");
    }

    if (session.userId !== userId) {
      throw new Error("Unauthorized: you do not own this live stream session");
    }

    session.status = "stopping";
    console.log(`🛑 Stopping broadcast session ${sessionId} (PID ${session.pid})...`);

    // Kill FFmpeg process safely
    if (session.process && !session.process.killed) {
      try {
        if (process.platform === "win32") {
          exec(`taskkill /pid ${session.pid} /T /F`, (err) => {
            if (err) console.warn("taskkill error:", err.message);
          });
        } else {
          session.process.kill("SIGTERM");
        }
      } catch (err) {
        console.warn("Error terminating process:", err.message);
      }
    }

    // Call Facebook End Live Video API for each target
    const endResults = [];
    for (const target of session.targets) {
      try {
        const res = await fb.endLiveVideo(target.liveVideoId, target.pageAccessToken);
        endResults.push({ pageId: target.pageId, pageName: target.pageName, success: res.success });
      } catch (err) {
        endResults.push({ pageId: target.pageId, pageName: target.pageName, success: false, error: err.message });
      }
    }

    session.status = "stopped";
    session.stoppedAt = new Date();

    return {
      success: true,
      sessionId,
      message: "Broadcast ended successfully",
      endResults,
    };
  }

  /**
   * Get active broadcasts for a user
   */
  getUserBroadcasts(userId) {
    const active = [];
    for (const [id, session] of this.sessions.entries()) {
      if (session.userId === userId && (session.status === "live" || session.status === "starting")) {
        const uptimeSeconds = Math.floor((new Date() - session.startedAt) / 1000);
        active.push({
          sessionId: id,
          title: session.title,
          description: session.description,
          status: session.status,
          startedAt: session.startedAt,
          uptimeSeconds,
          loop: session.loop,
          targets: session.targets.map((t) => ({
            pageId: t.pageId,
            pageName: t.pageName,
            picture: t.picture,
            liveVideoId: t.liveVideoId,
          })),
          stats: session.stats,
        });
      }
    }
    return active;
  }
}

module.exports = new LiveStreamManager();

