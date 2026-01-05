/**
 * ============================================================
 * 🤖 /api/boost-accounts — Manage TikTok Boost Accounts
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../utils/auth');
const BoostAccount = require('../models/BoostAccount');
const tiktokBooster = require('../utils/tiktokBooster');

/* -------------------------------------------------------------------------- */
/* GET / — Get all boost accounts                                             */
/* -------------------------------------------------------------------------- */
router.get('/', requireAuth, async (req, res) => {
    try {
        const accounts = await BoostAccount.find({ userId: req.user.id })
            .select('-password') // Don't send encrypted password to frontend
            .sort({ createdAt: -1 });

        res.json({ success: true, accounts });
    } catch (err) {
        console.error('❌ Get accounts error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* POST / — Add new boost account                                             */
/* -------------------------------------------------------------------------- */
router.post('/', requireAuth, async (req, res) => {
    try {
        const { platform, username, password, dailyLimit } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password required'
            });
        }

        const account = await BoostAccount.create({
            userId: req.user.id,
            platform: platform || 'tiktok',
            username,
            password,
            dailyLimit: dailyLimit || 25  // Reduced from 50 to 25
        });

        // Auto-login to get cookies
        console.log(`🔄 Auto-logging in to get cookies for ${username}...`);
        await tiktokBooster.login(account);

        res.json({
            success: true,
            account: {
                _id: account._id,
                username: account.username,
                platform: account.platform,
                status: account.status,
                dailyLimit: account.dailyLimit,
                cookiesUpdated: account.cookiesUpdated
            }
        });
    } catch (err) {
        console.error('❌ Add account error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* PUT /:id — Update boost account                                            */
/* -------------------------------------------------------------------------- */
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { username, cookies, dailyLimit, status } = req.body;

        const account = await BoostAccount.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!account) {
            return res.status(404).json({ success: false, error: 'Account not found' });
        }

        if (username) account.username = username;
        if (cookies && Array.isArray(cookies)) {
            account.cookies = cookies;
            account.cookiesUpdated = new Date();
        }
        if (dailyLimit) account.dailyLimit = dailyLimit;
        if (status) account.status = status;

        await account.save();

        res.json({ success: true, account });
    } catch (err) {
        console.error('❌ Update account error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* DELETE /:id — Delete boost account                                         */
/* -------------------------------------------------------------------------- */
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const account = await BoostAccount.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!account) {
            return res.status(404).json({ success: false, error: 'Account not found' });
        }

        // Close browser if open
        await tiktokBooster.closeBrowser(account._id);

        res.json({ success: true, message: 'Account deleted' });
    } catch (err) {
        console.error('❌ Delete account error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* POST /:id/test — Test account login                                        */
/* -------------------------------------------------------------------------- */
router.post('/:id/test', requireAuth, async (req, res) => {
    try {
        const account = await BoostAccount.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!account) {
            return res.status(404).json({ success: false, error: 'Account not found' });
        }

        console.log(`🧪 Testing login for ${account.username}...`);
        const success = await tiktokBooster.login(account);

        res.json({
            success,
            message: success ? 'Login successful!' : 'Login failed. Check credentials.'
        });
    } catch (err) {
        console.error('❌ Test login error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/* POST /import-cookies — Import cookies from bookmarklet                     */
/* -------------------------------------------------------------------------- */
router.post('/import-cookies', requireAuth, async (req, res) => {
    try {
        const { username, cookies } = req.body;

        if (!username || !cookies || !Array.isArray(cookies)) {
            return res.status(400).json({
                success: false,
                error: 'Username and cookies array required'
            });
        }

        // Find existing account or create new
        let account = await BoostAccount.findOne({
            userId: req.user.id,
            username
        });

        if (account) {
            // Update existing account
            account.cookies = cookies;
            account.cookiesUpdated = new Date();
            account.status = 'active';
            await account.save();
            console.log(`✅ Updated cookies for ${username}`);
        } else {
            // Create new account
            account = await BoostAccount.create({
                userId: req.user.id,
                username,
                cookies,
                cookiesUpdated: new Date(),
                platform: 'tiktok',
                dailyLimit: 50
            });
            console.log(`✅ Created new account for ${username}`);
        }

        res.json({
            success: true,
            message: `Cookies imported for ${username}!`,
            account: {
                _id: account._id,
                username: account.username,
                status: account.status,
                cookiesUpdated: account.cookiesUpdated
            }
        });
    } catch (err) {
        console.error('❌ Import cookies error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
