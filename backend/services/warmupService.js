const puppeteer = require('puppeteer');
const stealthService = require('./stealthService');
const { humanDelay, coinFlip } = require('../utils/randomizer');

/**
 * Warm-up an account by simulating human activity.
 * @param {object} account - { cookie, id }
 * @param {number} durationMinutes - How long to run the simulation
 */
exports.warmupAccount = async (account, durationMinutes = 5) => {
    let browser = null;
    const startTime = Date.now();
    const endTime = startTime + (durationMinutes * 60 * 1000);

    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                `--user-agent=${stealthService.getRandomUserAgent()}`
            ]
        });

        const page = await browser.newPage();

        // 1. Login
        if (account.cookie) {
            try {
                const cookies = typeof account.cookie === 'string' ? JSON.parse(account.cookie) : account.cookie;
                if (Array.isArray(cookies)) await page.setCookie(...cookies);
            } catch (e) { console.error("Cookie Error", e); return; }
        }

        await page.goto('https://m.facebook.com/', { waitUntil: 'networkidle2' });

        // 2. Interaction Loop
        console.log(`[${account.id}] Starting Warm-up...`);

        while (Date.now() < endTime) {
            // Action 1: Scroll
            await autoScroll(page);
            await humanDelay(2000, 5000);

            // Action 2: Maybe Like a Post (30% chance)
            if (coinFlip(0.3)) {
                // Find visible like buttons
                // Note: Selectors on FB Mobile rely on aria-labels usually
                const likeButtons = await page.$$('div[aria-label="Like"], div[aria-label="Reaction"]');
                if (likeButtons.length > 0) {
                    const randomBtn = likeButtons[Math.floor(Math.random() * likeButtons.length)];
                    try {
                        await randomBtn.click();
                        console.log(`[${account.id}] Liked a post.`);
                        await humanDelay(1000, 3000); // Wait after liking
                    } catch (e) { /* ignore click errors */ }
                }
            }

            // Action 3: Maybe Watch Video (if visible)
            // ... (Simple pause logic)

            // Random delay between actions
            await humanDelay(3000, 8000);
        }

        console.log(`[${account.id}] Warm-up Complete.`);
        await browser.close();
        return { id: account.id, status: 'success' };

    } catch (error) {
        if (browser) await browser.close();
        console.error(`Warm-up Error for ${account.id}:`, error.message);
        return { id: account.id, status: 'failed', error: error.message };
    }
};

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight || totalHeight > 2000) { // Limit scroll depth
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}
