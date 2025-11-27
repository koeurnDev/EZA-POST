/**
 * ============================================================
 * 📄 /api/error-log.js — Centralized Frontend Error Collector
 * ============================================================
 * ✅ Accepts POST requests from frontend ErrorBoundary
 * ✅ Logs errors to file
 * ✅ Supports GET route for admins to review logs
 */

const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");

// 🗂️ Ensure log directory exists
const logDir = path.join(__dirname, "../../logs");
(async () => {
  try {
    await fs.mkdir(logDir, { recursive: true });
    console.log("✅ Log directory ensured:", logDir);
  } catch (err) {
    console.warn("⚠️ Could not ensure log directory:", err.message);
  }
})();

/* -------------------------------------------------------------------------- */
/* ✅ POST /api/error-log — Receive frontend errors                           */
/* -------------------------------------------------------------------------- */
router.post("/", async (req, res) => {
  try {
    const { error, componentStack, url, userAgent, timestamp, origin } = req.body || {};

    if (!error || !timestamp) {
      return res.status(400).json({ success: false, message: "Invalid error payload" });
    }

    // 🧹 Sanitize input
    const truncate = (str, max = 500) =>
      typeof str === "string"
        ? str.substring(0, max).replace(/\s+/g, " ").trim()
        : str;

    const logData = {
      error: truncate(error),
      componentStack: truncate(componentStack || "N/A"),
      url: truncate(url || req.originalUrl || "N/A"),
      origin: truncate(origin || req.get("origin") || "Unknown"),
      userAgent: truncate(userAgent || req.get("user-agent") || "Unknown"),
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      timestamp: new Date(timestamp).toISOString(),
    };

    // 🪵 Append to daily log file
    const date = new Date().toISOString().split("T")[0];
    const logFile = path.join(logDir, `error-${date}.log`);
    await fs.appendFile(logFile, JSON.stringify(logData) + "\n");

    if (process.env.NODE_ENV !== "production") {
      console.log(`🚨 Error logged: ${logData.error}`);
    }

    res.status(201).json({
      success: true,
      message: "Error logged successfully",
    });
  } catch (err) {
    console.error("❌ Error logging failed:", err.message);
    res.status(500).json({
      success: false,
      message: "Server error while logging",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ GET /api/error-log — Retrieve recent logs (admin only)                 */
/* -------------------------------------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const token = req.get("x-admin-token");
    if (process.env.ADMIN_TOKEN && token !== process.env.ADMIN_TOKEN) {
      return res.status(403).json({ error: "Access denied" });
    }

    // 📄 Read latest log file
    const files = (await fs.readdir(logDir)).filter((f) => f.endsWith(".log"));
    if (files.length === 0) return res.json([]);

    const latestFile = path.join(logDir, files.sort().reverse()[0]);
    const content = await fs.readFile(latestFile, "utf8");

    const parsed = content
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .slice(-50);

    res.json(parsed);
  } catch (err) {
    console.error("❌ Failed to read error logs:", err.message);
    res.status(500).json({ error: "Failed to retrieve logs" });
  }
});

module.exports = router;
