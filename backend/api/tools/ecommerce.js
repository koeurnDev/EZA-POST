const express = require("express");
const router = express.Router();
// const puppeteer = require("puppeteer"); // Moved to lazy load
const { requireAuth } = require("../../utils/auth");

/* -------------------------------------------------------------------------- */
/* 🛍️ POST /scrape — Scrape Product from 1688/Taobao/Tmall                    */
/* -------------------------------------------------------------------------- */
router.post("/scrape", requireAuth, async (req, res) => {
    let { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: "URL is required" });

    // 🧹 Extract URL from text (e.g. if user pasted full Taobao share text)
    const urlMatch = url.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
        url = urlMatch[0];
    }

    console.log(`🛍️ Scraping URL (Hybrid Mode): ${url}`);

    // Helper to log errors
    const logError = (msg) => {
        console.error(`❌ Scraper Error: ${msg}`);
        const logPath = require('path').join(__dirname, "../../debug_errors.log");
        require('fs').appendFileSync(logPath, `[${new Date().toISOString()}] Scraper Error (${url}): ${msg}\n`);
    };

    let browser = null;
    let data = null;

    // 0. PRE-PROCESS TAOBAO URLs
    // Taobao Desktop/Mobile often blocks. World Taobao often works.
    // Convert https://e.tb.cn/..., https://item.taobao.com/..., etc. to https://world.taobao.com/item/ID.htm
    let isTaobao = url.includes('taobao') || url.includes('tmall') || url.includes('tb.cn');

    if (isTaobao) {
        try {
            // Trace if shortlink (Puppeteer is more reliable for JS redirects than Axios)
            if (url.includes('tb.cn')) {
                console.log("🕵️ Resolving Taobao Shortlink with Puppeteer...");
                const puppeteer = require("puppeteer");
                const browser = await puppeteer.launch({
                    headless: "new",
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
                    timeout: 15000
                });
                try {
                    const page = await browser.newPage();
                    // Use Mobile UA to ensure correct redirection to product page (h5/m.intl) instead of Login
                    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1');
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

                    // Allow a moment for JS redirect
                    try { await page.waitForNavigation({ timeout: 5000 }); } catch (e) { }

                    const resolvedUrl = page.url();
                    console.log(`📍 Resolved URL: ${resolvedUrl}`);

                    // ⚡ OPTIMIZATION: If we are already here and it's world.taobao or item.taobao, Just SCRAPE IT NOW!
                    // This avoids the double-request that triggers the "Login" wall.
                    if (resolvedUrl.includes('taobao') || resolvedUrl.includes('tmall')) {
                        console.log("⚡ Puppeteer already open, scraping immediately...");
                        try {
                            // Inject basic scraper
                            data = await page.evaluate(() => {
                                const getMeta = (name) => document.querySelector(`meta[property='${name}']`)?.content || document.querySelector(`meta[name='${name}']`)?.content || "";
                                let title = document.querySelector('.title-text')?.innerText || document.querySelector('h1')?.innerText || document.title;
                                let price = document.querySelector('.price')?.innerText || "Ask";

                                let images = [];
                                // 1. OG Image
                                const ogImg = getMeta('og:image');
                                if (ogImg) images.push(ogImg);

                                // 2. Images
                                document.querySelectorAll('img').forEach(img => {
                                    if (img.src && img.width > 200) images.push(img.src);
                                });
                                images = images.filter(img => !img.includes('avatar') && !img.includes('icon') && !img.includes('login')).slice(0, 10);

                                return { title: title.trim(), price: price.trim(), images };
                            });

                            // Validate data: If we found no images, or title smells like a Login page, discard it to force fallback
                            if (data && (data.images.length === 0 || data.title.includes('Login') || data.title.includes('登录'))) {
                                console.log("⚠️ Instant Scrape returned poor data (0 images or Login). Discarding to try fallback.");
                                data = null;
                            } else {
                                console.log("✅ Puppeteer Instant Scrape Success");
                            }
                        } catch (scrapeErr) {
                            console.log("Instant Scrape Failed:", scrapeErr.message);
                        }
                    }

                    url = resolvedUrl;
                } catch (err) {
                    console.log("Puppeteer Resolve Error:", err.message);
                } finally {
                    await browser.close();
                }
            }

            // Extract ID
            const idMatch = url.match(/[?&]id=(\d+)/) || url.match(/\/item\/(\d+)/);
            if (idMatch && idMatch[1]) {
                const itemId = idMatch[1];
                url = `https://world.taobao.com/item/${itemId}.htm`;
                console.log(`🇨🇳 Converted to World Taobao: ${url}`);
                // Force Cheerio for World Taobao
            }
        } catch (e) {
            console.log("Taobao conversion error:", e.message);
        }
    }

    // 1. TRY PUPPETEER (Best for JS sites like 1688, but SKIP for World Taobao as it's static-friendly)
    try {
        if (!url.includes('world.taobao.com')) {
            console.log("Attempting Puppeteer...");
            const puppeteer = require("puppeteer"); // Lazy load

            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
                timeout: 10000 // Give up launch after 10s
            });

            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1366, height: 768 });

            // Navigate
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }); // 25s timeout

            // Extract
            data = await page.evaluate(() => {
                const getMeta = (name) => document.querySelector(`meta[property='${name}']`)?.content || document.querySelector(`meta[name='${name}']`)?.content || "";

                let title = document.querySelector('.title-text')?.innerText ||
                    document.querySelector('.d-title')?.innerText ||
                    document.querySelector('h1')?.innerText ||
                    getMeta('og:title') || document.title;

                let images = [];
                // Gallery strategies
                document.querySelectorAll('.tab-trigger .detail-gallery-img').forEach(img => images.push(img.src));
                document.querySelectorAll('#J_UlThumb img').forEach(img => {
                    let src = img.src || img.getAttribute('data-src');
                    if (src) images.push(src.replace('50x50', '400x400').replace('60x60', '400x400'));
                });
                if (images.length === 0) {
                    const ogImg = getMeta('og:image');
                    if (ogImg) images.push(ogImg);
                    document.querySelectorAll('img').forEach(img => {
                        if (img.width > 300 && img.height > 300) images.push(img.src);
                    });
                }

                let price = document.querySelector('.price-text')?.innerText || // 1688
                    document.querySelector('.tb-promo-price .tb-rmb-num')?.innerText || // Taobao
                    document.querySelector('.price-num')?.innerText || // Tmall
                    document.querySelector('.promotion-price')?.innerText ||
                    document.querySelector('.price')?.innerText;

                return { title: title?.trim(), images: images.slice(0, 8), price: price?.trim() };
            });

            console.log("✅ Puppeteer Success");
        }
    } catch (puppeteerErr) {
        // logError(`Puppeteer Failed: ${puppeteerErr.message}. Switch to Cheerio.`);
        console.log("Puppeteer Skipped or Failed:", puppeteerErr.message);
    } finally {
        if (browser) await browser.close();
    }


    // 2. FALLBACK TO CHEERIO (If Puppeteer failed or returned no data)
    if (!data || !data.title) {
        try {
            console.log("Attempting Cheerio Fallback...");
            const cheerio = require("cheerio");
            const axios = require("axios");

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': url.includes('world.taobao.com')
                        ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': url.includes('world.taobao.com') ? 'https://www.taobao.com/' : undefined
                },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);

            const title = $('h1').text() || $('meta[property="og:title"]').attr('content') || $('title').text();
            const price = $('.price-text').text() || $('.tb-rmb-num').text() || $('.price-num').text() || 'Ask';

            let images = [];

            // Priority 1: OG Image (Best Quality Cover)
            const ogImg = $('meta[property="og:image"]').attr('content');
            if (ogImg) images.push(ogImg);

            // Priority 2: Gallery Images (Generic Search)
            $('img').each((i, el) => {
                const src = $(el).attr('src');
                if (src && (src.includes('.jpg') || src.includes('.png')) && !src.includes('icon') && !src.includes('gif')) {
                    let cleanSrc = src;
                    if (src.startsWith('//')) cleanSrc = 'https:' + src;

                    // Avoid duplicates and tiny icons
                    if (!images.includes(cleanSrc)) {
                        images.push(cleanSrc);
                    }
                }
            });

            // Filter garbage
            images = images.filter(img =>
                !img.includes('avatar') &&
                !img.includes('logo') &&
                !img.includes('login') &&
                !img.includes('empty')
            ).slice(0, 8);

            data = {
                title: title.trim(),
                images: images,
                price: price.trim(),
                source: "cheerio"
            };

            console.log("✅ Cheerio Success");

        } catch (cheerioErr) {
            logError(`Cheerio Failed: ${cheerioErr.message}`);
            return res.status(500).json({ success: false, error: "Failed to scrape product. The link might be protected. " + cheerioErr.message });
        }
    }

    if (data) {
        res.json({ success: true, data });
    } else {
        res.status(500).json({ success: false, error: "Could not extract product data." });
    }
});

/* -------------------------------------------------------------------------- */
/* 🗣️ POST /translate — Translate Text (Any -> KH) using Gemini               */
/* -------------------------------------------------------------------------- */
router.post("/translate", requireAuth, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ success: false, error: "Text is required" });

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) return res.status(500).json({ success: false, error: "Google API Key missing" });

        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Translate this E-commerce product title to Khmer (Cambodian). 
        Source text: "${text}"
        Guidelines:
        1. Keep it professional and attractive for sales.
        2. Do not include quotes, explanations, or the original text.
        3. If the title is already in Khmer, return it as is.
        4. Focus on clarity and common marketplace terms in Cambodia.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const translatedText = response.text().trim();

        res.json({ success: true, translation: translatedText });

    } catch (err) {
        console.error("❌ Translation Failed:", err.message);
        res.status(500).json({ success: false, error: "Translation failed" });
    }
});

module.exports = router;
