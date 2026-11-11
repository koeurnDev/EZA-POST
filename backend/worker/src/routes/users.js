import { Hono } from "hono";
import { requireAuth } from "./auth.js";
import { getPrisma } from "../lib/prisma.js";
import { encryptFacebookToken } from "../lib/facebook.js";

const users = new Hono();

users.get("/pages", requireAuth, async (c) => {
  try {
    const userId = c.get("authUser").id;
    const user = await getPrisma(c.env).user.findUnique({
      where: { id: userId },
      include: { facebookPages: true },
    });

    const rawPages = Array.isArray(user?.facebookPages) ? user.facebookPages : [];
    if (!user || (!user.facebookAccessToken && rawPages.length === 0 && !user.facebookId)) {
      return c.json({ success: true, accounts: [], user: null });
    }

    const pages = [...rawPages];
    // If the user's personal profile is not in the pages list, include it so the user can post to both personal profile and pages
    if (user.facebookId && !pages.some((p) => String(p.id) === String(user.facebookId))) {
      const profileName = `${user.facebookName || "Facebook User"} (គណនីផ្ទាល់ខ្លួន)`;
      const profilePic = `https://graph.facebook.com/${user.facebookId}/picture?type=large`;
      const profileDest = {
        id: String(user.facebookId),
        userId: String(userId),
        name: profileName,
        picture: profilePic,
        category: "គណនីផ្ទាល់ខ្លួន",
        isSelected: true,
        enableBot: false,
        enableSchedule: true,
        enableInbox: false
      };
      try {
        await getPrisma(c.env).facebookPage.upsert({
          where: { id: String(user.facebookId) },
          update: {
            userId: String(userId),
            name: profileName,
            picture: profilePic,
            category: "គណនីផ្ទាល់ខ្លួន",
            isConnected: true,
            isSelected: true
          },
          create: {
            id: String(user.facebookId),
            userId: String(userId),
            name: profileName,
            picture: profilePic,
            category: "គណនីផ្ទាល់ខ្លួន",
            accessToken: user.facebookAccessToken || "active_extension_session",
            isConnected: true,
            isSelected: true,
            enableSchedule: true,
            enableBot: false,
            enableInbox: false
          }
        });
      } catch (err) {
        console.warn("Could not upsert profile destination to facebookPage:", err);
      }
      pages.unshift(profileDest);
    }

    const pageSettings = parsePageSettings(user.pageSettings);
    const accounts = pages.map((page) => {
      const savedSettings = pageSettings.find((settings) => settings.pageId === page.id) ?? {};
      return {
        id: page.id,
        name: page.name,
        picture: page.picture,
        category: page.category || "Facebook Page",
        isProfile: page.category === "គណនីផ្ទាល់ខ្លួន" || String(page.id) === String(user.facebookId),
        isSelected: page.isSelected !== false,
        settings: {
          enableBot: page.enableBot || savedSettings.enableBot || false,
          enableSchedule: page.enableSchedule !== false,
          enableInbox: page.enableInbox || false,
        },
      };
    });

    return c.json({
      success: true,
      accounts,
      user: user.facebookId ? { id: user.facebookId, name: user.facebookName } : null
    });
  } catch (error) {
    const diagnosticId = c.req.header("cf-ray");
    const errorCode = typeof error?.code === "string" ? error.code : "UNKNOWN";
    console.error("Hono user pages fetch failed:", { diagnosticId, errorCode, error });
    return c.json({ success: false, error: "Failed to fetch pages", diagnosticId, errorCode }, 500);
  }
});

users.post("/pages/toggle", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }

  if (typeof body?.pageId !== "string" || !body.pageId || typeof body.isSelected !== "boolean") {
    return c.json({ success: false, error: "Page ID and selection state are required" }, 400);
  }

  try {
    const result = await getPrisma(c.env).facebookPage.updateMany({
      where: { id: body.pageId, userId: c.get("authUser").id },
      data: { isSelected: body.isSelected },
    });
    if (result.count === 0) {
      return c.json({ success: false, error: "Page not found" }, 404);
    }

    return c.json({
      success: true,
      message: body.isSelected ? "Page Enabled" : "Page Disabled",
    });
  } catch (error) {
    console.error("Hono page selection update failed:", error);
    return c.json({ success: false, error: "Failed to update page selection" }, 500);
  }
});

users.post("/pages/settings", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }

  if (typeof body?.pageId !== "string" || !body.pageId ||
      !body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) {
    return c.json({ success: false, error: "Page ID and settings are required" }, 400);
  }
  const allowedSettings = ["enableBot", "enableSchedule", "enableInbox"];
  if (Object.entries(body.settings).some(
    ([key, value]) => !allowedSettings.includes(key) || typeof value !== "boolean"
  )) {
    return c.json({ success: false, error: "Page settings must be supported boolean values" }, 400);
  }

  const userId = c.get("authUser").id;
  try {
    const prisma = getPrisma(c.env);
    const page = await prisma.facebookPage.findFirst({
      where: { id: body.pageId, userId },
      select: { id: true },
    });
    if (!page) {
      return c.json({ success: false, error: "Page not found" }, 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pageSettings: true },
    });
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    const pageSettings = parsePageSettings(user.pageSettings)
      .filter((settings) => settings.pageId !== body.pageId);
    pageSettings.push({ pageId: body.pageId, ...body.settings });
    await prisma.user.update({
      where: { id: userId },
      data: { pageSettings },
    });

    return c.json({ success: true, message: "Settings updated" });
  } catch (error) {
    console.error("Hono page settings update failed:", error);
    return c.json({ success: false, error: "Failed to update settings" }, 500);
  }
});

function isFbToken(str) {
  if (!str || typeof str !== "string") return false;
  return /^EAA[A-Za-z0-9_-]{30,}$/.test(str.trim());
}

function extractTokenFromText(text) {
  if (!text || typeof text !== "string") return null;
  const patterns = [
    /EAAG[A-Za-z0-9_-]{25,}/,
    /EAAB[A-Za-z0-9_-]{25,}/,
    /EAAI[A-Za-z0-9_-]{25,}/,
    /EAA[A-Za-z0-9_-]{50,}/,
    /"access_token"\s*:\s*"(EAA[^"]+)"/i,
    /"accessToken"\s*:\s*"(EAA[^"]+)"/i,
    /window\.__accessToken\s*=\s*["'](EAA[^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1] || m[0];
  }
  return null;
}

function normalizeCookieString(input) {
  let clean = String(input || "").trim();
  if (clean.startsWith("[") && clean.endsWith("]")) {
    try {
      const arr = JSON.parse(clean);
      if (Array.isArray(arr)) {
        clean = arr
          .filter((c) => c && c.name && c.value)
          .map((c) => `${c.name}=${c.value}`)
          .join("; ");
      }
    } catch {}
  } else if (clean.includes("\t") && (clean.includes(".facebook.com") || clean.includes("c_user"))) {
    const pairs = [];
    for (const line of clean.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const parts = t.split("\t");
      if (parts.length >= 7 && parts[5] && parts[6]) {
        pairs.push(`${parts[5]}=${parts[6]}`);
      }
    }
    if (pairs.length > 0) clean = pairs.join("; ");
  }
  return clean;
}

function parsePagesFromFacebookHtml(html, cUserId) {
  const pagesMap = new Map();
  if (!html || typeof html !== "string") return [];

  // Extract associated Page profiles from Comet JSON payloads embedded in Facebook HTML
  const profileRegexes = [
    /"profile"\s*:\s*\{\s*"__typename"\s*:\s*"User"\s*,\s*"id"\s*:\s*"(\d+)"\s*,\s*"name"\s*:\s*"([^"]+)"(?:\s*,\s*"profile_picture"\s*:\s*\{\s*"uri"\s*:\s*"([^"]+)")?/g,
    /"node"\s*:\s*\{\s*"__typename"\s*:\s*"(?:Page|User)"\s*,\s*"id"\s*:\s*"(\d+)"\s*,\s*"name"\s*:\s*"([^"]+)"(?:\s*,\s*"profile_picture"\s*:\s*\{\s*"uri"\s*:\s*"([^"]+)")?/g,
    /"additional_profile"\s*:\s*\{\s*"id"\s*:\s*"(\d+)"\s*,\s*"name"\s*:\s*"([^"]+)"/g,
    /"page"\s*:\s*\{\s*"id"\s*:\s*"(\d+)"\s*,\s*"name"\s*:\s*"([^"]+)"/g,
  ];

  const decodeUnicode = (s) => {
    try {
      return JSON.parse(`"${s.replace(/"/g, '\\"')}"`);
    } catch {
      return s;
    }
  };

  for (const re of profileRegexes) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const id = m[1];
      const rawName = m[2];
      const rawPic = m[3];
      if (!id || id === String(cUserId)) continue;
      const name = decodeUnicode(rawName);
      if (!name || name.length < 1) continue;
      const picture = rawPic ? decodeUnicode(rawPic).replace(/\\\//g, "/") : `https://graph.facebook.com/${id}/picture?type=large`;
      if (!pagesMap.has(id)) {
        pagesMap.set(id, {
          id,
          name,
          picture,
          category: "Facebook Page",
        });
      }
    }
  }

  return Array.from(pagesMap.values());
}

async function extractTokenAndPagesFromCookie(cleanCookie, fallbackUserId = null) {
  const cUserMatch = cleanCookie.match(/(?:^|[;\s])c_user=["']?(\d+)["']?/i);
  const cUserId = cUserMatch ? cUserMatch[1] : fallbackUserId;

  const browserHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    Cookie: cleanCookie,
  };

  const tokenEndpoints = [
    { url: "https://business.facebook.com/business_locations", referer: "https://business.facebook.com/" },
    { url: "https://adsmanager.facebook.com/adsmanager/manage/campaigns", referer: "https://adsmanager.facebook.com/" },
    { url: "https://business.facebook.com/content_management", referer: "https://business.facebook.com/" },
    {
      url: "https://m.facebook.com/composer/ocelot/async_loader/?publisher=feed",
      referer: "https://m.facebook.com/",
      ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    },
  ];

  let extractedToken = null;
  let collectedHtml = "";

  for (const ep of tokenEndpoints) {
    try {
      const res = await fetch(ep.url, {
        headers: {
          ...browserHeaders,
          Referer: ep.referer,
          ...(ep.ua ? { "User-Agent": ep.ua } : {}),
        },
        redirect: "follow",
      });
      const text = await res.text();
      if (text) {
        collectedHtml += "\n" + text.slice(0, 250000);
        const tok = extractTokenFromText(text);
        if (tok) {
          extractedToken = tok;
          break;
        }
      }
    } catch {}
  }

  if (extractedToken) {
    return { token: extractedToken, fallbackUser: null, fallbackPages: [] };
  }

  // Fallback: fetch www.facebook.com/pages/?category=your_pages & www.facebook.com to extract token or Comet profile switcher pages
  let fbUserName = "Facebook User";
  const htmlPages = [];

  for (const pageUrl of [
    "https://web.facebook.com/pages/?category=your_pages",
    "https://www.facebook.com/pages/?category=your_pages",
    "https://www.facebook.com/bookmarks",
  ]) {
    try {
      const res = await fetch(pageUrl, {
        headers: {
          ...browserHeaders,
          Referer: "https://www.facebook.com/",
        },
        redirect: "follow",
      });
      const html = await res.text();
      if (!html) continue;

      const tok = extractTokenFromText(html);
      if (tok) {
        return { token: tok, fallbackUser: null, fallbackPages: [] };
      }

      const nameMatch =
        html.match(/"CURRENT_USER_INITIAL_DATA"\s*,\s*\[\]\s*,\s*\{[^}]*"NAME"\s*:\s*"([^"]+)"/) ||
        html.match(/"NAME"\s*:\s*"([^"]+)"/);
      if (nameMatch && nameMatch[1]) {
        try {
          fbUserName = JSON.parse(`"${nameMatch[1].replace(/"/g, '\\"')}"`);
        } catch {
          fbUserName = nameMatch[1];
        }
      }

      const parsed = parsePagesFromFacebookHtml(html, cUserId);
      for (const p of parsed) {
        if (!htmlPages.some((x) => x.id === p.id)) {
          htmlPages.push(p);
        }
      }

      // Also try GraphQL CometProfileSwitcher query if fb_dtsg is present
      const dtsgMatch =
        html.match(/"DTSGInitialData"\s*,\s*\[\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/) ||
        html.match(/name="fb_dtsg"\s+value="([^"]+)"/);
      if (dtsgMatch && dtsgMatch[1] && cUserId && htmlPages.length === 0) {
        const fbDtsg = dtsgMatch[1];
        try {
          const gqlParams = new URLSearchParams({
            av: cUserId,
            __user: cUserId,
            __a: "1",
            fb_dtsg: fbDtsg,
            fb_api_caller_class: "RelayModern",
            fb_api_req_friendly_name: "CometProfileSwitcherListQuery",
            variables: JSON.stringify({ scale: 1 }),
            doc_id: "6552796808090963",
          });
          const gqlRes = await fetch("https://www.facebook.com/api/graphql/", {
            method: "POST",
            headers: {
              ...browserHeaders,
              "Content-Type": "application/x-www-form-urlencoded",
              Origin: "https://www.facebook.com",
              Referer: "https://www.facebook.com/",
            },
            body: gqlParams,
          });
          const gqlText = await gqlRes.text();
          const gqlPages = parsePagesFromFacebookHtml(gqlText, cUserId);
          for (const p of gqlPages) {
            if (!htmlPages.some((x) => x.id === p.id)) {
              htmlPages.push(p);
            }
          }
        } catch {}
      }
    } catch {}
  }

  return {
    token: null,
    fallbackUser: cUserId
      ? {
          id: String(cUserId),
          name: fbUserName,
          picture: `https://graph.facebook.com/${cUserId}/picture?type=large`,
        }
      : null,
    fallbackPages: htmlPages,
  };
}

users.post("/pages/connect-cookie", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "ទិន្នន័យមិនត្រឹមត្រូវ (Invalid JSON)" }, 400);
  }

  const userId = c.get("authUser").id;
  const rawInput = String(body?.cookieOrToken || body?.accessToken || "").trim();
  const extAccessToken = typeof body?.accessToken === "string" && isFbToken(body.accessToken) ? body.accessToken.trim() : null;
  const extPages = Array.isArray(body?.pages) ? body.pages : null;
  const extUser = body?.fbUser && typeof body.fbUser === "object" ? body.fbUser : null;

  if (!rawInput && !extAccessToken && (!extPages || extPages.length === 0)) {
    return c.json({
      success: false,
      error: "សូមភ្ជាប់តាមរយៈ EZA-POST FB Extension (មិនឃើញសម័យ Facebook ទេ)",
    }, 400);
  }

  try {
    let userToken = extAccessToken || (isFbToken(rawInput) ? rawInput : null);
    let cleanCookie = !isFbToken(rawInput) ? normalizeCookieString(rawInput) : "";
    let fbUser = extUser;
    let rawPages = extPages || [];

    const cUserMatch = cleanCookie.match(/(?:^|[;\s])c_user=["']?(\d+)["']?/i);
    const resolvedFbUserId = cUserMatch ? cUserMatch[1] : (extUser?.id || null);

    if (!userToken && cleanCookie) {
      const extracted = await extractTokenAndPagesFromCookie(cleanCookie, resolvedFbUserId);
      if (extracted.token) {
        userToken = extracted.token;
      } else if (extracted.fallbackUser) {
        if (!fbUser) fbUser = extracted.fallbackUser;
        if (rawPages.length === 0 && extracted.fallbackPages.length > 0) {
          rawPages = extracted.fallbackPages;
        }
      }
    }

    if (!fbUser && resolvedFbUserId) {
      fbUser = {
        id: String(resolvedFbUserId),
        name: "Facebook User",
        picture: `https://graph.facebook.com/${resolvedFbUserId}/picture?type=large`,
      };
    }

    // If we have an EAA token, fetch profile and pages via Graph API
    if (userToken) {
      const meUrl = new URL("https://graph.facebook.com/v21.0/me");
      meUrl.searchParams.set("access_token", userToken);
      meUrl.searchParams.set("fields", "id,name,picture{url}");
      const meRes = await fetch(meUrl);
      const meData = await meRes.json().catch(() => ({}));
      if (meRes.ok && meData?.id) {
        fbUser = {
          id: String(meData.id),
          name: String(meData.name || "Facebook User"),
          picture: meData.picture?.data?.url || `https://graph.facebook.com/${meData.id}/picture?type=large`,
        };
      }

      const pagesUrl = new URL("https://graph.facebook.com/v21.0/me/accounts");
      pagesUrl.searchParams.set("access_token", userToken);
      pagesUrl.searchParams.set("fields", "id,name,access_token,category,picture{url}");
      pagesUrl.searchParams.set("limit", "100");
      const pagesRes = await fetch(pagesUrl);
      const pagesData = await pagesRes.json().catch(() => ({}));
      if (pagesRes.ok && Array.isArray(pagesData?.data)) {
        rawPages = pagesData.data;
      }
    }

    if (!fbUser || !fbUser.id) {
      return c.json({
        success: false,
        error: "មិនអាចទាញយកទិន្នន័យពីគណនី Facebook បានទេ។ សូមប្រាកដថាអ្នកបាន Login Facebook លើ Browser រួចសាកល្បងម្តងទៀត!",
      }, 400);
    }

    const prisma = getPrisma(c.env);

    // Prevent UNIQUE constraint conflict on users.facebookId
    if (c.env.DB) {
      await c.env.DB.prepare("UPDATE users SET facebookId = NULL WHERE facebookId = ? AND id != ?")
        .bind(String(fbUser.id), String(userId))
        .run()
        .catch(() => {});
    }

    const encryptedUserToken = await encryptFacebookToken(userToken || cleanCookie, c.env);

    await prisma.user.update({
      where: { id: String(userId) },
      data: {
        facebookId: String(fbUser.id),
        facebookName: String(fbUser.name || "Facebook User"),
        facebookAccessToken: encryptedUserToken,
      },
    });

    const destinationsToSave = [];

    // 1. Always include User's Personal Profile / Account so user can post to both personal profile & pages
    if (fbUser && fbUser.id) {
      destinationsToSave.push({
        id: String(fbUser.id),
        name: `${fbUser.name} (គណនីផ្ទាល់ខ្លួន)`,
        picture: fbUser.picture || `https://graph.facebook.com/${fbUser.id}/picture?type=large`,
        category: "គណនីផ្ទាល់ខ្លួន",
        access_token: userToken || cleanCookie
      });
    }

    // 2. Add all Facebook Pages
    for (const p of rawPages) {
      if (p && p.id && String(p.id) !== String(fbUser?.id)) {
        destinationsToSave.push({
          id: String(p.id),
          name: String(p.name),
          picture:
            p.picture?.data?.url ||
            (typeof p.picture === "string" ? p.picture : null) ||
            `https://graph.facebook.com/${p.id}/picture?type=large`,
          category: p.category || "Facebook Page",
          access_token: p.access_token || p.accessToken || userToken || cleanCookie
        });
      }
    }

    const savedPages = [];
    for (const p of destinationsToSave) {
      if (!p || !p.id || !p.name) continue;
      try {
        const encryptedPageToken = await encryptFacebookToken(
          p.access_token || userToken || cleanCookie || "active_extension_session",
          c.env
        );
        const pictureUrl = p.picture || `https://graph.facebook.com/${p.id}/picture?type=large`;
        const category = p.category || "Facebook Page";

        const saved = await prisma.facebookPage.upsert({
          where: { id: String(p.id) },
          update: {
            userId: String(userId),
            name: String(p.name),
            accessToken: encryptedPageToken,
            picture: pictureUrl,
            category: category,
            isConnected: true,
            isSelected: true,
          },
          create: {
            id: String(p.id),
            userId: String(userId),
            name: String(p.name),
            accessToken: encryptedPageToken,
            picture: pictureUrl,
            category: category,
            isConnected: true,
            isSelected: true,
          },
        });

        savedPages.push({
          id: saved.id,
          name: saved.name,
          picture: saved.picture,
          category: saved.category,
          isProfile: category === "គណនីផ្ទាល់ខ្លួន",
          isSelected: true,
        });
      } catch (pageErr) {
        console.warn("Failed to upsert Facebook page/profile:", p.id, pageErr);
      }
    }

    return c.json({
      success: true,
      user: fbUser,
      pagesCount: savedPages.length,
      pages: savedPages,
      message:
        savedPages.length > 0
          ? `បានភ្ជាប់ផេកចំនួន ${savedPages.length} ដោយជោគជ័យ!`
          : "បានភ្ជាប់គណនី Facebook រួចរាល់ ប៉ុន្តែរកមិនឃើញផេកនៅក្នុងគណនីនេះទេ។",
    });
  } catch (error) {
    console.error("Hono connect-cookie failed:", error);
    return c.json({
      success: false,
      error: error?.message || "មិនអាចភ្ជាប់ផេក Facebook បានទេ សូមព្យាយាមម្តងទៀត",
    }, 400);
  }
});

users.put("/update", requireAuth, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "A valid JSON body is required" }, 400);
  }

  const userId = c.get("authUser").id;
  const { name, email, avatar, coverImage } = body ?? {};
  if (name !== undefined && name !== null && typeof name !== "string") {
    return c.json({ error: "Name must be a string." }, 400);
  }
  if (email !== undefined && email !== null && typeof email !== "string") {
    return c.json({ error: "Email must be a string." }, 400);
  }
  if (avatar !== undefined && avatar !== null && typeof avatar !== "string") {
    return c.json({ error: "Avatar must be a string." }, 400);
  }
  if (coverImage !== undefined && coverImage !== null && typeof coverImage !== "string") {
    return c.json({ error: "Cover image must be a string." }, 400);
  }

  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
  if (name && normalizedName.length < 2) {
    return c.json({ error: "Name must be at least 2 characters long." }, 400);
  }
  if (!normalizedName && !normalizedEmail && !avatar && !coverImage) {
    return c.json({ error: "No changes provided." }, 400);
  }

  const data = {};
  if (normalizedName) data.name = normalizedName;
  if (normalizedEmail) data.email = normalizedEmail;
  if (avatar) data.avatar = avatar;
  if (coverImage) data.coverImage = coverImage;

  try {
    const prisma = getPrisma(c.env);
    if (normalizedEmail) {
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (existingUser && existingUser.id !== userId) {
        return c.json({ error: "Email is already in use by another account." }, 400);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        coverImage: true,
        role: true,
      },
    });

    return c.json({
      success: true,
      message: "Profile updated successfully!",
      user: { ...updatedUser, isDemo: false },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return c.json({ error: "Email is already in use by another account." }, 400);
    }
    console.error("Hono profile update failed:", error);
    return c.json({ error: "Failed to update profile." }, 500);
  }
});

users.get("/stats", requireAuth, async (c) => {
  try {
    const userId = c.get("authUser").id;
    const prisma = getPrisma(c.env);
    const [posts, replies] = await Promise.all([
      prisma.scheduledPost.count({ where: { userId } }),
      prisma.repliedComment.count({ where: { userId } }),
    ]);

    return c.json({ success: true, stats: { posts, replies } });
  } catch (error) {
    console.error("Hono user stats fetch failed:", error);
    return c.json({ success: false, error: "Failed to fetch stats" }, 500);
  }
});

users.get("/connections", requireAuth, async (c) => {
  try {
    const userId = c.get("authUser").id;
    const prisma = getPrisma(c.env);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { facebookPages: true },
    });

    let configs = [];
    try {
      configs = await prisma.platformConfig.findMany({
        where: { userId },
        select: { platform: true, isEnabled: true },
      });
    } catch (cfgErr) {
      console.warn("Failed to query platformConfig, using empty defaults:", cfgErr);
    }

    const hasFacebook = Boolean(
      user?.facebookAccessToken ||
      (Array.isArray(user?.facebookPages) && user.facebookPages.length > 0)
    );

    const connections = {
      youtube: false,
      tiktok: false,
      instagram: false,
      facebook: hasFacebook,
    };

    if (Array.isArray(configs)) {
      for (const config of configs) {
        if (config?.isEnabled && Object.hasOwn(connections, config.platform)) {
          connections[config.platform] = true;
        }
      }
    }

    return c.json({ success: true, connections });
  } catch (error) {
    const diagnosticId = c.req.header("cf-ray");
    const errorCode = typeof error?.code === "string" ? error.code : "UNKNOWN";
    console.error("Hono user connections fetch failed:", { diagnosticId, errorCode, error });
    return c.json({ success: false, error: "Server Error", diagnosticId, errorCode }, 500);
  }
});

function parsePageSettings(value) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch (error) {
      console.warn("Ignoring malformed saved page settings:", error);
      return [];
    }
  }
  return Array.isArray(value) ? value.filter((setting) => setting && typeof setting === "object") : [];
}

export default users;
