const express = require("express");
const router = express.Router();
const axios = require("axios");
const User = require("../../models/User");

// ============================================================
// 📘 Facebook OAuth (Connect Account)
// ============================================================

const FB_APP_ID = process.env.FB_APP_ID;
const FB_APP_SECRET = process.env.FB_APP_SECRET;

// Determine Base URL (Handle Render, Vercel, or Localhost)
const BASE_URL =
    process.env.API_BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "http://localhost:5000";

// Must match exactly what's in Facebook App Settings
const CALLBACK_URL = `${BASE_URL.replace(/\/$/, "")}/api/auth/facebook/callback`;

/**
 * 🚀 GET /api/auth/facebook
 * Redirects user to Facebook Login dialog
 */
router.get("/", (req, res) => {
    if (!FB_APP_ID || !FB_APP_SECRET) {
        return res.status(500).json({ error: "Facebook App ID/Secret not configured." });
    }

    // Define permissions needed for Page management
    const scopes = [
        "public_profile",
        "email",
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "pages_manage_metadata",
    ];

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(
        CALLBACK_URL
    )}&scope=${scopes.join(",")}&state=connect_account`;

    console.log(`🔄 Redirecting to Facebook: ${authUrl}`);
    res.redirect(authUrl);
});

/**
 * ↩️ GET /api/auth/facebook/callback
 * Handles the callback from Facebook
 */
router.get("/callback", async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        console.error("❌ Facebook Auth Error:", error);
        return res.redirect(`${process.env.FRONTEND_URL}/settings?error=fb_auth_failed`);
    }

    if (!code) {
        return res.redirect(`${process.env.FRONTEND_URL}/settings?error=no_code`);
    }

    try {
        // 1️⃣ Exchange Code for Access Token
        const tokenRes = await axios.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            {
                params: {
                    client_id: FB_APP_ID,
                    client_secret: FB_APP_SECRET,
                    redirect_uri: CALLBACK_URL,
                    code,
                },
            }
        );

        const { access_token } = tokenRes.data;

        // 2️⃣ Get User Profile (to get ID)
        const profileRes = await axios.get("https://graph.facebook.com/me", {
            params: {
                access_token,
                fields: "id,name,email",
            },
        });

        const fbUser = profileRes.data;
        console.log(`✅ Facebook Connected: ${fbUser.name} (${fbUser.id})`);

        // 3️⃣ Find Current User (from Session)
        // NOTE: If session is lost, we might need to rely on a 'state' param that contains a session token,
        // but for now we assume cookie persistence works (SameSite=None).
        // If req.session.user is missing, we can't link it.

        // Fallback: If no session, check if we can find user by email (if email matches)
        // But for "Connect", we really need the logged-in user.

        let userId = req.session?.user?.id;

        if (!userId) {
            console.warn("⚠️ No session found in callback. Attempting to find user by email if available...");
            // This is risky for "Connect" but okay for "Login". 
            // Since we removed "Login", we strictly want "Connect".
            // If no session, fail.
            // return res.redirect(`${process.env.FRONTEND_URL}/settings?error=session_lost`);

            // DEBUG: For now, let's try to find a user if we are in dev mode or just fail.
            // Actually, let's check if the user exists with this FB ID, if so, maybe log them in?
            // But the requirement is "Connect".
        }

        if (userId) {
            // Update existing user
            await User.findByIdAndUpdate(userId, {
                facebookId: fbUser.id,
                facebookAccessToken: access_token,
                // facebookName: fbUser.name, // Optional
            });
        } else {
            // If we want to support "Login via Facebook" again in the future, we would create a user here.
            // For now, redirect with error if not logged in.
            console.error("❌ User not logged in during Facebook Connect callback.");
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=session_expired`);
        }

        // 4️⃣ Redirect back to Settings
        res.redirect(`${process.env.FRONTEND_URL}/settings?success=facebook_connected`);

    } catch (err) {
        console.error("❌ Facebook Callback Error:", err.response?.data || err.message);
        res.redirect(`${process.env.FRONTEND_URL}/settings?error=server_error`);
    }
});

module.exports = router;
