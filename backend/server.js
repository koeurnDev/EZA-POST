// ============================================================
// 🌐 EZA_POST BACKEND - FINAL PRODUCTION VERSION (Optimized + Modular Ready)
// ============================================================

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const { connectDB } = require("./config/mongodb");
const User = require("./models/User");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ------------------------------------------------------------
// ✅ Initialize Express
// ------------------------------------------------------------
const app = express();

// ------------------------------------------------------------
// ✅ MongoDB Connection
// ------------------------------------------------------------
connectDB();

// ------------------------------------------------------------
// ✅ Middleware & Security
// ------------------------------------------------------------
app.use(morgan("dev"));
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }, // ✅ Allow images to be loaded from different origin
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
const cookieParser = require("cookie-parser");
app.use(cookieParser());

// 🛡️ Security Middlewares
app.use(mongoSanitize()); // Prevent NoSQL Injection
app.use(xss()); // Prevent XSS
app.use(hpp()); // Prevent HTTP Parameter Pollution

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
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // In development, allow all localhost origins
      if (process.env.NODE_ENV !== "production" && origin.includes("localhost")) {
        return callback(null, true);
      }

      // Check against allowed origins
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // ✅ Allow all Vercel deployments (Preview & Production)
      if (origin.endsWith(".vercel.app")) return callback(null, true);

      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      return callback(new Error("CORS not allowed for this origin"));
    },
    credentials: true,
  })
);

// ✅ Trust Proxy (Required for Render/Heroku secure cookies)
app.set("trust proxy", 1);

// ✅ Session setup (stored in MongoDB)
app.use(
  session({
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/mongkul",
      collectionName: "sessions",
      ttl: 24 * 60 * 60, // 1 day in seconds
    }),
    secret: process.env.SESSION_SECRET || "eza_post_secret_key_2024",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production" || process.env.RENDER === "true", // ✅ Force Secure on Render
      httpOnly: true,
      sameSite: (process.env.NODE_ENV === "production" || process.env.RENDER === "true") ? "none" : "lax", // ✅ Force None on Render
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

// ✅ Rate limiting
app.use(
  "/api/",
  rateLimit({
    windowMs: 60 * 1000,
    max: 150,
    message: { error: "Too many requests. Please try again later." },
  })
);

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
app.use("/api/auth", require("./api/auth"));

// ------------------------------------------------------------
// ✅ Modular Routes (Posts, Uploads, etc.)
// ------------------------------------------------------------
const routeModules = [
  ["posts/create", "./api/posts/create"],
  ["posts/schedule", "./api/posts/schedule"],
  ["posts/queue", "./api/posts/queue"],
  ["upload/video", "./api/upload/videoUpload"],
  ["upload/thumbnail", "./api/upload/uploadThumbnail"],
  ["upload/cover", "./api/upload/cover"],
  ["upload/avatar", "./api/upload/avatar"], // ✅ Added
  ["error-log", "./api/upload/error-log"],
  ["bot", "./routes/bot"],
  ["tiktok", "./api/tiktok"],
  ["user/pages", "./api/user/pages"],
  ["user/update", "./api/user/update"],
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
// ✅ Health Check
// ------------------------------------------------------------
app.get("/api/health", async (req, res) => {
  try {
    const { mongoose } = require("./config/mongodb");
    const dbStatus = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";

    res.json({
      status: "OK",
      database: dbStatus,
      dbName: "mongkul",
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

// ✅ Serve Uploads Directory
const uploadsPath = path.join(__dirname, "uploads");
if (fs.existsSync(uploadsPath)) {
  app.use("/uploads", express.static(uploadsPath));
  console.log("✅ Serving uploads from:", uploadsPath);
} else {
  console.warn("⚠️ Uploads directory not found:", uploadsPath);
}

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
  console.error("💥 Global Error:", err.stack);
  res.status(500).json({ error: "Internal Server Error", details: err.message });
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

// ------------------------------------------------------------
// ✅ Start Server
// ------------------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 EZA_POST Backend running on port ${PORT}`);
  console.log(`🌐 Mode: ${process.env.NODE_ENV || "development"}`);
});
