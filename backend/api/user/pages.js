const express = require("express");
const router = express.Router();
const axios = require("axios");
const User = require("../../models/User");
const { requireAuth } = require("../../utils/auth");

// ✅ GET /api/user/pages
router.get("/", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findOne({ id: userId });

        if (!user || !user.facebookAccessToken) {
            return res.json({ success: true, accounts: [] });
        }

        // Fetch pages from Facebook
        console.log(`🔍 Fetching pages for user ${user.name} (FB ID: ${user.facebookId})...`);

        try {
            const response = await axios.get(
                `https://graph.facebook.com/v21.0/me/accounts`,
                {
                    params: {
                        access_token: user.facebookAccessToken,
                        fields: "id,name,access_token,picture{url}",
                    },
                }
            );

            console.log(`✅ Facebook API Response: Found ${response.data.data.length} pages.`);

            const pages = response.data.data.map((page) => {
                const settings = user.pageSettings?.find(s => s.pageId === page.id) || {};
                return {
                    id: page.id,
                    name: page.name,
                    access_token: page.access_token,
                    picture: page.picture?.data?.url,
                    isSelected: user.selectedPages?.includes(page.id) || false,
                    settings: {
                        enableBot: settings.enableBot || false,
                        enableSchedule: settings.enableSchedule !== false, // Default true
                        enableInbox: settings.enableInbox || false
                    }
                };
            });

            res.json({ success: true, accounts: pages });
        } catch (fbError) {
            console.error("❌ Facebook Graph API Error:", fbError.response?.data || fbError.message);
            if (fbError.response?.status === 401 || fbError.response?.status === 400) {
                // Token might be expired or invalid
                return res.json({ success: true, accounts: [], error: "Facebook session expired. Please reconnect." });
            }
            throw fbError;
        }
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

        const update = isSelected
            ? { $addToSet: { selectedPages: pageId } } // Add if ON
            : { $pull: { selectedPages: pageId } };    // Remove if OFF

        await User.findOneAndUpdate({ id: userId }, update);

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

        // Update specific page settings in the array
        await User.findOneAndUpdate(
            { id: userId },
            {
                $pull: { pageSettings: { pageId: pageId } } // Remove existing
            }
        );

        await User.findOneAndUpdate(
            { id: userId },
            {
                $push: { pageSettings: { pageId, ...settings } } // Add new
            }
        );

        res.json({ success: true, message: "Settings updated" });
    } catch (err) {
        console.error("❌ Update settings error:", err.message);
        res.status(500).json({ success: false, error: "Failed to update settings" });
    }
});

module.exports = router;
