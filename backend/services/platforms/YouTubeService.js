/**
 * 🔴 YouTube Service - Handles Shorts Uploads
 */
const { google } = require('googleapis');
const PlatformConfig = require('../../models/PlatformConfig');

// 🔐 OAuth2 Client Setup
const getOAuthClient = () => {
    return new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        process.env.YOUTUBE_REDIRECT_URI
    );
};

// 📤 Upload Video to YouTube
exports.uploadVideo = async (userId, videoPath, title, description) => {
    try {
        console.log(`🔴 [YouTube] Starting upload for user: ${userId}`);

        // 1. Get User Tokens
        const config = await PlatformConfig.findOne({ userId, platform: 'youtube' });
        if (!config || !config.accessToken) {
            throw new Error("YouTube not connected");
        }

        const oauth2Client = getOAuthClient();
        oauth2Client.setCredentials({
            access_token: config.accessToken,
            refresh_token: config.refreshToken
        });

        // 🔄 Auto-Refresh Token if needed (Google library handles this usually, but good to know)

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        // 2. Upload
        const fs = require('fs');
        const res = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title: title.substring(0, 100), // Max 100 chars
                    description: description || "#Shorts",
                    tags: ['Shorts', 'EZA_POST'],
                },
                status: {
                    privacyStatus: 'public', // or private/unlisted
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: fs.createReadStream(videoPath)
            }
        });

        console.log(`✅ [YouTube] Upload success: ${res.data.id}`);
        return {
            success: true,
            platformId: res.data.id,
            url: `https://youtu.be/${res.data.id}`
        };

    } catch (err) {
        console.error("❌ [YouTube] Upload Failed:", err.message);
        throw err;
    }
};

// 🔗 Generate Auth URL
exports.getAuthUrl = () => {
    const oauth2Client = getOAuthClient();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline', // Crucial for refresh token
        scope: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/userinfo.profile']
    });
};

// 🔄 Handle Callback & Save Token
exports.handleCallback = async (code, userId) => {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    // Save to DB
    await PlatformConfig.findOneAndUpdate(
        { userId, platform: 'youtube' },
        {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token, // Only sent on first consent!
            tokenExpiresAt: new Date(tokens.expiry_date),
            isConnected: true
        },
        { upsert: true, new: true }
    );

    return tokens;
};
