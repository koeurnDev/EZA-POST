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
// app.use(express.json()); // REMOVED DUPLICATE
// app.use(cookieParser(process.env.SESSION_SECRET || "eza_post_secret_key_2024")); 
// Simplified Session (MemoryStore for now, ideally Redis or Postgres Store later)
app.use(cookieParser(process.env.SESSION_SECRET || "eza_post_secret_key_2024"));

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

// ✅ Session setup (MemoryStore for migration simplicity)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "eza_post_secret_key_2024",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.RENDER === "true",
      httpOnly: true,
      sameSite: process.env.RENDER === "true" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ... [Keep Rate Limit, CSRF, etc.] ...

// ✅ Health Check
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`; // Simple query to check connection
    res.json({
      status: "OK",
      database: "Connected (PostgreSQL)",
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
    secret: process.env.SESSION_SECRET || "eza_post_secret_key_2024",
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

// ✅ Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: { error: "Too many requests. Please try again later." },
  })
);

// 🛡️ CSRF Protection
const csrf = require('csurf');
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Secure in production
    sameSite: process.env.RENDER === "true" ? "none" : "lax"
  }
});

// ✅ Apply CSRF globally but exempt Webhooks
app.use((req, res, next) => {
  if (req.path.startsWith('/api/webhooks')) return next();
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
    loggedIn: !!req.session?.user,
    user: req.session?.user || null,
    sessionID: req.sessionID,
    user: req.session?.user || null,
    sessionID: req.sessionID,
    cookie: req.session?.cookie,
    fbConfigured: !!process.env.FB_APP_ID, // ✅ Check if FB keys are set
    baseUrl: process.env.API_BASE_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5000" // ✅ Debug URL detection
  });
});

// ✅ Use centralized Auth Router
// ✅ Use centralized Auth Router
app.use("/api/auth", require("./api/auth"));

// ------------------------------------------------------------
// ✅ Modular Routes (Posts, Uploads, etc.)
// ------------------------------------------------------------
// ✅ Enable Download Tools Only (Non-essential routes commented out for now)
const routeModules = [
  // ["posts", "./routes/postRoutes"],
  // ["posts/bulk", "./api/posts/bulk"],
  // ["posts/schedule", "./api/posts/schedule"],
  // ["posts/queue", "./api/posts/queue"],
  // ["upload/video", "./api/upload/videoUpload"],
  // ["upload/thumbnail", "./api/upload/uploadThumbnail"],
  ["upload/cover", "./api/upload/cover"],
  ["upload/avatar", "./api/upload/avatar"],
  // ["upload/error-log", "./api/upload/error-log"],
  // ["upload/bot-image", "./api/upload/botImage"],
  // ["bot", "./routes/bot"],
  ["tiktok", "./api/tiktok"], // Keep for downloader preview if needed
  ["user/pages", "./api/user/pages"],
  ["user/update", "./api/user/update"],
  ["user/stats", "./api/user/stats"],
  ["user/connections", "./api/user/connections"],
  // ["analytics", "./api/analytics"],               
  ["tools/tiktok", "./api/tools/tiktok"],
  // ["auth/youtube", "./api/auth/youtube"], 
  // ["auth/tiktok", "./api/auth/tiktok"],   
  // ["auth/instagram", "./api/auth/instagram"], 
  ["tools/pinterest", "./api/tools/pinterest"],
  ["tools/youtube", "./api/tools/youtube"],
  // ["webhooks/facebook", "./api/webhooks/facebook"], 
  ["tools/facebook", "./api/tools/facebook"],
  ["tools/instagram", "./api/tools/instagram"],
  ["tools/capcut", "./api/tools/capcut"],
  ["tools/ecommerce", "./api/tools/ecommerce"],
  // ["boost/campaigns", "./api/boost/campaigns"], 
  ["debug", "./api/debug_python"],
];

for (const [route, file] of routeModules) {
  try {
    const mod = require(file);
    app.use(`/api/${route}`, mod);
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
// const botEngine = require("./utils/botEngine");
// const boostEngine = require("./utils/boostEngine");

/*
setInterval(() => {
  processScheduledPosts();

  // Run bot every ~2 minutes (odd minutes) to spread load
 
  if (new Date().getMinutes() % 2 !== 0) {
    botEngine.run();
  }

  // Run boost engine every 30 minutes
  if (new Date().getMinutes() % 30 === 0) {
    boostEngine.run();
  }
 

  // Run cleanup occasionally (e.g., 1% chance or separate interval)
  if (Math.random() < 0.05) cleanupOldPosts();
}, 60 * 1000);
*/

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
  console.log("   👉 JWT_SECRET:", process.env.JWT_SECRET ? "Set" : "Using Default");
});
