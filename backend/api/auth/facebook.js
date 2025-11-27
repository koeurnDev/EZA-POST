// ============================================================
// 📘 Facebook OAuth Login
// ============================================================

const express = require("express");
const router = express.Router();
const axios = require("axios");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");

const FB_APP_ID = process.env.FB_APP_ID;
const FB_APP_SECRET = process.env.FB_APP_SECRET;
const REDIRECT_URI = `${process.env.API_BASE_URL || "http://localhost:5000"}/api/auth/facebook/callback`;

// ✅ 1. Redirect to Facebook Login
router.get("/", (req, res) => {
    if (!FB_APP_ID || FB_APP_ID === "123456789012345") {
        return res.status(500).send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>⚠️ Facebook Login Not Configured</h1>
                <p>You are using placeholder credentials in <code>backend/.env</code>.</p>
                <p>Please update <strong>FB_APP_ID</strong> and <strong>FB_APP_SECRET</strong> with your real Facebook App credentials.</p>
                <p>Current ID: ${FB_APP_ID}</p>
            </div>
        `);
    }

    const scopes = [
        "email",
        "public_profile",
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "pages_manage_metadata"
    ].join(",");

    const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scopes}&response_type=code`;

    res.redirect(url);
});

// ✅ 2. Handle Callback
router.get("/callback", async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=facebook_denied`);
    }

    if (!code) {
        return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=no_code`);
    }

    try {
        // 🔹 Exchange code for access token
        const tokenRes = await axios.get("https://graph.facebook.com/v18.0/oauth/access_token", {
            params: {
                client_id: FB_APP_ID,
                client_secret: FB_APP_SECRET,
                redirect_uri: REDIRECT_URI,
                code,
            },
        });

        const { access_token } = tokenRes.data;

        // 🔹 Get User Profile
        const profileRes = await axios.get("https://graph.facebook.com/me", {
            params: {
                fields: "id,name,email,picture",
                access_token,
            },
        });

        const { id, name, email, picture } = profileRes.data;

        // 🔹 Find or Create User
        let user = await User.findOne({ facebookId: id });
        if (!user) {
            // Check if email exists
            if (email) {
                user = await User.findOne({ email });
            }
        }

        if (user) {
            // Update existing user
            user.facebookId = id;
            user.facebookAccessToken = access_token;
            if (!user.avatar && picture?.data?.url) user.avatar = picture.data.url;
            await user.save();
        } else {
            // Create new user
            user = await User.create({
                name,
                email: email || `${id}@facebook.com`, // Fallback email
                password: `fb_${id}_${Date.now()}`, // Random password
                facebookId: id,
                facebookAccessToken: access_token,
                avatar: picture?.data?.url,
                role: "user",
            });
        }

        // 🔹 Generate JWT
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: "7d" }
        );

        // 🔹 Set Cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // 🔹 Redirect to Dashboard
        res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/dashboard`);

    } catch (err) {
        console.error("Facebook Login Error:", err.response?.data || err.message);
        res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/login?error=auth_failed`);
    }
});

module.exports = router;
