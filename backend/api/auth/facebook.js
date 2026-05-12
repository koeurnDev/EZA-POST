const express = require("express");
const router = express.Router();
const axios = require("axios");
const jwt = require("jsonwebtoken");
const prisma = require("../../utils/prisma");
const { encrypt } = require("../../utils/crypto");
const { setAuthCookie } = require("../../utils/auth");

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

    // console.log(`🔄 Redirecting to Facebook: ${authUrl}`);
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
        // console.log("🔄 Step 1: Exchanging code for short-lived token...");
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

        // 1.5️⃣ Exchange for Long-Lived Token
        currentStep = "ExchangeLongLived";
        // console.log("🔄 Step 1.5: Exchanging for long-lived token...");
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

        // Calculate Expiration
        const expiresInSeconds = expires_in || 5184000; // 60 days
        const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

        // 2️⃣ Get User Profile
        currentStep = "FetchProfile";
        // console.log("🔄 Step 2: Fetching user profile...");
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
        let userId = req.session?.user?.id;

        if (!userId && req.cookies?.token) {
            try {
                const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET || "supersecretkey");
                userId = decoded.id;
            } catch (err) { }
        }

        if (!userId) {
            console.error("❌ No authenticated user found (Session or JWT missing)");
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=session_expired`);
        }

        // 4️⃣ Fetch Pages
        currentStep = "FetchPages";
        // console.log("🔄 Step 4: Fetching Facebook Pages...");
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

        // 5️⃣ Update Database
        currentStep = "UpdateDB";
        console.log(`🔄 Step 5: Updating User ${userId} in DB...`);

        const user = await prisma.user.findUnique({ where: { id: userId } });
        
        if (user) {
            // 🔍 CHECK FOR DUPLICATE FB ID (Account Takeover Logic)
            // If another user already has this facebookId, disconnect them first to prevent Prisma error
            const existingOwner = await prisma.user.findFirst({
                where: { 
                    facebookId: fbUser.id,
                    id: { not: userId } // Not the current user
                }
            });

            if (existingOwner) {
                console.log(`⚠️ ACCOUNT TAKEOVER: FB ID ${fbUser.id} was linked to user ${existingOwner.id}. Disconnecting old link...`);
                await prisma.user.update({
                    where: { id: existingOwner.id },
                    data: {
                        facebookId: null,
                        facebookAccessToken: null,
                        facebookName: null,
                        connectedPages: []
                    }
                });
                
                // Also remove their pages from the FacebookPage table
                await prisma.facebookPage.deleteMany({ where: { userId: existingOwner.id } });
            }

            // Update User Profile with FB details
            await prisma.user.update({
                where: { id: userId },
                data: {
                    facebookId: fbUser.id,
                    facebookAccessToken: encrypt(access_token), // 🔒 Encrypted!
                    facebookTokenExpiresAt: expiresAt,
                    facebookName: fbUser.name,
                    // Store pages without access_tokens as a backup, 
                    // real tokens are in FacebookPage table
                    connectedPages: myPages.map(p => ({ ...p, access_token: undefined })) 
                }
            });

            // Sync to FacebookPage Table
            console.log("🔄 Syncing pages to FacebookPage table...");
            for (const p of myPages) {
                try {
                    // Check if page exists (upsert logic manually to handle explicit updates)
                    const existingPage = await prisma.facebookPage.findFirst({
                        where: { userId: userId, id: p.id }
                    });

                    const pageData = {
                        userId: userId,
                        id: p.id,
                        name: p.name,
                        accessToken: encrypt(p.access_token), // 🔒 Encrypt!
                        picture: p.picture,
                        category: p.category,
                        isConnected: true,
                        updatedAt: new Date()
                    };

                    if (existingPage) {
                        await prisma.facebookPage.update({
                            where: { id: p.id }, // ID is unique per page globally usually, but standard here is page ID
                            data: pageData
                        });
                    } else {
                        await prisma.facebookPage.create({
                            data: pageData
                        });
                    }

                } catch (pageErr) {
                    console.error(`❌ Failed to save page ${p.name}:`, pageErr.message);
                }
            }
            console.log("✅ Database update successful");
        } else {
            console.error(`❌ User ID ${userId} not found in DB`);
            throw new Error("User not found in database");
        }

        // 6️⃣ Refresh JWT
        currentStep = "RefreshJWT";

        const token = setAuthCookie(res, {
            id: user.id,
            email: user.email,
            name: user.name
        });
        
        // Pass token in URL for cross-domain localStorage sync (optional but helpful)
        res.redirect(`${process.env.FRONTEND_URL}/settings?success=facebook_connected&token=${token}`);

    } catch (err) {
        console.error("❌ CRITICAL FAILURE IN FB CALLBACK ❌");

        if (currentStep === "FetchPages" && err.response?.status === 400) {
            // likely missing perm
        }

        res.redirect(`${process.env.FRONTEND_URL}/settings?error=server_error`);
    }
});

/**
 * 🔌 DELETE /api/auth/facebook
 * Disconnects the user's Facebook account
 */
router.delete("/", async (req, res) => {
    let userId = req.session?.user?.id;

    if (!userId && req.cookies?.token) {
        try {
            const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET || "supersecretkey");
            userId = decoded.id;
        } catch (err) { }
    }

    if (!userId) {
        return res.status(401).json({ error: "Unauthorized or session expired." });
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                facebookId: null,
                facebookAccessToken: null,
                facebookName: null,
                connectedPages: [], // reset to empty array
                pageSettings: [],
                selectedPages: []
            }
        });

        // ✅ Also remove FacebookPage entries
        await prisma.facebookPage.deleteMany({ where: { userId: userId } });

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
