// ============================================================
// 🌐 EZA_POST BACKEND - FINAL PRODUCTION VERSION (Optimized + Modular Ready)
// ============================================================

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const app = express();
const session = require("express-session");
// const MongoStore = require("connect-mongo"); // REMOVED
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
// const mongoSanitize = require("express-mongo-sanitize"); // REMOVED
const xss = require("xss-clean");
const hpp = require("hpp");
const prisma = require('./utils/prisma');

// ------------------------------------------------------------
// ✅ Middleware & Security
// ------------------------------------------------------------
app.use(morgan("dev"));
app.use(cookieParser(process.env.SESSION_SECRET || "eza_post_secret_key_2026"));

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 🛡️ Security Middlewares
// app.use(mongoSanitize()); // REMOVED (Not needed for SQL)
app.use(xss());
app.use(hpp());

// ... [Keep CORS and other middleware] ...


// ... [Keep Rate Limit, CSRF, etc.] ...



// 🔍 Debug Middleware: Log Cookies & Origin
app.use((req, res, next) => {
  console.log(`🔍 [${req.method}] ${req.url}`);
  console.log(`   👉 Origin: ${req.headers.origin}`);
  console.log(`   👉 Cookies:`, req.cookies);
  next();
});

// ✅ Dynamic CORS setup
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "https://eza-post-frontend.vercel.app", // ✅ Explicitly allow main Vercel domain
  "https://eza-post.vercel.app", // ✅ Added user's specific Vercel domain
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // In development, allow all localhost origins AND local network IPs
      if (process.env.NODE_ENV !== "production") {
        if (origin.includes("localhost") || origin.startsWith("http://192.168.")) {
          return callback(null, true);
        }
      }

      // Check against allowed origins
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // ✅ Allow all Vercel deployments (Preview & Production)
      if (origin.endsWith(".vercel.app")) return callback(null, true);

      console.warn(`⚠️ CORS blocked origin: '${origin}'`); // Log with quotes to see whitespace
      return callback(new Error(`CORS not allowed for this origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-csrf-token', 'X-CSRF-Token'],
  })
);

// ✅ Enable Preflight for all routes
app.options('*', cors());

// ✅ Ensure Temp Directories Exist (Critical for Render)
// fs is already required at the top
const tempUploadsPath = path.join(__dirname, "temp", "uploads");
if (!fs.existsSync(tempUploadsPath)) fs.mkdirSync(tempUploadsPath, { recursive: true });

// ✅ Trust Proxy (Required for Render/Heroku secure cookies)
app.set("trust proxy", 1);

// ✅ Session setup (stored in MongoDB)
// ✅ Session setup (Simplified for Migration)
let sessionStore = new session.MemoryStore();
console.log("✅ Session Store Initialized (MemoryStore)");

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "eza_post_secret_key_2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.RENDER === "true", // ✅ Only force Secure on Render
      httpOnly: true,
      sameSite: process.env.RENDER === "true" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ✅ Rate limiting (DDoS & Brute Force Protection)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per 15 mins
  message: { error: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per 15 mins (Auth/Login)
  message: { error: "Security Alert: Too many attempts. Please wait 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const toolLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit heavy tools to 10 requests per minute
  message: { error: "System busy: Too many tool requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// 🛡️ CSRF Protection
const csrf = require('csurf');
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Secure in production
    sameSite: process.env.RENDER === "true" ? "none" : "lax"
  }
});

// ✅ Apply CSRF globally but exempt Webhooks and Uploads
app.use((req, res, next) => {
  if (req.path.startsWith('/api/webhooks') || req.path.startsWith('/api/upload') || req.path === '/api/health') return next();
  csrfProtection(req, res, next);
});

// 🔑 CSRF Token Endpoint
app.get('/api/csrf-token', (req, res) => {
  try {
    res.json({ csrfToken: req.csrfToken() });
  } catch (err) {
    console.error("❌ CSRF Token Generation Failed:", err.message);
    res.status(500).json({ error: "CSRF Generation Error" });
  }
});



// ------------------------------------------------------------
// 🔐 AUTHENTICATION ROUTES
// ------------------------------------------------------------

// ✅ Debug Route for Session
app.get('/api/debug/session', (req, res) => {
  console.log("🔍 Debug Session Check:", req.session);
  res.json({
    user: req.session?.user || null,
    sessionID: req.sessionID,
    cookie: req.session?.cookie,
    fbConfigured: !!process.env.FB_APP_ID, // ✅ Check if FB keys are set
    baseUrl: process.env.API_BASE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5000" // ✅ Debug URL detection
  });
});

// ✅ Use centralized Auth Router (Strict Protection)
app.use("/api/auth", strictLimiter, require("./api/auth"));

// ------------------------------------------------------------
// ✅ Modular Routes (Posts, Uploads, etc.)
// ------------------------------------------------------------
// ✅ Enable Download Tools Only (Non-essential routes commented out for now)
const routeModules = [
  ["posts", "./routes/postRoutes"],
  ["posts/bulk", "./api/posts/bulk"],
  ["posts/schedule", "./api/posts/schedule"],
  ["posts/queue", "./api/posts/queue"],
  ["upload/video", "./api/upload/videoUpload"],
  ["upload/thumbnail", "./api/upload/uploadThumbnail"],
  ["upload/cover", "./api/upload/cover"],
  ["upload/avatar", "./api/upload/avatar"],
  // ["upload/error-log", "./api/upload/error-log"],
  ["upload/bot-image", "./api/upload/botImage"],
  ["bot", "./routes/bot"],
  ["tiktok", "./api/tiktok"], // Keep for downloader preview if needed
  ["user/pages", "./api/user/pages"],
  ["user/update", "./api/user/update"],
  ["user/stats", "./api/user/stats"],
  ["user/connections", "./api/user/connections"],
  ["analytics", "./api/analytics"],               
  ["tools/tiktok", "./api/tools/tiktok"],
  // ["auth/youtube", "./api/auth/youtube"], 
  // ["auth/tiktok", "./api/auth/tiktok"],   
  // ["auth/instagram", "./api/auth/instagram"], 
  ["tools/pinterest", "./api/tools/pinterest"],
  ["tools/youtube", "./api/tools/youtube"],
  ["webhooks/facebook", "./api/webhooks/facebook"], 
  ["tools/facebook", "./api/tools/facebook"],
  ["tools/instagram", "./api/tools/instagram"],
  ["tools/capcut", "./api/tools/capcut"],
  ["tools/threads", "./api/tools/threads"],
  ["tools/ecommerce", "./api/tools/ecommerce"],
  ["tools/document-converter", "./api/tools/document_converter"],
  ["tools/video-creator", "./api/tools/video_creator", toolLimiter],
  ["tools/script-writer", "./api/tools/script", toolLimiter],
  ["tools/thumbnail-generator", "./api/tools/thumbnail", toolLimiter],
  ["tools/magic-motion", "./api/tools/magic_motion", toolLimiter],
  ["tools/censorship", "./api/tools/censorship"],
  ["tools/label-swap", "./api/tools/label_swap"],
  ["tools/subtitle-generator", "./api/tools/subtitle"],
  ["tools/farm", "./api/tools/farm"],
  ["tools/telegram-cloud", "./api/tools/telegram_cloud"],
  ["tools/ai", "./api/tools/ai", toolLimiter], 
  ["debug", "./api/debug_python"],
];

for (const [route, file, limiter] of routeModules) {
  try {
    const mod = require(file);
    if (limiter) {
      app.use(`/api/${route}`, limiter, mod);
    } else {
      app.use(`/api/${route}`, mod);
    }
  } catch (err) {
    console.warn(`⚠️ Failed to load module ${file}:`, err.message);
  }
}

// ------------------------------------------------------------
// 📥 Download Controller (Forces Save As / IDM)
// ------------------------------------------------------------
app.get("/api/download", (req, res) => {
  const { file } = req.query;
  if (!file) return res.status(400).send("No file specified");

  // Security: Prevent path traversal
  const safeFile = path.basename(file);
  let filePath = path.join(__dirname, "temp", safeFile);

  // 🔄 Check specific subfolders if not found in root temp
  if (!fs.existsSync(filePath)) {
    const videoPath = path.join(__dirname, "temp", "videos", safeFile);
    if (fs.existsSync(videoPath)) {
      filePath = videoPath;
    }
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found or expired");
  }

  // Force download (Content-Disposition: attachment)
  res.download(filePath, safeFile, (err) => {
    if (err) {
      console.error("❌ Download Error:", err);
      if (!res.headersSent) res.status(500).send("Download failed");
    }
  });
});

// ------------------------------------------------------------
// ✅ Health Check
// ------------------------------------------------------------
app.get("/api/health", async (req, res) => {
  try {
    // const { mongoose } = require("./config/mongodb"); // REMOVED
    const dbStatus = "Connected (PostgreSQL)"; // Placeholder until real check is robust

    res.json({
      status: "OK",
      database: dbStatus,
      dbName: "postgres",
      time: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: "ERROR",
      database: "Disconnected",
      error: err.message,
    });
  }
});

// ------------------------------------------------------------
// ✅ Serve Frontend Build
// ------------------------------------------------------------
const distPath = path.join(__dirname, "../frontend/frontend/dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log("✅ Serving frontend from dist folder");
}

// ✅ Serve Temp Files (Required for TikTok Previews)
const tempPath = path.join(__dirname, "temp");
if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath, { recursive: true });
app.use("/uploads/temp", express.static(tempPath));
console.log("✅ Serving temp files from:", tempPath);

// ✅ SPA fallback
app.get("*", (req, res) => {
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).json({ error: "Frontend not built yet" });
});

// ------------------------------------------------------------
// 🧰 Global Error Handler
// ------------------------------------------------------------
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid or missing CSRF Token', code: 'CSRF_ERROR' });
  }

  console.error("💥 Global Error:", err.stack);
  if (err.message.includes("CORS")) {
    return res.status(500).json({ error: "CORS Error", details: err.message });
  }
  res.status(500).json({ error: "Internal Server Error", details: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
});

// ------------------------------------------------------------
// ✅ Scheduler & Bot Loop (Runs every 60 seconds)
// ------------------------------------------------------------
const { processScheduledPosts, cleanupOldPosts } = require("./utils/scheduler");
const botEngine = require("./utils/botEngine");


setInterval(() => {
  processScheduledPosts();

  // Run bot every ~2 minutes (odd minutes) to spread load
  if (new Date().getMinutes() % 2 !== 0) {
    botEngine.run();
  }

  // Run cleanup occasionally (e.g., 1% chance or separate interval)
  if (Math.random() < 0.05) cleanupOldPosts();
}, 60 * 1000);

// 🔄 Daily Token Refresh Check (Runs every 24 hours)
// const { checkAndRefreshTokens } = require("./utils/tokenRefresher");
/*
setInterval(() => {
  checkAndRefreshTokens();
}, 24 * 60 * 60 * 1000); // 24 hours
// Run once on startup to catch up
setTimeout(checkAndRefreshTokens, 10000);
*/

// 📊 Metrics Sync Scheduler (Disabled for Downloader Focus)
// const { startMetricsScheduler, startCampaignMetricsScheduler } = require("./utils/metricsScheduler");
// startMetricsScheduler();
// startCampaignMetricsScheduler();

// 🧹 Start Temp Cleaner (Runs every 5 mins, deletes files older than 15 mins)
const { startTempCleanupJob } = require("./utils/tempCleaner");
startTempCleanupJob();

// ------------------------------------------------------------
// ✅ Start Server
// ------------------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 EZA_POST Backend running on port ${PORT}`);
  console.log(`🌐 Mode: ${process.env.NODE_ENV || "development"}`);

  // 🔍 Debug Env Vars (Safe Log)
  console.log("🔍 Environment Check:");
  console.log("   👉 CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME ? "Set" : "Missing");
  console.log("   👉 CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY ? "Set" : "Missing");
  console.log("   👉 CLOUDINARY_API_SECRET:", process.env.CLOUDINARY_API_SECRET ? `Set (Starts with ${process.env.CLOUDINARY_API_SECRET.substring(0, 4)}...)` : "Missing");
  console.log(`    👉 JWT_SECRET: ${process.env.JWT_SECRET ? "Set" : "NOT SET"}`);
  console.log(`    👉 DATABASE_URL: ${process.env.DATABASE_URL ? "Set (Starts with " + process.env.DATABASE_URL.substring(0, 10) + "...)" : "NOT SET"}`);
});
