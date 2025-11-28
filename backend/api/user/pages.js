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
        const response = await axios.get(
            `https://graph.facebook.com/v21.0/me/accounts`,
            {
                params: {
                    access_token: user.facebookAccessToken,
                    fields: "id,name,access_token,picture{url}",
                },
            }
        );

        const pages = response.data.data.map((page) => ({
            id: page.id,
            name: page.name,
            access_token: page.access_token,
            picture: page.picture?.data?.url,
            isSelected: user.selectedPages?.includes(page.id) || false, // ✅ Check if selected
        }));

        res.json({ success: true, accounts: pages });
    } catch (err) {
        console.error("❌ Fetch pages error:", err.message);
        // If token is invalid, return empty list instead of 500
        if (err.response?.status === 401 || err.response?.status === 400) {
            return res.json({ success: true, accounts: [] });
        }
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

module.exports = router;
