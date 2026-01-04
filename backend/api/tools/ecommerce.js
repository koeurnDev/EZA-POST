const express = require("express");
const router = express.Router();
// const puppeteer = require("puppeteer"); // Moved to lazy load
const { requireAuth } = require("../../utils/auth");

/* -------------------------------------------------------------------------- */
/* 🛍️ POST /scrape — Scrape Product from 1688/Taobao/Tmall                    */
/* -------------------------------------------------------------------------- */
router.post("/scrape", requireAuth, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: "URL is required" });

    console.log(`🛍️ Scraping URL (Hybrid Mode): ${url}`);

    // Helper to log errors
    const logError = (msg) => {
        console.error(`❌ Scraper Error: ${msg}`);
        const logPath = require('path').join(__dirname, "../../debug_errors.log");
        require('fs').appendFileSync(logPath, `[${new Date().toISOString()}] Scraper Error (${url}): ${msg}\n`);
    };

    let browser = null;
    let data = null;

    // 1. TRY PUPPETEER (Best for JS sites like 1688)
    try {
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
                document.querySelector('.tb-promo-price .tb-rmb-num')?.innerText ||
                document.querySelector('.price')?.innerText;

            return { title: title?.trim(), images: images.slice(0, 8), price };
        });

        console.log("✅ Puppeteer Success");

    } catch (puppeteerErr) {
        logError(`Puppeteer Failed: ${puppeteerErr.message}. Switch to Cheerio.`);
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
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);

            const title = $('h1').text() || $('meta[property="og:title"]').attr('content') || $('title').text();
            const price = $('.price-text').text() || $('.tb-rmb-num').text() || 'Ask';

            let images = [];
            $('img').each((i, el) => {
                const src = $(el).attr('src');
                if (src && (src.includes('.jpg') || src.includes('.png')) && !src.includes('icon')) {
                    // Basic filter
                    if (src.startsWith('//')) images.push('https:' + src);
                    else images.push(src);
                }
            });

            // Filter small images somewhat simply by assumption (usually thumbnails have specific keywords or small urls)
            // Hard to do strictly with Cheerio without downloading, grabbing first 5 relevant looking ones.
            images = images.filter(img => !img.includes('avatar') && !img.includes('logo')).slice(0, 8);

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
/* 🗣️ POST /translate — Translate Text (CN -> KH) using Gemini                */
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

        const prompt = `Translate the following E-commerce product title from Chinese to Khmer (Cambodian). Keep it professional, concise, and attractive for sales. Do not add quotes or explanations, just the Khmer text.\n\nSource: "${text}"`;

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
