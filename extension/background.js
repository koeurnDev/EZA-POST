/**
 * ============================================================
 * ⚡ EZA-POST Facebook Sync Extension — Background Service Worker (v2.0.2)
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

function findProfilesInObject(obj, cUserId, foundMap) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) findProfilesInObject(item, cUserId, foundMap);
    return;
  }
  if (
    obj.id &&
    obj.name &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    obj.id !== String(cUserId) &&
    obj.id.length >= 4 &&
    obj.name.trim().length > 0 &&
    !obj.name.includes("CURRENT_USER")
  ) {
    const pic =
      obj.profile_picture?.uri ||
      obj.picture?.data?.url ||
      (typeof obj.picture === "string" ? obj.picture : null) ||
      `https://graph.facebook.com/${obj.id}/picture?type=large`;

    if (!foundMap.has(obj.id)) {
      foundMap.set(obj.id, {
        id: obj.id,
        name: obj.name,
        picture: pic,
        category: obj.category || obj.category_name || "Facebook Page",
        access_token: obj.access_token || null
      });
    }
  }
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === "object") {
      findProfilesInObject(obj[k], cUserId, foundMap);
    }
  }
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

// In-tab script that executes directly inside user's active Facebook tab
async function extractDataInsideFacebookTab() {
  const result = {
    userName: null,
    accessToken: null,
    pages: []
  };

  const pagesMap = new Map();
  const html = document.documentElement?.innerHTML || "";

  // 1. Detect User Name
  try {
    const nameMatch =
      html.match(/"CURRENT_USER_INITIAL_DATA"\s*,\s*\[\]\s*,\s*\{[^}]*"NAME"\s*:\s*"([^"]+)"/) ||
      html.match(/"NAME"\s*:\s*"([^"]+)"/);
    if (nameMatch && nameMatch[1]) {
      try {
        result.userName = JSON.parse(`"${nameMatch[1].replace(/\\"/g, '"').replace(/"/g, '\\"')}"`);
      } catch {
        result.userName = nameMatch[1];
      }
    }
  } catch (e) {}

  // 2. Search for existing EAA Token in the current page
  const tokenMatch = html.match(/(EAAG[A-Za-z0-9_-]+|EAAB[A-Za-z0-9_-]+|EAAI[A-Za-z0-9_-]+|EAA[A-Za-z0-9_-]{50,})/);
  if (tokenMatch) {
    result.accessToken = tokenMatch[1];
  }

  // 3. If no token found yet, query m.facebook.com or business_locations using browser session
  if (!result.accessToken) {
    const probeUrls = [
      "https://business.facebook.com/business_locations",
      "https://adsmanager.facebook.com/adsmanager/manage/campaigns",
      "https://m.facebook.com/composer/ocelot/async_loader/?publisher=feed"
    ];
    for (const url of probeUrls) {
      try {
        const res = await fetch(url, { credentials: "include" });
        const text = await res.text();
        const m = text.match(/(EAAG[A-Za-z0-9_-]+|EAAB[A-Za-z0-9_-]+|EAAI[A-Za-z0-9_-]+|EAA[A-Za-z0-9_-]{50,})/);
        if (m) {
          result.accessToken = m[1];
          break;
        }
      } catch (e) {}
    }
  }

  // 4. If we have an Access Token, fetch pages from Graph API directly
  if (result.accessToken) {
    try {
      const gRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${result.accessToken}&fields=id,name,access_token,category,picture{url}&limit=100`
      );
      const gData = await gRes.json();
      if (Array.isArray(gData?.data)) {
        for (const p of gData.data) {
          if (p?.id && p?.name) {
            pagesMap.set(p.id, {
              id: p.id,
              name: p.name,
              picture: p.picture?.data?.url || `https://graph.facebook.com/${p.id}/picture?type=large`,
              category: p.category || "Facebook Page",
              access_token: p.access_token || result.accessToken
            });
          }
        }
      }
    } catch (e) {}
  }

  // 5. Query Facebook Comet Profile Switcher GraphQL (returns ALL pages user can switch to)
  try {
    const dtsgMatch =
      html.match(/"DTSGInitialData"\s*,\s*\[\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/) ||
      html.match(/name="fb_dtsg"\s+value="([^"]+)"/);
    const userMatch =
      html.match(/"USER_ID"\s*:\s*"(\d+)"/) ||
      html.match(/"ACCOUNT_ID"\s*:\s*"(\d+)"/);

    const fbDtsg = dtsgMatch ? dtsgMatch[1] : null;
    const cUserId = userMatch ? userMatch[1] : null;

    if (fbDtsg && cUserId) {
      const docIds = ["6552796808090963", "5430261317056683"];
      for (const docId of docIds) {
        try {
          const body = new URLSearchParams({
            av: cUserId,
            __user: cUserId,
            __a: "1",
            fb_dtsg: fbDtsg,
            fb_api_caller_class: "RelayModern",
            fb_api_req_friendly_name: "CometProfileSwitcherListQuery",
            variables: JSON.stringify({ scale: 1 }),
            doc_id: docId
          });
          const gqlRes = await fetch("/api/graphql/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body
          });
          const gqlText = await gqlRes.text();
          if (gqlText) {
            // Remove for (;;); security prefix if present
            const cleanGql = gqlText.replace(/^for\s*\(\s*;\s*;\s*\)\s*;\s*/, "").trim();
            const lines = cleanGql.split(/\r?\n/).filter(Boolean);
            for (const line of lines) {
              try {
                const gqlData = JSON.parse(line);
                findProfilesInObject(gqlData, cUserId, pagesMap);
              } catch (e) {}
            }
            if (pagesMap.size > 0) break;
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  // 6. Query /pages/?category=your_pages
  try {
    const yourPagesRes = await fetch("/pages/?category=your_pages", { credentials: "include" });
    const yourPagesHtml = await yourPagesRes.text();
    if (yourPagesHtml) {
      // Find embedded JSON objects for pages
      const pageRegexes = [
        /"page"\s*:\s*\{\s*"id"\s*:\s*"(\d+)"\s*,\s*"name"\s*:\s*"([^"]+)"/g,
        /"node"\s*:\s*\{\s*"__typename"\s*:\s*"Page"\s*,\s*"id"\s*:\s*"(\d+)"\s*,\s*"name"\s*:\s*"([^"]+)"/g,
        /"additional_profile"\s*:\s*\{\s*"id"\s*:\s*"(\d+)"\s*,\s*"name"\s*:\s*"([^"]+)"/g
      ];
      for (const re of pageRegexes) {
        let m;
        while ((m = re.exec(yourPagesHtml)) !== null) {
          const id = m[1];
          const rawName = m[2];
          if (id && rawName) {
            let name = rawName;
            try {
              name = JSON.parse(`"${rawName.replace(/\\"/g, '"').replace(/"/g, '\\"')}"`);
            } catch (e) {
              name = rawName;
            }
            if (!pagesMap.has(id)) {
              pagesMap.set(id, {
                id,
                name,
                picture: `https://graph.facebook.com/${id}/picture?type=large`,
                category: "Facebook Page"
              });
            }
          }
        }
      }
    }
  } catch (e) {}

  result.pages = Array.from(pagesMap.values());
  return result;
}

async function getFullFacebookSyncPayload() {
  try {
    const session = await getFacebookSessionData();
    if (!session.ok || !session.fbUserId) return session;

    let accessToken = null;
    let fbUserName = "Facebook User";
    const pagesMap = new Map();

    // 1. Try in-tab extraction on active Facebook tab (e.g. web.facebook.com)
    try {
      const tabs = await chrome.tabs.query({
        url: ["*://*.facebook.com/*", "*://facebook.com/*"]
      });
      if (tabs.length > 0 && tabs[0]?.id && chrome.scripting) {
        const injected = await chrome.scripting
          .executeScript({
            target: { tabId: tabs[0].id },
            func: extractDataInsideFacebookTab
          })
          .catch(() => null);

        if (injected?.[0]?.result) {
          const res = injected[0].result;
          if (res.userName) fbUserName = res.userName;
          if (res.accessToken) accessToken = res.accessToken;
          if (Array.isArray(res.pages)) {
            for (const p of res.pages) {
              if (p?.id && p?.name && p.id !== session.fbUserId) {
                pagesMap.set(p.id, p);
              }
            }
          }
        }
      }
    } catch (e) {}

    // 2. If no tab was open or token still missing, probe from service worker
    if (!accessToken) {
      const endpoints = [
        "https://business.facebook.com/business_locations",
        "https://adsmanager.facebook.com/adsmanager/manage/campaigns",
        "https://m.facebook.com/composer/ocelot/async_loader/?publisher=feed"
      ];
      for (const url of endpoints) {
        try {
          const res = await fetch(url, { credentials: "include", redirect: "follow" }).catch(() => null);
          if (!res) continue;
          const html = await res.text().catch(() => "");
          if (!html) continue;

          const tok = extractTokenFromText(html);
          if (tok) {
            accessToken = tok;
            break;
          }
        } catch (e) {}
      }
    }

    // 3. If token is now available, fetch any extra Graph API pages
    if (accessToken) {
      try {
        const pagesUrl = new URL("https://graph.facebook.com/v21.0/me/accounts");
        pagesUrl.searchParams.set("access_token", accessToken);
        pagesUrl.searchParams.set("fields", "id,name,access_token,category,picture{url}");
        pagesUrl.searchParams.set("limit", "100");
        const pagesRes = await fetch(pagesUrl).catch(() => null);
        if (pagesRes) {
          const pagesData = await pagesRes.json().catch(() => ({}));
          if (Array.isArray(pagesData?.data)) {
            for (const p of pagesData.data) {
              if (p?.id && p?.name && p.id !== session.fbUserId) {
                pagesMap.set(p.id, {
                  id: p.id,
                  name: p.name,
                  picture: p.picture?.data?.url || `https://graph.facebook.com/${p.id}/picture?type=large`,
                  category: p.category || "Facebook Page",
                  access_token: p.access_token || accessToken
                });
              }
            }
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
      pages: Array.from(pagesMap.values())
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
          version: "2.0.2",
          fbLoggedIn: Boolean(data?.fbLoggedIn),
          fbUserId: data?.fbUserId || null
        });
      })
      .catch(() => {
        sendResponse({ installed: true, version: "2.0.2", fbLoggedIn: false, fbUserId: null });
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
