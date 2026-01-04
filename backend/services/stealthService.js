/**
 * Stealth Service for Fingerprint Spoofing
 * Generates realistic browser fingerprints to evade detection.
 */

const USER_AGENTS = [
    // Windows Chrome
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    // macOS Chrome
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    // macOS Safari
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    // Windows Edge
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
];

const LANGUAGES = ["en-US,en;q=0.9", "en-GB,en;q=0.8", "km-KH,km;q=0.9,en;q=0.8"];

exports.getRandomUserAgent = () => {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
};

exports.getHeaders = () => {
    const ua = exports.getRandomUserAgent();
    // Basic heuristic to guess platform from UA string
    const platform = ua.includes("Win") ? '"Windows"' : ua.includes("Mac") ? '"macOS"' : '"Linux"';

    return {
        'User-Agent': ua,
        'Accept-Language': LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Referer': 'https://www.google.com/',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': platform,
        'Upgrade-Insecure-Requests': '1'
    };
};
