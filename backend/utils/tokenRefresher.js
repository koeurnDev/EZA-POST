/**
 * ============================================================
 * 🔄 Token Refresher Utility
 * ============================================================
 * Automatically refreshes Facebook Long-Lived Tokens before they expire.
 */

const axios = require("axios");
const User = require("../models/User");

const FB_APP_ID = process.env.FB_APP_ID;
const FB_APP_SECRET = process.env.FB_APP_SECRET;

/**
 * 🔄 Refresh a user's Facebook Access Token
 * @param {object} user - The user document
 */
const refreshFacebookToken = async (user) => {
    try {
        if (!user.facebookAccessToken) return;

        console.log(`🔄 Refreshing token for user: ${user.name} (${user.id})`);

        // 1. Exchange current token for a new one
        const response = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
            params: {
                grant_type: "fb_exchange_token",
                client_id: FB_APP_ID,
                client_secret: FB_APP_SECRET,
                fb_exchange_token: user.getDecryptedAccessToken() // Decrypt before sending
            }
        });

        const { access_token, expires_in } = response.data;

        // 2. Update User
        user.facebookAccessToken = access_token; // Will be encrypted by pre-save hook

        if (expires_in) {
            user.facebookTokenExpiresAt = new Date(Date.now() + expires_in * 1000);
        } else {
            // Fallback: Extend by 60 days
            user.facebookTokenExpiresAt = new Date(Date.now() + 5184000 * 1000);
        }

        await user.save();
        console.log(`✅ Token refreshed successfully for ${user.name}. Expires: ${user.facebookTokenExpiresAt}`);

    } catch (err) {
        console.error(`❌ Failed to refresh token for user ${user.id}:`, err.response?.data || err.message);
    }
};

/**
 * 🕵️‍♂️ Check for expiring tokens and refresh them
 * Should be run daily via scheduler.
 */
const checkAndRefreshTokens = async () => {
    try {
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        // Find users with tokens expiring soon (or expired)
        const usersToRefresh = await User.find({
            facebookAccessToken: { $exists: true },
            facebookTokenExpiresAt: { $lte: sevenDaysFromNow }
        });

        if (usersToRefresh.length === 0) return;

        console.log(`⏳ Found ${usersToRefresh.length} tokens to refresh...`);

        for (const user of usersToRefresh) {
            await refreshFacebookToken(user);
        }

    } catch (err) {
        console.error("❌ Error in checkAndRefreshTokens:", err.message);
    }
};

module.exports = { refreshFacebookToken, checkAndRefreshTokens };
