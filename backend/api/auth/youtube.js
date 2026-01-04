/**
 * 🔐 YouTube Auth Routes
 */
const express = require('express');
const router = express.Router();
const YouTubeService = require('../../services/platforms/YouTubeService');
const { requireAuth } = require('../../utils/auth');

// 1. Initial Redirect to Google
router.get('/', requireAuth, (req, res) => {
    try {
        const url = YouTubeService.getAuthUrl();
        // We need to store userId in state or session to know who is connecting
        // Simple way: append userId to state or use a short-lived cookie
        // Google allows 'state' parameter.
        // For simplicity in this stack, let's pass userId in state query param encoded? 
        // Better: The user is calling this route WITH a token (requireAuth).
        // We can pass the JWT token in the 'state' param so the callback knows who it is? 
        // OR, just set a cookie here.

        res.cookie('auth_user_id', req.user.id, { httpOnly: true, maxAge: 5 * 60 * 1000 }); // 5 min

        console.log("🔗 Redirecting to YouTube Auth URL...");
        res.json({ success: true, url }); // Return URL for frontend to redirect
    } catch (err) {
        console.error("Auth URL Error:", err);
        res.status(500).json({ error: "Failed to generate auth URL" });
    }
});

// 2. Callback from Google
router.get('/callback', async (req, res) => {
    try {
        const { code } = req.query;
        // const userId = req.cookies.auth_user_id; 
        // Note: In some mixed envs cookies might be tricky. 
        // Let's assume for now we use the cookie set above.

        // Wait, if we use cookie, we need cookie-parser middleware. verify server.js has it.
        // If not, we might need a simpler strategy: Frontend passes ID? No, insecure.
        // Let's rely on the cookie mechanism or 'state' if possible.

        // For EZA_POST, let's do this: 
        // Frontend calls /api/auth/youtube -> gets URL.
        // That URL has specific redirect_uri = SERVER_URL/api/auth/youtube/callback

        // Let's TRUST the cookie for now.
        const userId = req.cookies?.auth_user_id;

        if (!userId || !code) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/connections?error=auth_failed`);
        }

        await YouTubeService.handleCallback(code, userId);

        res.clearCookie('auth_user_id');
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/connections?success=youtube`);

    } catch (err) {
        console.error("YouTube Callback Error:", err);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/connections?error=server_error`);
    }
});

module.exports = router;
