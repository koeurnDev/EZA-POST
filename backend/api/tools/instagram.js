/**
 * ============================================================
 * 📸 /api/tools/instagram — Instagram Downloader (Reels/Posts)
 * ============================================================
 * Uses yt-dlp to download media from Instagram.
 * Example: https://www.instagram.com/p/CODE/ or https://www.instagram.com/reels/CODE/
 */

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { requireAuth } = require("../../utils/auth");
const ytdlp = require("../../utils/ytdlp");
const axios = require("axios");
const crypto = require("crypto");
const { Transform } = require("stream");
const { pipeline } = require("stream/promises");
const {
    isInstagramMediaUrl,
    maxInstagramMediaBytes,
    normalizeInstagramPostUrl,
} = require("../../utils/instagramUrl");

// 🗂️ Temp directory
const tempDir = path.join(__dirname, "../../temp/instagram");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

/* -------------------------------------------------------------------------- */
/* 📥 POST /download — Download Instagram Media                               */
/* -------------------------------------------------------------------------- */
router.post("/download", requireAuth, async (req, res) => {
    try {
        const cleanUrl = normalizeInstagramPostUrl(req.body?.url);
        if (!cleanUrl) {
            return res.status(400).json({ success: false, error: "Invalid Instagram URL" });
        }

        console.log(`📸 Downloading Instagram Media: ${cleanUrl}`);

        const safeId = `ig-${Date.now()}-${crypto.randomUUID()}`;
        const outputTemplate = path.join(tempDir, `${safeId}.%(ext)s`);

        // 🍪 Cookies File (for improved access)
        const cookiesPath = path.join(__dirname, "../../cookies.txt");

        // Flags for yt-dlp
        const flags = {
            noWarnings: true,
            noCheckCertificate: true,
            output: outputTemplate,
            ignoreErrors: true, // ✅ Continue even if "no video" (might be image)
            noPlaylist: true,   // ✅ Ensure single post
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };

        if (fs.existsSync(cookiesPath)) {
            flags.cookies = cookiesPath;
        }

        try {
            await ytdlp.download(cleanUrl, outputTemplate, flags);
        } catch (e) {
            console.warn(`⚠️ Primary download failed: ${e.message}`);
            console.warn("Proceeding to check/fallback...");
        }

        // Find the generated file
        const files = fs.readdirSync(tempDir);
        const foundFile = files.find(f =>
            f.startsWith(`${safeId}.`) && !f.endsWith(".part") && !f.endsWith(".ytdl")
        );

        if (foundFile) {
            console.log("✅ Instagram Download Complete:", foundFile);

            // Generate metadata
            const metadata = {
                title: `Instagram Media ${safeId}`,
                filename: foundFile,
                type: foundFile.endsWith(".mp4") ? "video" : "image"
            };

            // 🕒 Auto-Delete after 5 minutes
            setTimeout(() => {
                const filePath = path.join(tempDir, foundFile);
                if (fs.existsSync(filePath)) {
                    fs.unlink(filePath, (err) => {
                        if (err) console.error(`❌ Failed to auto-delete ${foundFile}:`, err);
                        else console.log(`🗑️ Auto-deleted ${foundFile}`);
                    });
                }
            }, 5 * 60 * 1000);

            res.json({
                success: true,
                url: `/uploads/temp/instagram/${foundFile}`,
                meta: metadata
            });
        } else {
            // ⚠️ Fallback: Try extracting Image URL manually
            console.warn("⚠️ File not found via yt-dlp. Trying metadata fallback for Image...");

            let info;
            try {
                info = await ytdlp.lookup(cleanUrl, {
                    noWarnings: true,
                    noCheckCertificate: true,
                    ignoreErrors: true,
                    cookies: flags.cookies
                });
            } catch (e) {
                console.warn(`⚠️ yt-dlp lookup failed: ${e.message}`);
                // Attempt 1: Check stdout for JSON
                if (e.stdout) {
                    try { info = JSON.parse(e.stdout); } catch (err) { }
                }

                // Attempt 2: HTML Scraping (Last Resort for Images)
                if (!info) {
                    try {
                        console.warn("⚠️ yt-dlp failed. Attempting direct HTML scraping...");

                        // Parse Cookies properly from Netscape format
                        let cookieHeader = '';
                        if (fs.existsSync(cookiesPath)) {
                            const cookieContent = fs.readFileSync(cookiesPath, 'utf8');
                            cookieHeader = cookieContent.split('\n')
                                .filter(line => line.trim() && !line.startsWith('#'))
                                .map(line => {
                                    const parts = line.split('\t');
                                    // Netscape format: domain, flag, path, secure, expiration, name, value
                                    return (parts.length >= 7) ? `${parts[5]}=${parts[6].trim()}` : null;
                                })
                                .filter(c => c)
                                .join('; ');
                        }

                        console.log(`Debug: Cookies loaded? ${cookieHeader.length > 0}, Length: ${cookieHeader.length}`);

                        const htmlRes = await axios.get(cleanUrl, {
                            headers: {
                                'User-Agent': flags.userAgent,
                                'Cookie': cookieHeader,
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                'Accept-Language': 'en-US,en;q=0.5'
                            }
                        });

                        console.log(`Debug: HTML Fetched. Status: ${htmlRes.status}, Length: ${htmlRes.data.length}`);

                        // Strategy 1: Open Graph Tag
                        let imageMatch = htmlRes.data.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                            htmlRes.data.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);

                        // Strategy 2: Search for display_url in JSON blobs (common in Instagram scripts)
                        if (!imageMatch) {
                            imageMatch = htmlRes.data.match(/"display_url"\s*:\s*"([^"]+)"/);
                        }

                        // Strategy 3: Search for any high-res CDN URL (Desperate fallback)
                        if (!imageMatch) {
                            // Look for standard IG CDN patterns
                            imageMatch = htmlRes.data.match(/"url"\s*:\s*"(https?:\/\/[^"]+fbcdn\.net[^"]+)"/);
                        }

                        if (imageMatch && imageMatch[1]) {
                            let rawUrl = imageMatch[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
                            // Fix JSON escaped slashes
                            rawUrl = rawUrl.replace(/\\/g, '');

                            console.log("📸 Found Image via HTML Scraping:", rawUrl);
                            info = { url: rawUrl, ext: 'jpg' };
                        } else {
                            console.warn("⚠️ No image URL found in HTML. Dumping first 500 chars:");
                            console.warn(htmlRes.data.substring(0, 500));
                        }
                    } catch (scrapeErr) {
                        console.error("❌ HTML Scraping failed:", scrapeErr.message);
                    }
                }
            }

            if (!info || (!info.url && !info.thumbnail)) {
                throw new Error("Could not retrieve metadata via any method. Account might be private.");
            }

            const targetUrl = info.url || info.thumbnail;

            if (isInstagramMediaUrl(targetUrl)) {
                console.log("📸 Found Image/Video URL via metadata:", targetUrl);

                const ext = "jpg";
                const fallbackFilename = `${safeId}.${ext}`;
                const fallbackPath = path.join(tempDir, fallbackFilename);

                let bytesWritten = 0;
                try {
                    const response = await axios({
                        url: targetUrl,
                        method: "GET",
                        responseType: "stream",
                        timeout: 30000,
                        maxRedirects: 0,
                        maxContentLength: maxInstagramMediaBytes,
                        headers: { "User-Agent": flags.userAgent },
                    });
                    const contentType = response.headers["content-type"] || "";
                    const contentLength = Number(response.headers["content-length"]);
                    if (!contentType.toLowerCase().startsWith("image/")) {
                        response.data.destroy();
                        throw new Error("Instagram image fallback returned a non-image response");
                    }
                    if (Number.isFinite(contentLength) && contentLength > maxInstagramMediaBytes) {
                        response.data.destroy();
                        throw new Error("Instagram image exceeds the download size limit");
                    }

                    const sizeLimit = new Transform({
                        transform(chunk, encoding, callback) {
                            bytesWritten += chunk.length;
                            if (bytesWritten > maxInstagramMediaBytes) {
                                callback(new Error("Instagram image exceeds the download size limit"));
                                return;
                            }
                            callback(null, chunk);
                        },
                    });
                    await pipeline(
                        response.data,
                        sizeLimit,
                        fs.createWriteStream(fallbackPath, { flags: "wx" })
                    );
                } catch (error) {
                    try {
                        await fs.promises.unlink(fallbackPath);
                    } catch (cleanupError) {
                        if (cleanupError.code !== "ENOENT") {
                            console.error("Failed to remove partial Instagram media:", cleanupError);
                        }
                    }
                    throw error;
                }

                console.log("✅ Fallback Download Complete:", fallbackFilename);

                // 🕒 Auto-Delete after 5 minutes
                setTimeout(() => {
                    if (fs.existsSync(fallbackPath)) {
                        fs.unlink(fallbackPath, (err) => {
                            if (err) console.error(`❌ Failed to auto-delete ${fallbackFilename}:`, err);
                            else console.log(`🗑️ Auto-deleted ${fallbackFilename}`);
                        });
                    }
                }, 5 * 60 * 1000);

                res.json({
                    success: true,
                    url: `/uploads/temp/instagram/${fallbackFilename}`,
                    meta: {
                        title: `Instagram Image ${safeId}`,
                        filename: fallbackFilename,
                        type: "image"
                    }
                });

            } else if (targetUrl) {
                throw new Error("Instagram returned a media URL outside the supported CDN hosts.");
            } else {
                throw new Error("File not found and no direct URL in metadata. Account might be private.");
            }
        }

    } catch (err) {
        console.error("❌ Instagram Download Error:", err.message);

        let errorMessage = "Failed to download. Ensure content is Public.";
        if (err.message.includes("cookies") || err.message.includes("registered users")) {
            errorMessage = "This content is private or restricted. Only public content can be downloaded.";
        }

        res.status(500).json({ success: false, error: errorMessage });
    }
});

module.exports = router;
