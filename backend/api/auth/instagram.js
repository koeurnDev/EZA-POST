/**
 * 📸 Instagram Auth Routes
 */
const express = require('express');
const router = express.Router();
const InstagramService = require('../../services/platforms/InstagramService');
const { requireAuth } = require('../../utils/auth');

// 1. Initial Redirect
router.get('/', requireAuth, (req, res) => {
    try {
        const url = InstagramService.getAuthUrl();
        res.cookie('auth_user_id', req.user.id, { httpOnly: true, maxAge: 5 * 60 * 1000 });
        res.json({ success: true, url });
    } catch (err) {
        console.error("IG Auth URL Error:", err);
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

        await InstagramService.handleCallback(code, userId);

        res.clearCookie('auth_user_id');
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/connections?success=instagram`);

    } catch (err) {
        console.error("Instagram Callback Error:", err);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/connections?error=server_error`);
    }
});

module.exports = router;
