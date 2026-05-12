const express = require("express");
const router = express.Router();
const axios = require("axios");
const prisma = require('../../utils/prisma');
const { requireAuth } = require("../../utils/auth");

const { decrypt } = require("../../utils/crypto");

// ✅ GET /api/user/pages
router.get("/", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await prisma.user.findUnique({ 
            where: { id: userId },
            include: { facebookPages: true } 
        });

        if (!user || (!user.facebookAccessToken && user.facebookPages.length === 0)) {
            return res.json({ success: true, accounts: [] });
        }

        // ✅ Return Saved Pages from DB
        let dbPages = user.facebookPages;
        let pages = [];

        // Helper to parse JSON fields
        let pageSettings = user.pageSettings;
        if (typeof pageSettings === 'string') try { pageSettings = JSON.parse(pageSettings) } catch (e) { }
        if (!Array.isArray(pageSettings)) pageSettings = [];

        if (dbPages.length > 0) {
            pages = dbPages.map(page => {
                const settings = pageSettings.find(s => s.pageId === page.id) || {};
                return {
                    id: page.id,
                    name: page.name,
                    picture: page.picture,
                    isSelected: page.isSelected,
                    settings: {
                        enableBot: page.enableBot || settings.enableBot || false,
                        enableSchedule: page.enableSchedule !== false,
                        enableInbox: page.enableInbox || false
                    }
                };
            });
        }

        res.json({ success: true, accounts: pages });
    } catch (err) {
        console.error("❌ [Pages API] Error:", err);
        res.status(500).json({ 
            success: false, 
            error: "Failed to fetch pages",
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// ✅ POST /api/user/pages/toggle
// Toggle a page ON/OFF
router.post("/toggle", requireAuth, async (req, res) => {
    try {
        const { pageId, isSelected } = req.body;
        const userId = req.user.id;

        if (!pageId) return res.status(400).json({ error: "Page ID required" });

        // ✅ Update selection state on the FacebookPage model directly
        await prisma.facebookPage.update({
            where: { id: pageId },
            data: { isSelected: !!isSelected }
        });

        res.json({ success: true, message: isSelected ? "Page Enabled" : "Page Disabled" });
    } catch (err) {
        console.error("❌ Toggle page error:", err.message);
        res.status(500).json({ success: false, error: "Failed to update page selection" });
    }
});

// ✅ POST /api/user/pages/settings
// Update settings for a specific page
router.post("/settings", requireAuth, async (req, res) => {
    try {
        const { pageId, settings } = req.body;
        const userId = req.user.id;

        if (!pageId || !settings) return res.status(400).json({ error: "Page ID and settings required" });

        // Fetch user to get current settings
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { pageSettings: true } });

        let pageSettings = user.pageSettings;
        if (typeof pageSettings === 'string') try { pageSettings = JSON.parse(pageSettings) } catch (e) { }
        if (!Array.isArray(pageSettings)) pageSettings = [];

        // Remove existing
        pageSettings = pageSettings.filter(s => s.pageId !== pageId);
        // Add new
        pageSettings.push({ pageId, ...settings });

        await prisma.user.update({
            where: { id: userId },
            data: { pageSettings: pageSettings } // Pass array/object directly
        });

        res.json({ success: true, message: "Settings updated" });
    } catch (err) {
        console.error("❌ Update settings error:", err.message);
        res.status(500).json({ success: false, error: "Failed to update settings" });
    }
});

module.exports = router;
