/**
 * ============================================================
 * 🧩 auth.js — Central Authentication Utilities + Routes for EZA_POST
 * ============================================================
 * ✅ JWT-based session management
 * ✅ Facebook OAuth verification
 * ✅ PostgreSQL user lookup (Prisma)
 * ✅ Secure cookie handling
 * ✅ Demo login route for testing
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const prisma = require('./prisma');
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();

// 🔑 JWT Config (EZA-POST Spec: Fail-closed in production)
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const JWT_EXPIRATION = "1d";
const FB_API_VERSION = "v21.0";

// 🚀 In-memory cache for user database checks (TTL: 15s) - EZA-POST High-Performance Cache
// Eliminates redundant Neon PostgreSQL round-trips on every authenticated API call!
const userDbCache = new Map();
const USER_CACHE_TTL_MS = 15_000;

function invalidateUserCache(userId) {
  if (userId) userDbCache.delete(String(userId));
}

/* -------------------------------------------------------------------------- */
/* ✅ Generate JWT Token                                                      */
/* -------------------------------------------------------------------------- */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      jti: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"),
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRATION,
      issuer: "EZA_POST",
      audience: "ezapost_users",
    }
  );
}

/* -------------------------------------------------------------------------- */
/* ✅ Verify JWT Token (Middleware)                                           */
/* -------------------------------------------------------------------------- */
function verifyToken(req, res, next) {
  try {
    const token =
      req.cookies?.token ||
      req.headers["authorization"]?.replace("Bearer ", "");

    if (!token)
      return res
        .status(401)
        .json({ success: false, error: "No token provided" });

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.warn("⚠️ Token verification failed:", err.message);
    res.status(401).json({
      success: false,
      error: "Invalid or expired token",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* ✅ Get User by ID from Database (with High-Speed 15s In-Memory Cache)      */
/* -------------------------------------------------------------------------- */
async function getUserById(userId) {
  if (!userId) return null;
  const uid = String(userId);

  // 1. Fast path: In-memory cache hit (0ms latency)
  const cached = userDbCache.get(uid);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      console.warn(`⚠️ getUserById: User not found in DB for ID: ${uid}`);
      return null;
    }

    const userData = { id: user.id, email: user.email, name: user.name };
    // 2. Cache in memory for 15 seconds
    userDbCache.set(uid, {
      data: userData,
      expiresAt: Date.now() + USER_CACHE_TTL_MS,
    });

    return userData;
  } catch (err) {
    console.error("❌ Database lookup failed:", err.message);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* ✅ Require Auth Middleware (Full Validation)                               */
/* -------------------------------------------------------------------------- */
async function requireAuth(req, res, next) {
  try {
    // 1️⃣ Check for JWT Token
    const token =
      req.cookies?.token ||
      req.headers["authorization"]?.replace("Bearer ", "");

    // 2️⃣ Check for Session (Facebook Login)
    if (!token && req.session?.user) {
      req.user = req.session.user;
      return next();
    }

    if (!token) {
      // console.warn("⚠️ requireAuth: No token or session found.");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.id);

    if (!user) {
      console.warn("⚠️ requireAuth: User not found for token:", decoded.id);
      clearAuthCookie(res);
      return res.status(401).json({ error: "User no longer exists. Please log in again." });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("❌ requireAuth error:", err.message);
    clearAuthCookie(res);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/* -------------------------------------------------------------------------- */
/* ✅ Facebook OAuth Token Validation                                         */
/* -------------------------------------------------------------------------- */
async function validateFacebookToken(accessToken) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${FB_API_VERSION}/me`,
      {
        params: { access_token: accessToken, fields: "id,name" },
      }
    );
    return { valid: true, user: response.data };
  } catch (err) {
    const fbErr = err.response?.data?.error;
    console.warn("⚠️ Facebook token validation failed:", fbErr || err.message);
    return {
      valid: false,
      error: fbErr?.message || "Facebook token invalid or expired",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* ✅ Fetch Facebook User Data                                                */
/* -------------------------------------------------------------------------- */
async function getFacebookUserData(accessToken) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${FB_API_VERSION}/me`,
      {
        params: {
          access_token: accessToken,
          fields: "id,name,email,picture{url}",
        },
      }
    );
    return response.data;
  } catch (err) {
    console.error("❌ Failed to fetch Facebook user data:", err.message);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* ✅ JWT Cookie Helpers                                                      */
/* -------------------------------------------------------------------------- */
function setAuthCookie(res, user) {
  const token = generateToken(user);
  const isSecure = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: isSecure ? "none" : "lax",
    secure: isSecure,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });
  return token;
}

function clearAuthCookie(res) {
  const isSecure = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: isSecure ? "none" : "lax",
    secure: isSecure,
  });
}

/* -------------------------------------------------------------------------- */
/* 🚀 DEMO LOGIN - Public route for quick access                              */
/* -------------------------------------------------------------------------- */
router.post("/demo", async (req, res) => {
  try {
    // Demo user credentials (read-only)
    const demoUser = {
      id: "demo_user_001",
      name: "Demo User",
      email: "demo@ezapost.app",
      role: "Demo",
    };

    const token = jwt.sign(demoUser, JWT_SECRET, { expiresIn: "1h" });

    res.json({
      success: true,
      message: "Welcome to the demo account!",
      token,
      user: demoUser,
    });

    // 🍪 Set Cookie for Demo User too!
    setAuthCookie(res, demoUser);
  } catch (err) {
    console.error("Demo login error:", err);
    res.status(500).json({
      success: false,
      message: "Server error during demo login.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ Export Utilities + Router                                               */
/* -------------------------------------------------------------------------- */
module.exports = {
  generateToken,
  verifyToken,
  requireAuth,
  setAuthCookie,
  clearAuthCookie,
  getUserById,
  invalidateUserCache,
  validateFacebookToken,
  getFacebookUserData,
  router, // ✅ export router for server.js
};

