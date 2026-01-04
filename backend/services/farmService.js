const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const stealthService = require('./stealthService'); // Use our stealth logic

/**
 * Mass Post to Profile Stories
 * @param {Array} accounts - List of { cookie: string, id: string }
 * @param {string} mediaPath - Local path to the media file
 */
exports.massPostStory = async (accounts, mediaPath) => {
    const results = [];
    const BATCH_SIZE = 3; // Process 3 accounts at a time to save RAM

    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
        const batch = accounts.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(account => processSingletStory(account, mediaPath));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }

    return results;
};

async function processSingletStory(account, mediaPath) {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                `--user-agent=${stealthService.getRandomUserAgent()}` // Spoof UA
            ]
        });

        const page = await browser.newPage();

        // 1. Set Cookies
        if (account.cookie) {
            // Simple cookie parser (assuming standard array or netscape format)
            // For now, let's assume it's a JSON string of cookies
            try {
                const cookies = typeof account.cookie === 'string' ? JSON.parse(account.cookie) : account.cookie;
                if (Array.isArray(cookies)) {
                    await page.setCookie(...cookies);
                }
            } catch (e) {
                console.error(`Invalid cookie for account ${account.id}`, e);
                return { id: account.id, status: 'failed', error: 'Invalid Cookie' };
            }
        }

        // 2. Navigate to Facebook (Mobile Version for easier uploads)
        await page.goto('https://m.facebook.com/', { waitUntil: 'networkidle2' });

        // 3. Check login status
        if (await page.$('input[name="email"]')) {
            throw new Error("Cookie invalid or expired (Redirected to login)");
        }

        // 4. Navigate to Story Creation
        // Note: Direct URL or selector navigation logic here.
        // This is tricky on FB. simplified flow:
        await page.goto('https://m.facebook.com/stories/create/', { waitUntil: 'networkidle2' });

        // 5. Upload File
        const [fileChooser] = await Promise.all([
            page.waitForFileChooser(),
            page.click('div[aria-label="Create Story"], div[role="button"]') // Generic selector - needs tuning based on exact FB mobile DOM
                .catch(() => page.click('input[type="file"]')) // Fallback if input is visible
        ]);
        await fileChooser.accept([mediaPath]);

        // 6. Submit
        await new Promise(r => setTimeout(r, 5000)); // Wait for upload
        const shareBtn = await page.waitForSelector('div[aria-label="Share"], button:contains("Share")', { timeout: 10000 });
        if (shareBtn) await shareBtn.click();

        await new Promise(r => setTimeout(r, 5000)); // Wait for confirmation

        await browser.close();
        return { id: account.id, status: 'success' };

    } catch (error) {
        if (browser) await browser.close();
        console.error(`Story Post Error for ${account.id}:`, error.message);
        return { id: account.id, status: 'failed', error: error.message };
    }
}
