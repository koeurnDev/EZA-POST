// ============================================================
// 🔴 Google Authentication Router (Google Sign-In & One Tap)
// ============================================================

const express = require("express");
const router = express.Router();
const axios = require("axios");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const prisma = require("../../utils/prisma");
const { generateToken, setAuthCookie } = require("../../utils/auth");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

const BASE_URL =
  process.env.API_BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  "http://localhost:3001";

const CALLBACK_URL = (process.env.NODE_ENV === "development" && process.env.FRONTEND_URL)
  ? `${process.env.FRONTEND_URL.replace(/\/$/, "")}/api/auth/google/callback`
  : `${BASE_URL.replace(/\/$/, "")}/api/auth/google/callback`;

/**
 * 🚀 GET /api/auth/google
 * Standard OAuth redirect
 */
router.get("/", (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({
      error: "Google Sign-In is not configured yet. Please configure GOOGLE_CLIENT_ID in settings.",
    });
  }

  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options = {
    redirect_uri: CALLBACK_URL,
    client_id: GOOGLE_CLIENT_ID,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
  };

  const qs = new URLSearchParams(options);
  res.redirect(`${rootUrl}?${qs.toString()}`);
});

/**
 * ↩️ GET /api/auth/google/callback
 * Google OAuth Callback
 */
router.get("/callback", async (req, res) => {
  const { code, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || "https://eza-post-3kv.pages.dev";

  if (error || !code) {
    console.error("❌ Google Auth Callback Error:", error || "Missing code");
    return res.redirect(`${frontendUrl}/login?error=google_auth_failed`);
  }

  try {
    // 1. Exchange authorization code for tokens
    const tokenResponse = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: CALLBACK_URL,
      grant_type: "authorization_code",
    });

    const { id_token, access_token } = tokenResponse.data;

    // 2. Fetch user profile
    const profileResponse = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { sub: googleId, email, name, picture } = profileResponse.data;
    if (!email) throw new Error("Google did not provide an email address.");

    // 3. Find or create user in Prisma
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email: email.toLowerCase() }],
      },
    });

    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: name || "Google User",
          password: hashedPassword,
          googleId,
          googleEmail: email.toLowerCase(),
          avatar: picture || null,
        },
      });
      console.log(`🎉 New user registered via Google OAuth: ${user.id} (${user.email})`);
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, googleEmail: email.toLowerCase(), avatar: user.avatar || picture },
      });
    }

    // 4. Generate token and set auth cookie
    const token = generateToken(user);
    setAuthCookie(res, user);

    return res.redirect(`${frontendUrl}/post?login=success&token=${token}`);
  } catch (err) {
    console.error("❌ Google callback exchange failed:", err.message);
    return res.redirect(`${frontendUrl}/login?error=google_exchange_failed`);
  }
});

/**
 * 🔑 POST /api/auth/google
 * Google One Tap / GIS Credential Verification
 */
router.post("/", async (req, res) => {
  const { credential } = req.body || {};
  if (!credential) {
    return res.status(400).json({ error: "Google credential ID token is required." });
  }

  try {
    // Verify credential with Google tokeninfo endpoint
    const tokenInfoRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const { sub: googleId, email, name, picture, email_verified } = tokenInfoRes.data;

    if (!email) {
      return res.status(400).json({ error: "No email associated with this Google account." });
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email: email.toLowerCase() }],
      },
    });

    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: name || "Google User",
          password: hashedPassword,
          googleId,
          googleEmail: email.toLowerCase(),
          avatar: picture || null,
        },
      });
      console.log(`🎉 New user registered via Google One Tap: ${user.id} (${user.email})`);
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, googleEmail: email.toLowerCase(), avatar: user.avatar || picture },
      });
    }

    const token = generateToken(user);
    setAuthCookie(res, user);

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plan: user.plan,
      avatar: user.avatar,
    };

    return res.json({
      success: true,
      message: "ចូលគណនីជាមួយ Google បានជោគជ័យ!",
      user: safeUser,
      token,
    });
  } catch (err) {
    console.error("❌ Google credential verification failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired Google credential." });
  }
});

module.exports = router;
