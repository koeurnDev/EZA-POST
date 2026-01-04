/**
 * 🎵 TikTok Service - Handles Auth & Posting
 * Note: Requires 'TikTok for Developers' App with 'video.upload' scope.
 */
const axios = require('axios');
const PlatformConfig = require('../../models/PlatformConfig');

const TIKTOK_AUTH_BASE = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";

// 🔗 Generate Auth URL
exports.getAuthUrl = () => {
    const csrfState = Math.random().toString(36).substring(7);
    const params = new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        scope: "user.info.basic,video.upload,video.publish", // Scopes needed
        response_type: "code",
        redirect_uri: process.env.TIKTOK_REDIRECT_URI,
        state: csrfState
    });

    console.log("🎵 TikTok Auth Init:");
    console.log("   👉 Client Key:", process.env.TIKTOK_CLIENT_KEY ? "Set" : "Missing");
    console.log("   👉 Redirect URI:", process.env.TIKTOK_REDIRECT_URI);

    return `${TIKTOK_AUTH_BASE}?${params.toString()}`;
};

// 🔄 Handle Callback & Save Token
exports.handleCallback = async (code, userId) => {
    try {
        const params = new URLSearchParams({
            client_key: process.env.TIKTOK_CLIENT_KEY,
            client_secret: process.env.TIKTOK_CLIENT_SECRET,
            code: code,
            grant_type: "authorization_code",
            redirect_uri: process.env.TIKTOK_REDIRECT_URI
        });

        const response = await axios.post(TIKTOK_TOKEN_URL, params, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });

        const { access_token, refresh_token, expires_in, open_id } = response.data;

        // Save to DB
        await PlatformConfig.findOneAndUpdate(
            { userId, platform: 'tiktok' },
            {
                accessToken: access_token,
                refreshToken: refresh_token,
                tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
                externalId: open_id,
                isConnected: true
            },
            { upsert: true, new: true }
        );

        return response.data;
    } catch (err) {
        console.error("❌ TikTok Token Exchange Failed:", err.response?.data || err.message);
        throw new Error("Failed to connect TikTok");
    }
};

// 📤 Upload Video (Placeholder - requires verified App)
exports.uploadVideo = async (userId, videoPath, caption) => {
    // 1. Get Token
    const config = await PlatformConfig.findOne({ userId, platform: 'tiktok' });
    if (!config) throw new Error("TikTok not connected");

    // 2. Initiate Upload (TikTok API is complex, involves multiple steps: init, upload, finalize)
    // See: https://developers.tiktok.com/doc/content-posting-api-get-started
    console.log("🎵 [TikTok] Stub - Upload initiated for", userId);

    return { success: true, fake: true };
};
