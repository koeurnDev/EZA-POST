/**
 * 📸 Instagram Service - Handles Auth & Posting via Facebook Graph API
 * Note: Instagram Graph API requires a Facebook App and a linked Facebook Page.
 */
const axios = require('axios');
const PlatformConfig = require('../../models/PlatformConfig');

const FB_AUTH_BASE = "https://www.facebook.com/v17.0/dialog/oauth";
const FB_TOKEN_URL = "https://graph.facebook.com/v17.0/oauth/access_token";

// 🔗 Generate Auth URL
exports.getAuthUrl = () => {
    // We use Facebook Login for Instagram Business
    const params = new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID || process.env.FB_APP_ID, // Can reuse FB App ID
        redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
        state: Math.random().toString(36).substring(7),
        scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,public_profile", // Key scopes
        response_type: "code"
    });
    return `${FB_AUTH_BASE}?${params.toString()}`;
};

// 🔄 Handle Callback & Save Token
exports.handleCallback = async (code, userId) => {
    try {
        // 1. Exchange Code for Token
        const params = new URLSearchParams({
            client_id: process.env.INSTAGRAM_CLIENT_ID || process.env.FB_APP_ID,
            client_secret: process.env.INSTAGRAM_CLIENT_SECRET || process.env.FB_APP_SECRET,
            redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
            code: code
        });

        const response = await axios.get(`${FB_TOKEN_URL}?${params.toString()}`);
        const { access_token, expires_in } = response.data;

        // 2. Get Long-Lived Token (Essential for Servers)
        // (Skipping for MVP speed, but highly recommended usually)

        // 3. Save to DB
        // We might want to fetch the Instagram ID here to store 'externalId' correctly
        // But for now, let's just save the token.

        await PlatformConfig.findOneAndUpdate(
            { userId, platform: 'instagram' },
            {
                accessToken: access_token,
                tokenExpiresAt: new Date(Date.now() + (expires_in || 5184000) * 1000), // Default ~60 days for long-lived
                isConnected: true
            },
            { upsert: true, new: true }
        );

        return response.data;
    } catch (err) {
        console.error("❌ Instagram Token Exchange Failed:", err.response?.data || err.message);
        throw new Error("Failed to connect Instagram");
    }
};
