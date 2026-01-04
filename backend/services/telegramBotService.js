const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

/**
 * Sends a video to a Telegram Chat/Channel.
 * @param {string} videoPath - Local path to video file.
 * @param {string} caption - Caption for the video.
 * @param {string} chatId - Target Chat ID.
 * @param {string} botToken - Telegram Bot Token.
 */
exports.sendVideoToChat = async (videoPath, caption, chatId, botToken) => {
    try {
        if (!fs.existsSync(videoPath)) {
            throw new Error(`File not found: ${videoPath}`);
        }

        const stats = fs.statSync(videoPath);
        const fileSizeInBytes = stats.size;
        const fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024);

        if (fileSizeInMegabytes > 50) {
            throw new Error(`File too large for Bot API (${fileSizeInMegabytes.toFixed(2)}MB). Limit is 50MB.`);
        }

        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('caption', caption);
        form.append('video', fs.createReadStream(videoPath));

        const response = await axios.post(
            `https://api.telegram.org/bot${botToken}/sendVideo`,
            form,
            {
                headers: {
                    ...form.getHeaders(),
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 300000 // 5 minutes
            }
        );

        return response.data;
    } catch (error) {
        console.error("Telegram Send Error:", error.response ? error.response.data : error.message);
        throw new Error("Failed to send video to Telegram: " + (error.response?.data?.description || error.message));
    }
};
