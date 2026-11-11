/**
 * ============================================================
 * 🍪 facebookCookieExtractor.js — Facebook Cookie & Token Extractor
 * ============================================================
 * Enables importing Facebook Pages without requiring a Meta
 * Developer App by extracting internal Business/Ads tokens
 * (EAAG / EAAB / EAAI) directly from active browser cookies,
 * or accepting direct Access Tokens.
 */

const axios = require("axios");
const prisma = require("../utils/prisma");
const fb = require("../utils/fb");
const { encrypt } = require("../utils/crypto");

class FacebookCookieExtractor {
  /**
   * Helper: Check if input string is already an Access Token
   */
  isToken(str) {
    if (!str || typeof str !== "string") return false;
    const trimmed = str.trim();
    // Facebook User/Page/Business Tokens usually start with EAA... and have > 50 chars
    return /^EAA[A-Za-z0-9_-]{30,}$/.test(trimmed);
  }

  /**
   * Helper: Extract token pattern from HTML or response text
   */
  extractTokenFromText(text) {
    if (!text || typeof text !== "string") return null;

    // Pattern 1: Direct EAAG / EAAB / EAAI tokens
    const eaagMatch = text.match(/EAAG[A-Za-z0-9_-]+/);
    if (eaagMatch) return eaagMatch[0];

    const eaabMatch = text.match(/EAAB[A-Za-z0-9_-]+/);
    if (eaabMatch) return eaabMatch[0];

    const eaaiMatch = text.match(/EAAI[A-Za-z0-9_-]+/);
    if (eaaiMatch) return eaaiMatch[0];

    // Pattern 2: Generic EAA token with length >= 60
    const eaaMatch = text.match(/EAA[A-Za-z0-9_-]{60,}/);
    if (eaaMatch) return eaaMatch[0];

    // Pattern 3: JSON escaped access_token
    const jsonMatch = text.match(/"access_token"\s*:\s*"([^"]+)"/i);
    if (jsonMatch && jsonMatch[1].startsWith("EAA")) return jsonMatch[1];

    const jsonTokenMatch = text.match(/"accessToken"\s*:\s*"([^"]+)"/i);
    if (jsonTokenMatch && jsonTokenMatch[1].startsWith("EAA")) return jsonTokenMatch[1];

    // Pattern 4: window.__accessToken
    const windowMatch = text.match(/window\.__accessToken\s*=\s*["']([^"']+)["']/i);
    if (windowMatch && windowMatch[1].startsWith("EAA")) return windowMatch[1];

    return null;
  }

  /**
   * Extract Access Token using Facebook Cookie
   */
  async extractTokenFromCookie(cookieString) {
    if (!cookieString || typeof cookieString !== "string") {
      throw new Error("Cookie string is required");
    }

    let cleanCookie = cookieString.trim();

    // 🔄 Auto-parse JSON format if exported from Cookie-Editor extension
    if (cleanCookie.startsWith("[") && cleanCookie.endsWith("]")) {
      try {
        const arr = JSON.parse(cleanCookie);
        if (Array.isArray(arr)) {
          cleanCookie = arr
            .filter((c) => c && c.name && c.value)
            .map((c) => `${c.name}=${c.value}`)
            .join("; ");
          console.log("🍪 Auto-converted Cookie-Editor JSON to header string successfully.");
        }
      } catch (e) {
        // ignore parse error, treat as raw text
      }
    }

    // 🔄 Auto-parse Netscape format if exported as Netscape file
    if (cleanCookie.includes("\t") && (cleanCookie.includes(".facebook.com") || cleanCookie.includes("# Netscape") || cleanCookie.includes("c_user"))) {
      const lines = cleanCookie.split(/\r?\n/);
      const cookiePairs = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const parts = trimmed.split("\t");
        if (parts.length >= 7) {
          const name = parts[5];
          const val = parts[6];
          if (name && val) {
            cookiePairs.push(`${name}=${val}`);
          }
        }
      }
      if (cookiePairs.length > 0) {
        cleanCookie = cookiePairs.join("; ");
        console.log("🍪 Auto-converted Netscape format to header string successfully.");
      }
    }

    // Verify basic Facebook cookie components (must contain c_user or xs)
    if (!cleanCookie.includes("c_user") && !cleanCookie.includes("xs")) {
      throw new Error("Invalid Facebook Cookie. It must contain 'c_user' and 'xs'.");
    }

    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cookie": cleanCookie,
      "Referer": "https://business.facebook.com/",
    };

    // Endpoint 1: Business Locations (Most reliable for EAAG token)
    try {
      console.log("🔍 Attempting to extract EAAG token from business.facebook.com/business_locations...");
      const res1 = await axios.get("https://business.facebook.com/business_locations", {
        headers,
        timeout: 15000,
      });

      const token1 = this.extractTokenFromText(res1.data);
      if (token1) {
        console.log("✅ Successfully extracted token from Endpoint 1 (business_locations)!");
        return token1;
      }
    } catch (err1) {
      console.warn("⚠️ Endpoint 1 attempt failed:", err1.message);
    }

    // Endpoint 2: Meta Ads Manager
    try {
      console.log("🔍 Attempting to extract token from Ads Manager...");
      const res2 = await axios.get("https://adsmanager.facebook.com/adsmanager/manage/campaigns", {
        headers: {
          ...headers,
          Referer: "https://adsmanager.facebook.com/",
        },
        timeout: 15000,
      });

      const token2 = this.extractTokenFromText(res2.data);
      if (token2) {
        console.log("✅ Successfully extracted token from Endpoint 2 (adsmanager)!");
        return token2;
      }
    } catch (err2) {
      console.warn("⚠️ Endpoint 2 attempt failed:", err2.message);
    }

    // Endpoint 3: Mobile Composer Ocelot loader
    try {
      console.log("🔍 Attempting to extract token from m.facebook.com composer...");
      const res3 = await axios.get(
        "https://m.facebook.com/composer/ocelot/async_loader/?publisher=feed",
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
            "Cookie": cleanCookie,
          },
          timeout: 15000,
        }
      );

      const token3 = this.extractTokenFromText(res3.data);
      if (token3) {
        console.log("✅ Successfully extracted token from Endpoint 3 (m.facebook.com)!");
        return token3;
      }
    } catch (err3) {
      console.warn("⚠️ Endpoint 3 attempt failed:", err3.message);
    }

    throw new Error(
      "Could not extract token from the provided cookie. The cookie may be expired, or Facebook requires a checkpoint verification. You can also paste an Access Token directly (starting with EAAG/EAAB)."
    );
  }

  /**
   * Import pages using either Cookie OR Direct Token
   */
  async importPages(userId, inputString) {
    if (!inputString || typeof inputString !== "string") {
      throw new Error("Please provide a Facebook Cookie or Access Token.");
    }

    const trimmed = inputString.trim();
    let userToken = null;

    if (this.isToken(trimmed)) {
      console.log("🔑 Detected direct Access Token input.");
      userToken = trimmed;
    } else {
      console.log("🍪 Detected Cookie input. Extracting token...");
      userToken = await this.extractTokenFromCookie(trimmed);
    }

    if (!userToken) {
      throw new Error("Failed to resolve a valid Facebook Access Token.");
    }

    // 1. Fetch User Profile from Graph API
    console.log("👤 Fetching user profile from Graph API with token...");
    const profileRes = await axios.get("https://graph.facebook.com/v21.0/me", {
      params: {
        access_token: userToken,
        fields: "id,name,picture{url}",
      },
    });

    const fbUser = profileRes.data;
    if (!fbUser || !fbUser.id) {
      throw new Error("Failed to verify user profile from Facebook token.");
    }

    console.log(`✅ Connected as Facebook user: ${fbUser.name} (${fbUser.id})`);

    // 2. Fetch Pages managed by this token
    console.log("📄 Fetching Facebook Pages...");
    const pagesRes = await axios.get("https://graph.facebook.com/v21.0/me/accounts", {
      params: {
        access_token: userToken,
        fields: "id,name,access_token,category,picture{url},followers_count",
        limit: 100,
      },
    });

    const rawPages = pagesRes.data?.data || [];
    console.log(`📊 Found ${rawPages.length} Facebook Pages.`);

    if (rawPages.length === 0) {
      return {
        success: true,
        user: { id: fbUser.id, name: fbUser.name },
        pagesCount: 0,
        pages: [],
        message: "No pages found for this account. Make sure you are an Admin of at least 1 Facebook Page.",
      };
    }

    // 3. Update User & FacebookPage in database
    const encryptedUserToken = encrypt(userToken);

    await prisma.user.update({
      where: { id: String(userId) },
      data: {
        facebookId: fbUser.id,
        facebookName: fbUser.name,
        facebookAccessToken: encryptedUserToken,
      },
    });

    const savedPages = [];

    for (const p of rawPages) {
      try {
        const encryptedPageToken = encrypt(p.access_token);
        const pictureUrl = p.picture?.data?.url || null;

        const pageData = {
          userId: String(userId),
          id: p.id,
          name: p.name,
          accessToken: encryptedPageToken,
          picture: pictureUrl,
          category: p.category || "General",
          followersCount: p.followers_count || 0,
          isConnected: true,
          isSelected: true,
          updatedAt: new Date(),
        };

        const existingPage = await prisma.facebookPage.findUnique({
          where: { id: p.id },
        });

        let saved = null;
        if (existingPage) {
          saved = await prisma.facebookPage.update({
            where: { id: p.id },
            data: pageData,
          });
        } else {
          saved = await prisma.facebookPage.create({
            data: pageData,
          });
        }

        // Try to auto-subscribe page to webhooks for bot replies
        try {
          await fb.subscribePage(p.id, p.access_token);
        } catch (subErr) {
          // ignore webhook subscription failure on unofficial tokens
        }

        savedPages.push({
          id: saved.id,
          name: saved.name,
          picture: saved.picture,
          category: saved.category,
          followersCount: saved.followersCount,
        });
      } catch (pageSaveErr) {
        console.warn(`⚠️ Error saving page ${p.name}:`, pageSaveErr.message);
      }
    }

    return {
      success: true,
      user: {
        id: fbUser.id,
        name: fbUser.name,
        picture: fbUser.picture?.data?.url,
      },
      pagesCount: savedPages.length,
      pages: savedPages,
      message: `Successfully connected ${savedPages.length} Facebook Pages!`,
    };
  }
}

module.exports = new FacebookCookieExtractor();

