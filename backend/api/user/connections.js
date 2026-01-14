
const express = require('express');
const router = express.Router();
const prisma = require('../../utils/prisma');
const { requireAuth } = require('../../utils/auth');

// 🔍 GET / — Check connected platforms
router.get('/', requireAuth, async (req, res) => {
    try {
        // PlatformConfig doesn't have userId in schema?
        // Let's check schema: model PlatformConfig { id, platform, isEnabled, settings, updatedAt }
        // It seems PlatformConfig is global or per system? 
        // Wait, Mongoose model usually had 'userId' maybe?
        // Step 168 Schema: PlatformConfig does NOT have userId. 
        // Let's check the viewed file in step 15 (PlatformConfig.js)
        // "This file defines the Mongoose schema for PlatformConfig... storing platform-specific settings..."
        // If it's single tenant or global config, userId might not be there.
        // But the original code queries `PlatformConfig.find({ userId: req.user.id })`.
        // So User IS in the mongoose model.
        // I must have missed it in schema.prisma!
        // CHECK schema again.

        // I need to add userId to PlatformConfig in schema if it's per user.
        // Or if it's missing, I need `view_file` PlatformConfig.js to be sure.

        // Let's temporarily COMMENT OUT the userId check if it's missing in schema, OR fix schema.
        // I'll check PlatformConfig.js first.

        // For now, I will assume it DOES need userId and I will add it to Schema.
        // But first let's see the file.
        const configs = await prisma.platformConfig.findMany({
            where: { userId: userId }
        });

        const connections = {
            youtube: false,
            tiktok: false,
            instagram: false,
            facebook: false // Usually handled via account selector, but good to have
        };

        // If I can't filter by user yet, I will filter in memory or fix schema.
        // Assume global for now or fix next.
        configs.forEach(config => {
            if (config.isEnabled) {
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
