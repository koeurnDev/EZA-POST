// ============================================================
// 🌐 MONEAA BACKEND (moneaa.site) - PRODUCTION VERSION
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
app.use(express.json({
  limit: "50mb",
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
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
  "https://moneaa.site",
  "https://www.moneaa.site",
  "https://eza-post-3kv.pages.dev",
  "https://eza-post.pages.dev",
  "https://ezapost.pages.dev",
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

      // ✅ Allow all Cloudflare Pages deployments (Preview & Production)
      if (origin.endsWith(".pages.dev")) return callback(null, true);

      console.warn(`⚠️ CORS blocked origin: '${origin}'`); // Log with quotes to see whitespace
      return callback(new Error(`CORS not allowed for this origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-csrf-token', 'X-CSRF-Token'],
    exposedHeaders: ['Content-Length', 'Cache-Control', 'X-CSRF-Token', 'Server-Timing'],
    maxAge: 86400, // ⚡ Cache CORS preflight for 24h (EZA-POST Spec: Reduces network round-trips)
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
  max: 100, // Increased from 20 to 100 to prevent 429 on /auth/status during normal use
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

// ✅ Apply CSRF globally but exempt Auth, Webhooks, Uploads, and Health
app.use((req, res, next) => {
  const exempt = [
    '/api/webhooks',
    '/api/upload',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/google',
    '/api/auth/google/callback',
    '/api/auth/logout',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/status',
    '/api/health',
  ];
  if (exempt.some(path => req.path.startsWith(path))) return next();
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
// ✅ Modular Routes (Active: Profile, Uploads, Auth | Paused: Posts, Bot, Downloaders)
// ------------------------------------------------------------
const routeModules = [
  // 🟢 Active Core Routes (Profile & Uploads)
  ["upload/cover", "./api/upload/cover"],
  ["upload/avatar", "./api/upload/avatar"],
  ["user/update", "./api/user/update"],
  ["user/stats", "./api/user/stats"],

  // ⏸️ Paused Features (Temporarily disabled to save server resources)
  // ["posts", "./routes/postRoutes"],
  // ["posts/bulk", "./api/posts/bulk"],
  // ["posts/schedule", "./api/posts/schedule"],
  // ["posts/queue", "./api/posts/queue"],
  // ["upload/video", "./api/upload/videoUpload"],
  // ["upload/thumbnail", "./api/upload/uploadThumbnail"],
  // ["upload/bot-image", "./api/upload/botImage"],
  // ["bot", "./routes/bot"],
  // ["tiktok", "./api/tiktok", toolLimiter],
  // ["user/pages", "./api/user/pages"],
  // ["user/connections", "./api/user/connections"],
  // ["analytics", "./api/analytics"],               
  // ["tools/tiktok", "./api/tools/tiktok", toolLimiter],
  // ["tools/pinterest", "./api/tools/pinterest", toolLimiter],
  // ["tools/youtube", "./api/tools/youtube", toolLimiter],
  // ["webhooks/facebook", "./api/webhooks/facebook"], 
  // ["tools/facebook", "./api/tools/facebook", toolLimiter],
  // ["tools/instagram", "./api/tools/instagram", toolLimiter],
  // ["tools/capcut", "./api/tools/capcut", toolLimiter],
  // ["tools/threads", "./api/tools/threads", toolLimiter],
  // ["tools/document-converter", "./api/tools/document_converter", toolLimiter],
  // ["page-cleaner", "./routes/pageCleanerRoutes"],
  // ["live-stream", "./routes/liveStreamRoutes"],
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
app.head("/api/health", (req, res) => {
  res.sendStatus(200);
});

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
  // ⚡ High-Performance Static Caching (EZA-POST Spec): Immutable 1-year cache for hashed JS/CSS chunks
  app.use(express.static(distPath, {
    maxAge: "1y",
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    }
  }));
  console.log("✅ Serving frontend from dist folder (High-speed caching enabled)");
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
// ⏸️ Background Loops & Schedulers (PAUSED to minimize CPU/RAM & DB Load)
// ------------------------------------------------------------
// const { processScheduledPosts, cleanupOldPosts } = require("./utils/scheduler");
// const botEngine = require("./utils/botEngine");

// ⏸️ Post scheduler & Bot loops paused
// setInterval(() => {
//   processScheduledPosts();
//   botEngine.run();
//   if (Math.random() < 0.05) cleanupOldPosts();
// }, 5 * 60 * 1000);

// setTimeout(() => botEngine.run(), 15000);

// setInterval(() => {
//   botEngine.processPendingReplies();
// }, 10 * 1000);

// ⏸️ Facebook Token Refresh & Metrics sync paused
// const { checkAndRefreshTokens } = require("./utils/tokenRefresher");
// setInterval(() => {
//   checkAndRefreshTokens();
// }, 24 * 60 * 60 * 1000);
// setTimeout(checkAndRefreshTokens, 10000);

// const { startMetricsScheduler, startCampaignMetricsScheduler } = require("./utils/metricsScheduler");
// startMetricsScheduler();
// startCampaignMetricsScheduler();

// 🧹 Start Temp Cleaner (Kept active: runs every 5 mins, deletes files older than 15 mins)
const { startTempCleanupJob } = require("./utils/tempCleaner");
startTempCleanupJob();

// ⏸️ BullMQ Background Worker paused
// require("./workers/postWorker");

// ------------------------------------------------------------
// ✅ Start Server
// ------------------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Moneaa Backend (moneaa.site) running on port ${PORT}`);
  console.log(`🌐 Mode: ${process.env.NODE_ENV || "development"}`);

  // 🔍 Debug Env Vars (Safe Log)
  console.log("🔍 Environment Check:");
  console.log("   👉 CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME ? "Set" : "Missing");
  console.log("   👉 CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY ? "Set" : "Missing");
  console.log("   👉 CLOUDINARY_API_SECRET:", process.env.CLOUDINARY_API_SECRET ? `Set (Starts with ${process.env.CLOUDINARY_API_SECRET.substring(0, 4)}...)` : "Missing");
  console.log(`    👉 JWT_SECRET: ${process.env.JWT_SECRET ? "Set" : "NOT SET"}`);
  console.log(`    👉 DATABASE_URL: ${process.env.DATABASE_URL ? "Set (Starts with " + process.env.DATABASE_URL.substring(0, 10) + "...)" : "NOT SET"}`);
});
