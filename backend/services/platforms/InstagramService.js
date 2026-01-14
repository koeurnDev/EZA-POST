/**
 * 📸 Instagram Service - Handles Auth & Posting via Facebook Graph API
 */
const axios = require('axios');
const prisma = require('../../utils/prisma');

const FB_AUTH_BASE = "https://www.facebook.com/v17.0/dialog/oauth";
const FB_TOKEN_URL = "https://graph.facebook.com/v17.0/oauth/access_token";

// 🔗 Generate Auth URL
exports.getAuthUrl = () => {
    const params = new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID || process.env.FB_APP_ID,
        redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
        state: Math.random().toString(36).substring(7),
        scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,public_profile",
        response_type: "code"
    });
    return `${FB_AUTH_BASE}?${params.toString()}`;
};

// 🔄 Handle Callback & Save Token
exports.handleCallback = async (code, userId) => {
    try {
        const params = new URLSearchParams({
            client_id: process.env.INSTAGRAM_CLIENT_ID || process.env.FB_APP_ID,
            client_secret: process.env.INSTAGRAM_CLIENT_SECRET || process.env.FB_APP_SECRET,
            redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
            code: code
        });

        const response = await axios.get(`${FB_TOKEN_URL}?${params.toString()}`);
        const { access_token, expires_in } = response.data;

        const config = await prisma.platformConfig.findFirst({
            where: { userId, platform: 'instagram' }
        });

        const settings = {
            accessToken: access_token,
            tokenExpiresAt: new Date(Date.now() + (expires_in || 5184000) * 1000),
            isConnected: true
        };

        if (config) {
            await prisma.platformConfig.update({
                where: { id: config.id },
                data: { settings }
            });
        } else {
            await prisma.platformConfig.create({
                data: {
                    userId,
                    platform: 'instagram',
                    isEnabled: true,
                    settings
                }
            });
        }

        return response.data;
    } catch (err) {
        console.error("❌ Instagram Token Exchange Failed:", err.response?.data || err.message);
        throw new Error("Failed to connect Instagram");
    }
};
