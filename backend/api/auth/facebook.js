const express = require("express");
const router = express.Router();
const axios = require("axios");
const jwt = require("jsonwebtoken");
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
        "pages_read_engagement",
        "pages_messaging",
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

    console.log("📥 FB Callback received");

    if (error) {
        console.error("❌ Facebook Auth Error (from Query):", error);
        return res.redirect(`${process.env.FRONTEND_URL}/settings?error=fb_auth_failed`);
    }

    if (!code) {
        console.error("❌ No code received in callback");
        return res.redirect(`${process.env.FRONTEND_URL}/settings?error=no_code`);
    }

    try {
        // 1️⃣ Exchange Code for Access Token
        console.log("🔄 Step 1: Exchanging code for short-lived token...");
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
        const { access_token: shortLivedToken } = tokenRes.data;
        console.log("✅ Short-lived token obtained");

        // 1.5️⃣ Exchange for Long-Lived Token
        console.log("🔄 Step 1.5: Exchanging for long-lived token...");
        const longLivedTokenRes = await axios.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            {
                params: {
                    grant_type: "fb_exchange_token",
                    client_id: FB_APP_ID,
                    client_secret: FB_APP_SECRET,
                    fb_exchange_token: shortLivedToken,
                },
            }
        );
        const { access_token, expires_in } = longLivedTokenRes.data;
        console.log("✅ Long-lived token obtained");

        // Calculate Expiration
        const expiresInSeconds = expires_in || 5184000; // 60 days
        const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

        // 2️⃣ Get User Profile
        console.log("🔄 Step 2: Fetching user profile...");
        const profileRes = await axios.get("https://graph.facebook.com/me", {
            params: {
                access_token,
                fields: "id,name,email",
            },
        });
        const fbUser = profileRes.data;
        console.log(`✅ Facebook Profile: ${fbUser.name} (${fbUser.id})`);

        // 3️⃣ Find Current User
        console.log("🔄 Step 3: Identifying local user...");
        let userId = req.session?.user?.id;

        if (!userId && req.cookies?.token) {
            try {
                const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET || "supersecretkey");
                userId = decoded.id;
                console.log(`✅ User identified via JWT: ${userId}`);
            } catch (err) {
                console.warn("⚠️ Invalid JWT:", err.message);
            }
        }

        if (!userId) {
            console.error("❌ No authenticated user found (Session or JWT missing)");
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=session_expired`);
        }

        // 4️⃣ Fetch Pages
        console.log("🔄 Step 4: Fetching Facebook Pages...");
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
        console.log(`✅ Fetched ${myPages.length} pages`);

        // 5️⃣ Update Database
        console.log(`🔄 Step 5: Updating User ${userId} in DB...`);
        const user = await User.findById(userId);
        if (user) {
            user.facebookId = fbUser.id;
            user.facebookAccessToken = access_token;
            user.facebookTokenExpiresAt = expiresAt;
            user.facebookName = fbUser.name;
            user.connectedPages = myPages;

            await user.save();
            console.log("✅ Database update successful");
        } else {
            console.error(`❌ User ID ${userId} not found in DB`);
            throw new Error("User not found in database");
        }

        // 6️⃣ Refresh JWT
        console.log("🔄 Step 6: Refreshing JWT...");
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                name: user.name
            },
            process.env.JWT_SECRET || "supersecretkey",
            { expiresIn: "1d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production" || process.env.RENDER === "true",
            sameSite: process.env.NODE_ENV === "production" || process.env.RENDER === "true" ? "none" : "lax",
            maxAge: 24 * 60 * 60 * 1000
        });

        console.log("✅ Callback complete. Redirecting...");
        res.redirect(`${process.env.FRONTEND_URL}/settings?success=facebook_connected`);

    } catch (err) {
        console.error("❌ CRITICAL FAILURE IN FB CALLBACK ❌");
        if (err.response) {
            console.error("👉 API Error Status:", err.response.status);
            console.error("👉 API Error Data:", JSON.stringify(err.response.data, null, 2));
        } else {
            console.error("👉 Error Message:", err.message);
            console.error("👉 Stack:", err.stack);
        }
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
