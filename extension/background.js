/**
 * ============================================================
 * ⚡ EZA-POST Facebook Sync Extension — Background Service Worker (v2.0.1)
 * ============================================================
 */

function extractTokenFromText(text) {
  if (!text || typeof text !== "string") return null;
  const patterns = [
    /EAAG[A-Za-z0-9_-]{25,}/,
    /EAAB[A-Za-z0-9_-]{25,}/,
    /EAAI[A-Za-z0-9_-]{25,}/,
    /EAA[A-Za-z0-9_-]{50,}/,
    /"access_token"\s*:\s*"(EAA[^"]+)"/i,
    /"accessToken"\s*:\s*"(EAA[^"]+)"/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1] || m[0];
  }
  return null;
}

function parsePagesFromFacebookHtml(html, cUserId) {
  const pagesMap = new Map();
  if (!html || typeof html !== "string") return [];

  const profileRegexes = [
    /"profile"\s*:\s*\{\s*"__typename"\s*:\s*"User"\s*,\s*"id"\s*:\s*"(\d+)"\s*,\s*"name"\s*:\s*"([^"]+)"(?:\s*,\s*"profile_picture"\s*:\s*\{\s*"uri"\s*:\s*"([^"]+)")?/g,
    /"node"\s*:\s*\{\s*"__typename"\s*:\s*"(?:Page|User)"\s*,\s*"id"\s*:\s*"(\d+)"\s*,\s*"name"\s*:\s*"([^"]+)"(?:\s*,\s*"profile_picture"\s*:\s*\{\s*"uri"\s*:\s*"([^"]+)")?/g,
    /"additional_profile"\s*:\s*\{\s*"id"\s*:\s*"(\d+)"\s*,\s*"name"\s*:\s*"([^"]+)"/g,
    /"page"\s*:\s*\{\s*"id"\s*:\s*"(\d+)"\s*,\s*"name"\s*:\s*"([^"]+)"/g
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
      const picture = rawPic
        ? decodeUnicode(rawPic).replace(/\\\//g, "/")
        : `https://graph.facebook.com/${id}/picture?type=large`;
      if (!pagesMap.has(id)) {
        pagesMap.set(id, {
          id,
          name,
          picture,
          category: "Facebook Page"
        });
      }
    }
  }

  return Array.from(pagesMap.values());
}

async function getAllFacebookCookies() {
  const cookieMap = new Map();

  // 1. Gather cookies from all active Facebook tabs (e.g. web.facebook.com)
  try {
    const tabs = await chrome.tabs.query({
      url: ["*://*.facebook.com/*", "*://facebook.com/*"]
    });
    for (const tab of tabs) {
      if (tab.url) {
        try {
          const list = await chrome.cookies.getAll({ url: tab.url });
          if (Array.isArray(list)) {
            for (const c of list) {
              if (c?.name && c?.value) {
                cookieMap.set(c.name, c.value);
              }
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  // 2. Query specific Facebook URLs
  const targetUrls = [
    "https://web.facebook.com",
    "https://www.facebook.com",
    "https://facebook.com",
    "https://m.facebook.com",
    "https://business.facebook.com"
  ];
  for (const url of targetUrls) {
    try {
      const list = await chrome.cookies.getAll({ url });
      if (Array.isArray(list)) {
        for (const c of list) {
          if (c?.name && c?.value && !cookieMap.has(c.name)) {
            cookieMap.set(c.name, c.value);
          }
        }
      }
    } catch (e) {}
  }

  // 3. Query domains (WITHOUT leading dot)
  const targetDomains = [
    "facebook.com",
    "web.facebook.com",
    "www.facebook.com",
    "business.facebook.com",
    "m.facebook.com"
  ];
  for (const domain of targetDomains) {
    try {
      const list = await chrome.cookies.getAll({ domain });
      if (Array.isArray(list)) {
        for (const c of list) {
          if (c?.name && c?.value && !cookieMap.has(c.name)) {
            cookieMap.set(c.name, c.value);
          }
        }
      }
    } catch (e) {}
  }

  // 4. Fallback search across all accessible cookies for any facebook cookie
  try {
    const all = await chrome.cookies.getAll({});
    if (Array.isArray(all)) {
      for (const c of all) {
        if (c?.name && c?.value && typeof c.domain === "string" && c.domain.includes("facebook.com")) {
          if (!cookieMap.has(c.name)) {
            cookieMap.set(c.name, c.value);
          }
        }
      }
    }
  } catch (e) {}

  return cookieMap;
}

async function getFacebookSessionData() {
  try {
    const cookieMap = await getAllFacebookCookies();
    const cUserId = cookieMap.get("c_user");
    const xs = cookieMap.get("xs");

    if (!cUserId) {
      return {
        ok: false,
        fbLoggedIn: false,
        fbUserId: null,
        cookieString: "",
        error: "រកមិនឃើញគណនី Facebook ដែលបាន Login លើ Browser ទេ។ សូម Login គណនី Facebook ជាមុនសិន!"
      };
    }

    const cookieString = Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    return {
      ok: true,
      fbLoggedIn: true,
      fbUserId: cUserId,
      cookieString
    };
  } catch (err) {
    return {
      ok: false,
      fbLoggedIn: false,
      fbUserId: null,
      cookieString: "",
      error: err?.message || "មិនអាចអានសម័យ Facebook ពី Browser បានទេ"
    };
  }
}

async function getFullFacebookSyncPayload() {
  try {
    const session = await getFacebookSessionData();
    if (!session.ok || !session.fbUserId) return session;

    let accessToken = null;
    let fbUserName = "Facebook User";
    let pages = [];

    // Attempt to extract name directly from an open Facebook tab if available
    try {
      const tabs = await chrome.tabs.query({
        url: ["*://*.facebook.com/*", "*://facebook.com/*"]
      });
      if (tabs.length > 0 && tabs[0]?.id && chrome.scripting) {
        const injected = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            let name = null;
            try {
              const html = document.documentElement.innerHTML || "";
              const match =
                html.match(/"CURRENT_USER_INITIAL_DATA"\s*,\s*\[\]\s*,\s*\{[^}]*"NAME"\s*:\s*"([^"]+)"/) ||
                html.match(/"NAME"\s*:\s*"([^"]+)"/);
              if (match && match[1]) {
                name = JSON.parse(`"${match[1].replace(/"/g, '\\"')}"`);
              }
            } catch (e) {}
            return { name };
          }
        }).catch(() => null);

        if (injected?.[0]?.result?.name) {
          fbUserName = injected[0].result.name;
        }
      }
    } catch (e) {}

    // Check endpoints from the browser to obtain access token or pages
    const endpoints = [
      "https://business.facebook.com/business_locations",
      "https://adsmanager.facebook.com/adsmanager/manage/campaigns",
      "https://web.facebook.com/pages/?category=your_pages",
      "https://www.facebook.com/pages/?category=your_pages"
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { credentials: "include", redirect: "follow" }).catch(() => null);
        if (!res) continue;
        const html = await res.text().catch(() => "");
        if (!html) continue;

        const tok = extractTokenFromText(html);
        if (tok && !accessToken) {
          accessToken = tok;
        }

        if (fbUserName === "Facebook User") {
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
        }

        const extractedPages = parsePagesFromFacebookHtml(html, session.fbUserId);
        for (const p of extractedPages) {
          if (!pages.some((x) => x.id === p.id)) {
            pages.push(p);
          }
        }
      } catch (e) {}
    }

    const fbUser = {
      id: String(session.fbUserId),
      name: fbUserName,
      picture: `https://graph.facebook.com/${session.fbUserId}/picture?type=large`
    };

    return {
      ...session,
      accessToken,
      fbUser,
      pages
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || "កំហុសក្នុងការទាញយកទិន្នន័យ Facebook"
    };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  if (message.action === "CHECK_FB_STATUS") {
    getFacebookSessionData()
      .then((data) => {
        sendResponse({
          installed: true,
          version: "2.0.1",
          fbLoggedIn: Boolean(data?.fbLoggedIn),
          fbUserId: data?.fbUserId || null
        });
      })
      .catch(() => {
        sendResponse({ installed: true, version: "2.0.1", fbLoggedIn: false, fbUserId: null });
      });
    return true;
  }

  if (message.action === "GET_FB_SYNC_PAYLOAD") {
    getFullFacebookSyncPayload()
      .then((data) => {
        sendResponse(data);
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err?.message || "Sync error" });
      });
    return true;
  }

  return false;
});
