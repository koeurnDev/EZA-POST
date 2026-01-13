const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../../models/User");

// ============================================================
// ✅ GET /api/auth/status
// ============================================================
router.get("/", async (req, res) => {
  try {
    let user = null;
    let authenticated = false;

    // ✅ 1. Try to verify session-based login
    if (req.session?.userId) {
      const foundUser = await User.findOne({ id: req.session.userId }).select(
        "id email name facebookId facebookName avatar connectedPages"
      );
      if (foundUser) {
        user = {
          id: foundUser.id,
          email: foundUser.email,
          name: foundUser.name,
          facebookId: foundUser.facebookId,
          facebookName: foundUser.facebookName,
          avatar: foundUser.avatar,
          connectedPages: foundUser.connectedPages,
        };
        // Add isDemo flag for demo user
        if (user.id === "demo_user_001") {
          user.isDemo = true;
        }
        authenticated = true;
      }
    }

    // ✅ 2. If no session, try JWT token from Cookie or Headers
    else if (req.cookies?.token || req.headers.authorization) {
      try {
        let token = req.cookies?.token;
        if (!token && req.headers.authorization) {
          token = req.headers.authorization.replace("Bearer ", "");
        }

        if (token) {
          console.log("🔍 Verifying Token:", token.substring(0, 10) + "...");
          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "supersecretkey"
          );
          console.log("✅ Token Verified. User ID:", decoded.id);

          // Fetch fresh user data from DB
          const foundUser = await User.findOne({ id: decoded.id }).select(
            "id email name facebookId facebookName avatar connectedPages"
          );

          if (foundUser) {
            user = {
              id: foundUser.id,
              email: foundUser.email,
              name: foundUser.name,
              facebookId: foundUser.facebookId,
              facebookName: foundUser.facebookName,
              avatar: foundUser.avatar,
              connectedPages: foundUser.connectedPages,
            };
            authenticated = true;
          } else {
            console.warn("⚠️ User found in token but not in DB");
          }
        } else {
          console.log("⚠️ No token found in cookie or header");
        }
      } catch (err) {
        console.warn("⚠️ Invalid JWT:", err.message);
      }
    } else {
      console.log("⚠️ No session or token found for request");
    }

    // ✅ Respond with user data or not authenticated
    res.json({ authenticated, user });
  } catch (err) {
    console.error("❌ Auth status error:", err.message);
    // If DB is down, return not authenticated instead of 500 to prevent frontend crash
    res.json({
      authenticated: false,
      user: null,
      error: "Auth check failed (likely DB connection)",
    });
  }
});

module.exports = router;
