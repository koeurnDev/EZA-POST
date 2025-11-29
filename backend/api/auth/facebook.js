const express = require("express");
const router = express.Router();
const axios = require("axios");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const FacebookPage = require("../../models/FacebookPage");

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
    const scopes = [
        "public_profile",
        "email",
        "pages_show_list",
        "pages_manage_posts",
        "pages_read_engagement",
        "pages_messaging",
        "pages_manage_metadata",
        "pages_read_user_content",
        "publish_video",
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

    // Helper variable to track failure step for better logging
    let currentStep = "Start";

    try {
        // 1️⃣ Exchange Code for Access Token
        currentStep = "ExchangeCode";
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
        if (!shortLivedToken) throw new Error("FB did not return a short-lived token.");
        console.log("✅ Short-lived token obtained");

        // 1.5️⃣ Exchange for Long-Lived Token
        currentStep = "ExchangeLongLived";
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
        if (!access_token) throw new Error("FB did not return a long-lived token.");
        console.log("✅ Long-lived token obtained");

        // Calculate Expiration
        const expiresInSeconds = expires_in || 5184000; // 60 days
        const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

        // 2️⃣ Get User Profile
        currentStep = "FetchProfile";
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
        currentStep = "FindLocalUser";
        console.log("🔄 Step 3: Identifying local user...");
        let userId = req.session?.user?.id;

        if (!userId && req.cookies?.token) {
            try {
                // NOTE: Using the fallback key here is a potential source of error if JWT_SECRET is inconsistent
                const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET || "supersecretkey");
                userId = decoded.id;
                console.log(`✅ User identified via JWT: ${userId}`);
            } catch (err) {
                console.warn("⚠️ Invalid JWT (Session may have expired or JWT_SECRET mismatch):", err.message);
            }
        }

        if (!userId) {
            console.error("❌ No authenticated user found (Session or JWT missing)");
            // Redirect to login, not server_error
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=session_expired`);
        }

        // 4️⃣ Fetch Pages
        currentStep = "FetchPages";
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
        currentStep = "UpdateDB";
        console.log(`🔄 Step 5: Updating User ${userId} in DB...`);
        // FIX: Use findOne({ id: userId }) instead of findById(userId) because userId is a custom string, not an ObjectId
        const user = await User.findOne({ id: userId });
        if (user) {
            user.facebookId = fbUser.id;
            user.facebookAccessToken = access_token;
            user.facebookTokenExpiresAt = expiresAt;
            user.facebookName = fbUser.name;
            user.connectedPages = myPages; // ⚠️ Legacy Support (Keep for now)

            await user.save();

            // ✅ Save to FacebookPage Model (New Architecture)
            console.log("🔄 Syncing pages to FacebookPage collection...");
            for (const p of myPages) {
                try {
                    let fbPage = await FacebookPage.findOne({ userId: userId, pageId: p.id });
                    if (!fbPage) {
                        fbPage = new FacebookPage({
                            userId: userId,
                            pageId: p.id
                        });
                    }
                    fbPage.pageName = p.name;
                    fbPage.pageAccessToken = p.access_token; // 🔒 Will be encrypted by pre-save hook
                    fbPage.pictureUrl = p.picture;
                    fbPage.updatedAt = new Date();

                    await fbPage.save();
                } catch (pageErr) {
                    console.error(`❌ Failed to save page ${p.name}:`, pageErr.message);
                }
            }
            console.log("✅ Database update successful");
        } else {
            console.error(`❌ User ID ${userId} not found in DB`);
            throw new Error("User not found in database");
        }

        const { setAuthCookie } = require("../../utils/auth"); // Import helper

        // 6️⃣ Refresh JWT
        currentStep = "RefreshJWT";
        console.log("🔄 Step 6: Refreshing JWT...");

        // Use the centralized helper to ensure consistent cookie attributes
        setAuthCookie(res, {
            id: user.id,
            email: user.email,
            name: user.name
        });

        console.log("✅ Callback complete. Redirecting...");
        res.redirect(`${process.env.FRONTEND_URL}/settings?success=facebook_connected`);

    } catch (err) {
        console.error("❌ CRITICAL FAILURE IN FB CALLBACK ❌");
        console.error(`🚨 Error occurred at Step: ${currentStep}`);

        if (currentStep === "FetchPages" && err.response?.status === 400) {
            console.error(" Likely Cause: Missing `pages_show_list` permission (user declined in the dialog).");
        } else if (currentStep === "UpdateDB" && err.name === 'ValidationError') {
            console.error("🛑 Likely Cause: Mongoose Validation Error. Check User model schema for 'connectedPages'.");
            console.error("👉 Validation Errors:", err.errors);
        }

        if (err.response) {
            console.error("👉 API Error Status:", err.response.status);
            console.error("👉 API Error Data:", JSON.stringify(err.response.data, null, 2));
        } else {
            console.error("👉 Error Message:", err.message);
            // Log stack trace for non-API errors (like Mongoose or coding errors)
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
    // NOTE: This delete route relies on req.session.user.id, which might be stale.
    // You should rely on JWT data (req.user.id, if using an auth middleware) or req.cookies.token.
    // Assuming you have middleware that puts user on req.session for consistency:
    if (!req.session?.user?.id) {
        // Fallback check using JWT from cookies (similar to step 3 in callback)
        let userId = null;
        if (req.cookies?.token) {
            try {
                const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET || "supersecretkey");
                userId = decoded.id;
            } catch (err) {
                console.warn("⚠️ Invalid JWT on Disconnect:", err.message);
            }
        }
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized or session expired." });
        }
        req.session = req.session || {};
        req.session.user = { id: userId };
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

        // ✅ Also remove FacebookPage entries
        await FacebookPage.deleteMany({ userId: req.session.user.id });

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
