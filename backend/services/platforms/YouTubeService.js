/**
 * 🔴 YouTube Service - Handles Shorts Uploads
 */
const { google } = require('googleapis');
const prisma = require('../../utils/prisma');

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

        // 1. Get User Tokens from Prisma
        const config = await prisma.platformConfig.findFirst({
            where: { userId, platform: 'youtube' }
        });

        if (!config || !config.settings) {
            throw new Error("YouTube not connected");
        }

        // Unpack settings from JSON
        let settings = config.settings;
        if (typeof settings === 'string') {
            try { settings = JSON.parse(settings); } catch (e) { settings = {}; }
        }

        if (!settings.accessToken) {
            throw new Error("YouTube Access Token missing");
        }

        const oauth2Client = getOAuthClient();
        oauth2Client.setCredentials({
            access_token: settings.accessToken,
            refresh_token: settings.refreshToken
        });

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
        scope: [
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/userinfo.profile'
        ],
        include_granted_scopes: true
    });
};

// 🔄 Handle Callback & Save Token
exports.handleCallback = async (code, userId) => {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    const config = await prisma.platformConfig.findFirst({
        where: { userId, platform: 'youtube' }
    });

    const settings = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || (config?.settings?.refreshToken), // Refresh token only sent once
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
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
                platform: 'youtube',
                isEnabled: true,
                settings
            }
        });
    }

    return tokens;
};
