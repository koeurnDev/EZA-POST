
const express = require('express');
const router = express.Router();
const PlatformConfig = require('../../models/PlatformConfig');
const { requireAuth } = require('../../utils/auth');

// 🔍 GET / — Check connected platforms
router.get('/', requireAuth, async (req, res) => {
    try {
        const configs = await PlatformConfig.find({ userId: req.user.id });

        const connections = {
            youtube: false,
            tiktok: false,
            instagram: false,
            facebook: false // Usually handled via account selector, but good to have
        };

        configs.forEach(config => {
            if (config.isConnected) {
                if (config.platform === 'youtube') connections.youtube = true;
                if (config.platform === 'tiktok') connections.tiktok = true;
                if (config.platform === 'instagram') connections.instagram = true;
            }
        });

        res.json({ success: true, connections });
    } catch (err) {
        console.error("Connections Check Error:", err);
        res.status(500).json({ success: false, error: "Server Error" });
    }
});

module.exports = router;
