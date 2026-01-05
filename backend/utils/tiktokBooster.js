/**
 * ============================================================
 * 🤖 TikTok Booster - Real Browser Automation
 * ============================================================
 * Uses Puppeteer to perform real actions on TikTok
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const BoostAccount = require('../models/BoostAccount');

puppeteer.use(StealthPlugin());

class TikTokBooster {
    constructor() {
        this.browsers = new Map(); // accountId -> browser instance
        this.maxConcurrent = parseInt(process.env.BOOST_MAX_CONCURRENT_BROWSERS) || 3;
    }

    /**
     * Get or create browser for account
     */
    async getBrowser(accountId) {
        if (this.browsers.has(accountId)) {
            return this.browsers.get(accountId);
        }

        const browser = await puppeteer.launch({
            headless: process.env.BOOST_HEADLESS !== 'false',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        this.browsers.set(accountId, browser);
        return browser;
    }

    /**
     * Login to TikTok with account (password-based with auto-cookie save)
     */
    async login(account) {
        try {
            console.log(`🔐 Logging in to TikTok as ${account.username}...`);

            const browser = await this.getBrowser(account._id);
            const page = await browser.newPage();

            // Set realistic viewport
            await page.setViewport({
                width: 1280 + Math.floor(Math.random() * 100),
                height: 720 + Math.floor(Math.random() * 100)
            });

            // Try cookies first if available
            if (account.cookies && account.cookies.length > 0) {
                await page.setCookie(...account.cookies);
                await page.goto('https://www.tiktok.com', { waitUntil: 'networkidle2', timeout: 30000 });
                await this.randomDelay(2000, 4000);

                const isLoggedIn = await page.evaluate(() => {
                    return document.querySelector('[data-e2e="profile-icon"]') !== null;
                });

                if (isLoggedIn) {
                    console.log('✅ Logged in using saved cookies');
                    account.status = 'active';
                    await account.save();
                    await page.close();
                    return true;
                }
                console.log('⚠️ Cookies expired, logging in with password...');
            }

            // Login with password
            await page.goto('https://www.tiktok.com/login', { waitUntil: 'networkidle2', timeout: 30000 });
            await this.randomDelay(2000, 4000);

            // Click "Use phone / email / username"
            await page.waitForSelector('a[href*="login/phone-or-email"]', { timeout: 10000 });
            await page.click('a[href*="login/phone-or-email"]');
            await this.randomDelay(1000, 2000);

            // Enter username
            await page.waitForSelector('input[name="username"]', { timeout: 10000 });
            await this.humanType(page, 'input[name="username"]', account.username);
            await this.randomDelay(500, 1000);

            // Enter password
            await this.humanType(page, 'input[type="password"]', account.getPassword());
            await this.randomDelay(1000, 2000);

            // Click login button
            await page.click('button[type="submit"]');
            await this.randomDelay(3000, 5000);

            // Wait for navigation
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => { });

            // Check login success
            const loginSuccess = await page.evaluate(() => {
                return document.querySelector('[data-e2e="profile-icon"]') !== null;
            });

            if (loginSuccess) {
                // Save cookies for future use
                const cookies = await page.cookies();
                account.cookies = cookies;
                account.cookiesUpdated = new Date();
                account.status = 'active';
                await account.save();
                console.log('✅ Login successful & cookies saved');
            } else {
                console.log('❌ Login failed');
                account.status = 'error';
                await account.save();
            }

            await page.close();
            return loginSuccess;

        } catch (err) {
            console.error('❌ Login error:', err.message);
            account.status = 'error';
            await account.save();
            return false;
        }
    }

    /**
     * Like a TikTok post
     */
    async likePost(account, postUrl) {
        try {
            console.log(`❤️ Liking post: ${postUrl}`);

            const browser = await this.getBrowser(account._id);
            const page = await browser.newPage();

            await page.setViewport({
                width: 1280 + Math.floor(Math.random() * 100),
                height: 720 + Math.floor(Math.random() * 100)
            });

            // Load cookies
            if (account.cookies) {
                await page.setCookie(...account.cookies);
            }

            await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await this.randomDelay(2000, 4000);

            // Random scroll
            await this.randomScroll(page);

            // Find and click like button
            const likeButton = await page.$('[data-e2e="like-icon"], [data-e2e="browse-like-icon"]');

            if (likeButton) {
                // Check if already liked
                const isLiked = await page.evaluate((btn) => {
                    return btn.classList.contains('liked') || btn.getAttribute('fill') === 'currentColor';
                }, likeButton);

                if (!isLiked) {
                    await likeButton.click();
                    await this.randomDelay(1000, 2000);
                    console.log('✅ Post liked');
                    await page.close();
                    return true;
                } else {
                    console.log('ℹ️ Post already liked');
                    await page.close();
                    return true;
                }
            } else {
                console.log('❌ Like button not found');
                await page.close();
                return false;
            }

        } catch (err) {
            console.error('❌ Like error:', err.message);
            return false;
        }
    }

    /**
     * Comment on a TikTok post
     */
    async commentPost(account, postUrl, commentText) {
        try {
            console.log(`💬 Commenting on post: ${postUrl}`);

            const browser = await this.getBrowser(account._id);
            const page = await browser.newPage();

            await page.setViewport({
                width: 1280 + Math.floor(Math.random() * 100),
                height: 720 + Math.floor(Math.random() * 100)
            });

            if (account.cookies) {
                await page.setCookie(...account.cookies);
            }

            await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await this.randomDelay(2000, 4000);

            // Click comment input
            const commentInput = await page.$('[data-e2e="comment-input"]');
            if (commentInput) {
                await commentInput.click();
                await this.randomDelay(500, 1000);
                await this.humanType(page, '[data-e2e="comment-input"]', commentText);
                await this.randomDelay(1000, 2000);

                // Click post button
                await page.click('[data-e2e="comment-post"]');
                await this.randomDelay(2000, 3000);

                console.log('✅ Comment posted');
                await page.close();
                return true;
            } else {
                console.log('❌ Comment input not found');
                await page.close();
                return false;
            }

        } catch (err) {
            console.error('❌ Comment error:', err.message);
            return false;
        }
    }

    /**
     * Share a TikTok post
     */
    async sharePost(account, postUrl) {
        try {
            console.log(`🔄 Sharing post: ${postUrl}`);

            const browser = await this.getBrowser(account._id);
            const page = await browser.newPage();

            await page.setViewport({
                width: 1280 + Math.floor(Math.random() * 100),
                height: 720 + Math.floor(Math.random() * 100)
            });

            if (account.cookies) {
                await page.setCookie(...account.cookies);
            }

            await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await this.randomDelay(2000, 4000);

            // Click share button
            const shareButton = await page.$('[data-e2e="share-icon"], [data-e2e="browse-share"]');
            if (shareButton) {
                await shareButton.click();
                await this.randomDelay(1000, 2000);

                // Click "Copy link" option
                const copyLink = await page.$('[data-e2e="share-copy-link"]');
                if (copyLink) {
                    await copyLink.click();
                    await this.randomDelay(500, 1000);
                    console.log('✅ Post shared (link copied)');
                    await page.close();
                    return true;
                }
            }

            console.log('❌ Share button not found');
            await page.close();
            return false;

        } catch (err) {
            console.error('❌ Share error:', err.message);
            return false;
        }
    }

    /**
     * Human-like typing
     */
    async humanType(page, selector, text) {
        await page.click(selector);
        for (const char of text) {
            await page.keyboard.type(char);
            await this.randomDelay(50, 150);
        }
    }

    /**
     * Random scroll
     */
    async randomScroll(page) {
        const scrollAmount = 100 + Math.random() * 300;
        await page.evaluate((amount) => {
            window.scrollBy(0, amount);
        }, scrollAmount);
        await this.randomDelay(500, 1000);
    }

    /**
     * Random delay
     */
    async randomDelay(min, max) {
        const delay = min + Math.random() * (max - min);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Close browser for account
     */
    async closeBrowser(accountId) {
        if (this.browsers.has(accountId)) {
            const browser = this.browsers.get(accountId);
            await browser.close();
            this.browsers.delete(accountId);
        }
    }

    /**
     * Close all browsers
     */
    async closeAll() {
        for (const [accountId, browser] of this.browsers) {
            await browser.close();
        }
        this.browsers.clear();
    }
}

module.exports = new TikTokBooster();
