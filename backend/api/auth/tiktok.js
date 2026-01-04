/**
 * 🔐 TikTok Auth Routes
 */
const express = require('express');
const router = express.Router();
const TikTokService = require('../../services/platforms/TikTokService');
const { requireAuth } = require('../../utils/auth');

// 1. Initial Redirect
router.get('/', requireAuth, (req, res) => {
    try {
        const url = TikTokService.getAuthUrl();
        res.cookie('auth_user_id', req.user.id, { httpOnly: true, maxAge: 5 * 60 * 1000 });
        res.json({ success: true, url });
    } catch (err) {
        res.status(500).json({ error: "Failed to generate auth URL" });
    }
});

// 2. Callback
router.get('/callback', async (req, res) => {
    try {
        const { code, error } = req.query;
        const userId = req.cookies?.auth_user_id;

        if (error || !code || !userId) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/connections?error=auth_failed`);
        }

        await TikTokService.handleCallback(code, userId);

        res.clearCookie('auth_user_id');
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/connections?success=tiktok`);

    } catch (err) {
        console.error("TikTok Callback Error:", err);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/connections?error=server_error`);
    }
});

module.exports = router;
