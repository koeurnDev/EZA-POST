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

module.exports = router;
