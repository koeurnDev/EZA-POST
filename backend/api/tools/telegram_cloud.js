const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const telegramBotService = require('../../services/telegramBotService');
const { Tikwm } = require('../../utils/tikwm');

// Helper to download file from URL to local disk
const downloadFile = async (url, destPath) => {
    const writer = fs.createWriteStream(destPath);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
};

// @route   POST /api/tools/telegram-cloud/send
// @desc    Download video from URL and send to Telegram
router.post('/send', async (req, res) => {
    const { url, chatId, botToken, caption } = req.body;

    if (!url || !chatId || !botToken) {
        return res.status(400).json({ success: false, error: 'URL, Chat ID, and Bot Token are required.' });
    }

    const tempDir = path.join(__dirname, '../../public/uploads/temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const filename = `tg-cloud-${Date.now()}.mp4`;
    const tempFilePath = path.join(tempDir, filename);

    try {
        let downloadUrl = url;
        let finalCaption = caption || 'Sent via EZA Post Cloud ☁️';

        // 1. Resolve URL if it's TikTok/FB
        // Simple logic for now: If it involves TikTok, use TikWM to get the HD No watermark URL
        if (url.includes('tiktok.com')) {
            try {
                const data = await Tikwm(url);
                if (data && data.data && data.data.play) {
                    downloadUrl = data.data.play;
                    if (!caption) finalCaption = data.data.title || finalCaption;
                }
            } catch (e) {
                console.error("TikTok Resolve Error:", e.message);
                // Fallback to original URL if fail, might accept raw video links
            }
        }
        // TODO: Add FB/IG resolvers here using similar logic if needed.

        // 2. Download to Server (Temp)
        console.log(`Downloading: ${downloadUrl}`);
        await downloadFile(downloadUrl, tempFilePath);

        // 3. Send to Telegram
        console.log(`Sending to Telegram Chat: ${chatId}`);
        await telegramBotService.sendVideoToChat(tempFilePath, finalCaption, chatId, botToken);

        // 4. Cleanup
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }

        res.json({ success: true, message: 'Video sent to Telegram successfully!' });

    } catch (err) {
        console.error('Telegram Cloud Error:', err);
        // Cleanup on error
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
