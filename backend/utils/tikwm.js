const axios = require('axios');

/**
 * Fetches TikTok video data from TikWM API
 * @param {string} url - The TikTok video URL
 * @returns {Promise<object>} - The API response data
 */
const Tikwm = async (url) => {
    try {
        const response = await axios.post("https://www.tikwm.com/api/",
            new URLSearchParams({ url: url, hd: 1 }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 10000
            }
        );
        return response.data;
    } catch (error) {
        throw new Error(`TikWM Request Failed: ${error.message}`);
    }
};

module.exports = { Tikwm };
