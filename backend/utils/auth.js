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

const router = express.Router();

// 🔑 JWT Config
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const JWT_EXPIRATION = "1d";
const FB_API_VERSION = "v21.0";

/* -------------------------------------------------------------------------- */
/* ✅ Generate JWT Token                                                      */
/* -------------------------------------------------------------------------- */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
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
/* ✅ Get User by ID from Database                                            */
/* -------------------------------------------------------------------------- */
async function getUserById(userId) {
  try {
    // console.log(`🔍 helper: getUserById searching for: ${userId}`);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      console.warn(`⚠️ getUserById: User not found in DB for ID: ${userId}`);
    }

    return user ? { id: user.id, email: user.email, name: user.name } : null;
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
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "none", // 🔴 CRITICAL: Must be 'none' for cross-site (Vercel -> Render)
    secure: true,     // 🔴 CRITICAL: Must be true if sameSite is 'none'
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });
  return token;
}

function clearAuthCookie(res) {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "none",
    secure: true,
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
  validateFacebookToken,
  getFacebookUserData,
  router, // ✅ export router for server.js
};

