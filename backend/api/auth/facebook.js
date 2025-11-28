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
    console.log("🔍 Debug FB Auth:");
    console.log("   👉 FB_APP_ID:", !!FB_APP_ID ? "Set" : "Missing");
    console.log("   👉 FB_APP_SECRET:", !!FB_APP_SECRET ? "Set" : "Missing");

    if (!FB_APP_ID || !FB_APP_SECRET) {
        return res.status(500).json({
            error: "Facebook App ID/Secret not configured on server.",
            details: `Missing: ${!FB_APP_ID ? 'FB_APP_ID' : ''} ${!FB_APP_SECRET ? 'FB_APP_SECRET' : ''}`.trim()
        });
    }

    // Define permissions needed for Page management
    // Reduced to minimum to avoid "Invalid Scopes" error for Consumer apps
    const scopes = [
        "public_profile",
        "email",
        "pages_show_list",
        "pages_manage_posts",
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
        let userId = req.session?.user?.id;

        if (!userId) {
            console.warn("⚠️ No session found in callback. Attempting to find user by email if available...");
        }

        if (userId) {
            // 3️⃣ Fetch User's Pages (Immediate Save)
            const pagesRes = await axios.get("https://graph.facebook.com/v19.0/me/accounts", {
                params: {
                    access_token,
                    fields: "id,name,access_token,picture{url},category",
                    limit: 100
                }
            });

            const myPages = pagesRes.data.data.map(p => ({
                id: p.id,
                name: p.name,
                access_token: p.access_token,
                picture: p.picture?.data?.url,
                category: p.category
            }));

            console.log(`✅ Fetched & Saved ${myPages.length} pages for ${fbUser.name}`);

            // Update existing user (Use find + save to trigger pre-save hooks for encryption)
            const user = await User.findById(userId);
            if (user) {
                user.facebookId = fbUser.id;
                user.facebookAccessToken = access_token;
                user.facebookName = fbUser.name;
                user.connectedPages = myPages;
                await user.save();
            }
        } else {
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

/**
 * 🔌 DELETE /api/auth/facebook
 * Disconnects the user's Facebook account
 */
router.delete("/", async (req, res) => {
    if (!req.session?.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        await User.findByIdAndUpdate(req.session.user.id, {
            $unset: {
                facebookId: "",
                facebookAccessToken: "",
                facebookName: "",
                connectedPages: "",
                pageSettings: "",
                selectedPages: ""
            }
        });

        // Update session
        if (req.session.user) {
            delete req.session.user.facebookId;
            delete req.session.user.facebookName;
        }

        res.json({ success: true, message: "Facebook account disconnected." });
    } catch (err) {
        console.error("❌ Disconnect Error:", err);
        res.status(500).json({ error: "Failed to disconnect account." });
    }
});

module.exports = router;
