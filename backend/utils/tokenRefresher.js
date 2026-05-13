/**
 * ============================================================
 * 🔄 Token Refresher Utility (Prisma Version)
 * ============================================================
 * Automatically refreshes Facebook Long-Lived Tokens before they expire.
 */

const axios = require("axios");
const prisma = require("./prisma");
const { encrypt, decrypt } = require("./crypto");

const FB_APP_ID = process.env.FB_APP_ID;
const FB_APP_SECRET = process.env.FB_APP_SECRET;

/**
 * 🔄 Refresh a user's Facebook Access Token
 * @param {object} user - The user object from Prisma
 */
const refreshFacebookToken = async (user) => {
    try {
        if (!user.facebookAccessToken) return;

        console.log(`🔄 Refreshing token for user: ${user.name} (${user.id})`);

        // 1. Decrypt current token
        const currentToken = decrypt(user.facebookAccessToken);
        if (!currentToken) throw new Error("Could not decrypt current token");

        // 2. Exchange current token for a new one
        const response = await axios.get("https://graph.facebook.com/v21.0/oauth/access_token", {
            params: {
                grant_type: "fb_exchange_token",
                client_id: FB_APP_ID,
                client_secret: FB_APP_SECRET,
                fb_exchange_token: currentToken
            }
        });

        const { access_token, expires_in } = response.data;

        // 3. Calculate new expiry
        let expiresAt;
        if (expires_in) {
            expiresAt = new Date(Date.now() + expires_in * 1000);
        } else {
            // Fallback: Extend by 60 days
            expiresAt = new Date(Date.now() + 5184000 * 1000);
        }

        // 4. Update User in Prisma
        await prisma.user.update({
            where: { id: user.id },
            data: {
                facebookAccessToken: encrypt(access_token),
                facebookTokenExpiresAt: expiresAt
            }
        });

        console.log(`✅ Token refreshed successfully for ${user.name}. Expires: ${expiresAt}`);

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

        // Find users with tokens expiring soon (or expired) using Prisma
        const usersToRefresh = await prisma.user.findMany({
            where: {
                facebookAccessToken: { not: null },
                facebookTokenExpiresAt: { lte: sevenDaysFromNow }
            }
        });

        if (usersToRefresh.length === 0) {
            console.log("✅ No Facebook tokens need refreshing today.");
            return;
        }

        console.log(`⏳ Found ${usersToRefresh.length} tokens to refresh...`);

        for (const user of usersToRefresh) {
            await refreshFacebookToken(user);
        }

    } catch (err) {
        console.error("❌ Error in checkAndRefreshTokens:", err.message);
    }
};

module.exports = { refreshFacebookToken, checkAndRefreshTokens };
