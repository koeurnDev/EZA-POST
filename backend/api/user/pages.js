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
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user || (!user.facebookAccessToken && !user.connectedPages)) {
            return res.json({ success: true, accounts: [] });
        }

        // ✅ Return Saved Pages from DB (Fast & Reliable)
        // 1. Try fetching from new FacebookPage model
        let dbPages = await prisma.facebookPage.findMany({ where: { userId: userId } });
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
                    access_token: decrypt(page.accessToken), // Encrypted
                    picture: page.picture,
                    isSelected: user.selectedPages?.includes(page.id) || false,
                    settings: {
                        enableBot: settings.enableBot || false,
                        enableSchedule: settings.enableSchedule !== false, // Default true
                        enableInbox: settings.enableInbox || false
                    }
                };
            });
        } else {
            // 2. Fallback to Legacy User.connectedPages
            let connectedPages = user.connectedPages;
            if (typeof connectedPages === 'string') try { connectedPages = JSON.parse(connectedPages) } catch (e) { }

            if (Array.isArray(connectedPages) && connectedPages.length > 0) {
                pages = connectedPages.map(page => {
                    const settings = pageSettings.find(s => s.pageId === page.id) || {};
                    return {
                        id: page.id,
                        name: page.name,
                        access_token: page.access_token, // Legacy might be raw or encrypted, assume raw if not migrated yet
                        picture: page.picture,
                        isSelected: user.selectedPages?.includes(page.id) || false,
                        settings: {
                            enableBot: settings.enableBot || false,
                            enableSchedule: settings.enableSchedule !== false, // Default true
                            enableInbox: settings.enableInbox || false
                        }
                    };
                });
            }
        }

        res.json({ success: true, accounts: pages });
    } catch (err) {
        console.error("❌ Fetch pages error:", err.message);
        res.status(500).json({ success: false, error: "Failed to fetch pages" });
    }
});

// ✅ POST /api/user/pages/toggle
// Toggle a page ON/OFF
router.post("/toggle", requireAuth, async (req, res) => {
    try {
        const { pageId, isSelected } = req.body;
        const userId = req.user.id;

        if (!pageId) return res.status(400).json({ error: "Page ID required" });

        // Prisma doesn't have native atomic $addToSet for scalar lists in update 
        // (unless using Postgres specific raw query or atomic Push, but remove is harder).
        // Best approach: Fetch, Modify, Save.
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { selectedPages: true } });
        let selectedPages = user.selectedPages || [];

        if (isSelected) {
            if (!selectedPages.includes(pageId)) selectedPages.push(pageId);
        } else {
            selectedPages = selectedPages.filter(id => id !== pageId);
        }

        await prisma.user.update({
            where: { id: userId },
            data: { selectedPages: selectedPages }
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
