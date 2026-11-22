/**
 * ============================================================
 * ⚡ EZA-POST Facebook Sync Extension — Background Service Worker (v2.3.0)
 * ============================================================
 */

const capturedAdsTokens = new Set();
const capturedAdsGraphTokens = new Set();

function recordInterceptedToken(tok, isAdsGraph) {
  if (!tok || typeof tok !== "string" || !/^EAA[A-Za-z0-9_-]{30,}$/.test(tok)) return;
  if (isAdsGraph) {
    capturedAdsGraphTokens.add(tok);
    capturedAdsTokens.add(tok);
    chrome.storage.local
      .set({
        capturedAdsToken: tok,
        capturedAdsTokenFromAdsGraph: true,
        capturedAdsTokenAt: Date.now()
      })
      .catch(() => {});
  } else if (tok.startsWith("EAAB")) {
    capturedAdsTokens.add(tok);
    chrome.storage.local
      .set({
        capturedAdsToken: tok,
        capturedAdsTokenFromAdsGraph: false,
        capturedAdsTokenAt: Date.now()
      })
      .catch(() => {});
  }
}

if (typeof chrome !== "undefined" && chrome.webRequest?.onBeforeRequest) {
  try {
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => {
        try {
          const url = details.url || "";
          const isAdsGraph =
            url.includes("adsmanager-graph.facebook.com") ||
            url.includes("/adaccounts") ||
            url.includes("/adcreatives") ||
            url.includes("/campaigns");
          const found = [];
          try {
            const decodedUrl = decodeURIComponent(url);
            const uMatches = decodedUrl.match(/EAA[A-Za-z0-9_-]{30,}/g);
            if (uMatches) found.push(...uMatches);
          } catch {}

          const fd = details.requestBody?.formData;
          if (fd && typeof fd === "object") {
            for (const vals of Object.values(fd)) {
              for (const v of vals || []) {
                if (typeof v === "string" && v.includes("EAA")) {
                  const fm = v.match(/EAA[A-Za-z0-9_-]{30,}/g);
                  if (fm) found.push(...fm);
                }
              }
            }
          }

          const raw = details.requestBody?.raw;
          if (Array.isArray(raw)) {
            const decoder = new TextDecoder("utf-8");
            for (const chunk of raw) {
              if (chunk?.bytes) {
                const text = decoder.decode(chunk.bytes);
                if (text.includes("EAA")) {
                  const rm = text.match(/EAA[A-Za-z0-9_-]{30,}/g);
                  if (rm) found.push(...rm);
                }
              }
            }
          }

          for (const tok of found) {
            recordInterceptedToken(tok, isAdsGraph);
          }
        } catch {}
      },
      {
        urls: [
          "*://adsmanager-graph.facebook.com/*",
          "*://graph.facebook.com/*",
          "*://graph-video.facebook.com/*"
        ]
      },
      ["requestBody"]
    );
  } catch {}
}

if (typeof chrome !== "undefined" && chrome.webRequest?.onBeforeSendHeaders) {
  try {
    chrome.webRequest.onBeforeSendHeaders.addListener(
      (details) => {
        try {
          const url = details.url || "";
          const isAdsGraph = url.includes("adsmanager-graph.facebook.com");
          for (const h of details.requestHeaders || []) {
            if (h?.name?.toLowerCase() === "authorization" && typeof h.value === "string" && h.value.includes("EAA")) {
              const m = h.value.match(/EAA[A-Za-z0-9_-]{30,}/g);
              if (m) m.forEach((tok) => recordInterceptedToken(tok, isAdsGraph));
            }
          }
        } catch {}
      },
      {
        urls: [
          "*://adsmanager-graph.facebook.com/*",
          "*://graph.facebook.com/*",
          "*://graph-video.facebook.com/*"
        ]
      },
      ["requestHeaders"]
    );
  } catch {}
}

function extractAllTokensFromText(text) {
  if (!text || typeof text !== "string") return [];
  const seen = new Set();
  const normalized = text.replace(/\\\//g, "/");
  const matches = normalized.match(/EAA[A-Za-z0-9_-]{30,}/g) || [];
  for (const tok of matches) {
    seen.add(tok);
  }
  return Array.from(seen);
}

async function validateAdsToken(token, fromAdsGraph = false) {
  if (!token || typeof token !== "string") return null;
  try {
    const graphHost = fromAdsGraph ? "https://adsmanager-graph.facebook.com" : "https://graph.facebook.com";
    let accRes = await fetch(
      `${graphHost}/v21.0/me/adaccounts?fields=id,account_id,name,account_status,currency&limit=50&access_token=${encodeURIComponent(token)}`,
      { credentials: "include" }
    ).catch(() => null);
    if (!accRes?.ok && fromAdsGraph) {
      accRes = await fetch(
        `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,account_id,name,account_status,currency&limit=50&access_token=${encodeURIComponent(token)}`,
        { credentials: "include" }
      ).catch(() => null);
    }
    if (!accRes?.ok) return null;
    const accData = await accRes.json().catch(() => ({}));
    if (!Array.isArray(accData?.data)) return null;

    const permRes = await fetch(
      `https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(token)}`,
      { credentials: "include" }
    ).catch(() => null);
    const permData = permRes?.ok ? await permRes.json().catch(() => ({})) : {};
    const granted = Array.isArray(permData?.data)
      ? permData.data.filter((p) => p?.status === "granted").map((p) => p.permission)
      : [];
    const hasAdsManage =
      fromAdsGraph ||
      capturedAdsGraphTokens.has(token) ||
      token.startsWith("EAAB") ||
      granted.includes("ads_management");

    return {
      accounts: accData.data.map((acc) => ({
        id: String(acc.id || `act_${acc.account_id}`),
        accountId: String(acc.account_id || String(acc.id || "").replace(/^act_/, "")),
        name: String(acc.name || `Ad Account ${acc.account_id || acc.id}`),
        currency: acc.currency || "USD",
        status: Number(acc.account_status || 1)
      })),
      hasAdsManage,
      isEaab: token.startsWith("EAAB")
    };
  } catch {
    return null;
  }
}

async function collectTokensFromAdsTab(tabId) {
  if (!tabId || !chrome.scripting) return [];
  const injected = await chrome.scripting
    .executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        const out = [];
        try {
          if (typeof window.__accessToken === "string") out.push(window.__accessToken);
          if (typeof window.__access_token === "string") out.push(window.__access_token);
          if (typeof window.accessToken === "string") out.push(window.accessToken);
        } catch {}
        try {
          const perf = performance?.getEntriesByType?.("resource") || [];
          for (const entry of perf) {
            if (typeof entry?.name === "string" && entry.name.includes("EAA")) {
              let decoded = entry.name;
              try {
                decoded = decodeURIComponent(entry.name);
              } catch {}
              const pm = decoded.match(/EAA[A-Za-z0-9_-]{30,}/g) || [];
              for (const tok of pm) out.push(tok);
            }
          }
        } catch {}
        try {
          const scriptText = Array.from(document.scripts || [])
            .map((s) => s.textContent || "")
            .join("\n");
          const html = document.documentElement?.innerHTML || "";
          const combined = `${scriptText}\n${html}`.replace(/\\\//g, "/");
          const matches = combined.match(/EAA[A-Za-z0-9_-]{30,}/g) || [];
          for (const m of matches) out.push(m);
        } catch {}
        return Array.from(new Set(out));
      }
    })
    .catch(() => null);
  return Array.isArray(injected?.[0]?.result) ? injected[0].result : [];
}

async function extractAdsTokensFromOpenAdsTabs() {
  const found = [];
  try {
    const adsTabs = await chrome.tabs.query({
      url: ["*://adsmanager.facebook.com/*", "*://*.facebook.com/adsmanager/*", "*://*.facebook.com/ads/manager/*"]
    });
    for (const tab of adsTabs.slice(0, 3)) {
      if (!tab?.id) continue;
      const tokens = await collectTokensFromAdsTab(tab.id);
      found.push(...tokens);
    }
  } catch {}
  return Array.from(new Set(found));
}

async function tryBackgroundAdsTabExtraction(actId) {
  if (!chrome.tabs || !chrome.scripting) return [];
  const targetUrl = actId
    ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(actId)}`
    : "https://adsmanager.facebook.com/adsmanager/manage/campaigns";
  const prevCaptured = new Set(capturedAdsTokens);
  let tempTab = null;
  try {
    tempTab = await chrome.tabs.create({ url: targetUrl, active: false });
    await waitForTabComplete(tempTab.id, 18000);

    // Poll up to 9s for live webRequest capture from adsmanager-graph.facebook.com
    for (let i = 0; i < 18; i++) {
      await sleep(500);
      for (const tok of capturedAdsTokens) {
        if (!prevCaptured.has(tok)) {
          return Array.from(capturedAdsTokens);
        }
      }
      if (i === 5) {
        const domTokens = await collectTokensFromAdsTab(tempTab.id);
        if (domTokens.some((t) => t.startsWith("EAAB"))) {
          return Array.from(new Set([...capturedAdsTokens, ...domTokens]));
        }
      }
    }
    const finalDomTokens = await collectTokensFromAdsTab(tempTab.id);
    return Array.from(new Set([...capturedAdsTokens, ...finalDomTokens]));
  } catch {
    return Array.from(capturedAdsTokens);
  } finally {
    if (tempTab?.id) {
      chrome.tabs.remove(tempTab.id).catch(() => {});
    }
  }
}

async function extractAdsContext(seedTokens = []) {
  let fallbackAccounts = [];
  const seen = new Set();

  const stored = await chrome.storage.local
    .get(["capturedAdsToken", "capturedAdsTokenFromAdsGraph", "capturedAdsTokenAt"])
    .catch(() => ({}));
  if (stored?.capturedAdsToken && stored?.capturedAdsTokenFromAdsGraph) {
    capturedAdsGraphTokens.add(stored.capturedAdsToken);
    capturedAdsTokens.add(stored.capturedAdsToken);
  } else if (stored?.capturedAdsToken) {
    capturedAdsTokens.add(stored.capturedAdsToken);
  }

  const evaluateCandidates = async (pool, treatAsAdsGraph = false) => {
    const filtered = (pool || []).filter(
      (t) => typeof t === "string" && /^EAA[A-Za-z0-9_-]{30,}$/.test(t)
    );
    const ranked = [
      ...filtered.filter((t) => capturedAdsGraphTokens.has(t)),
      ...filtered.filter((t) => t.startsWith("EAAB") && !capturedAdsGraphTokens.has(t)),
      ...filtered.filter((t) => !t.startsWith("EAAB") && !capturedAdsGraphTokens.has(t))
    ];
    for (const tok of ranked) {
      if (seen.has(tok)) continue;
      seen.add(tok);
      const isFromAds = treatAsAdsGraph || capturedAdsGraphTokens.has(tok);
      const info = await validateAdsToken(tok, isFromAds);
      if (!info) continue;
      if (info.accounts.length > 0 && fallbackAccounts.length === 0) {
        fallbackAccounts = info.accounts;
      }
      if (info.hasAdsManage) {
        return {
          adsToken: tok,
          adsTokenVerified: true,
          adAccounts: info.accounts.length > 0 ? info.accounts : fallbackAccounts
        };
      }
    }
    return null;
  };

  // 1. Check live wire-intercepted tokens from adsmanager-graph.facebook.com first
  if (capturedAdsTokens.size > 0) {
    const hitWire = await evaluateCandidates(Array.from(capturedAdsTokens));
    if (hitWire) return hitWire;
  }

  // 2. Check open Ads Manager tabs + seed tokens
  const openAdsTokens = await extractAdsTokensFromOpenAdsTabs();
  const hitOpen = await evaluateCandidates([...openAdsTokens, ...seedTokens]);
  if (hitOpen) return hitOpen;

  // 3. Probe Ads Manager URLs
  const actId = fallbackAccounts[0]?.accountId || "";
  const adsEndpoints = [
    ...(actId
      ? [
          `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(actId)}`,
          `https://www.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(actId)}`
        ]
      : []),
    "https://adsmanager.facebook.com/adsmanager/manage/campaigns",
    "https://www.facebook.com/adsmanager/manage/campaigns",
    "https://www.facebook.com/ads/manager/account_settings/account_billing/",
    "https://adsmanager.facebook.com/adsmanager/"
  ];
  for (const [idx, url] of adsEndpoints.entries()) {
    if (idx > 0) await sleep(300);
    try {
      const res = await fetch(url, { credentials: "include", redirect: "follow" }).catch(() => null);
      if (!res) continue;
      const html = await res.text().catch(() => "");
      if (!html) continue;

      const hitFetch = await evaluateCandidates(extractAllTokensFromText(html));
      if (hitFetch) return hitFetch;
    } catch {}
  }

  // 4. Open Ads Manager briefly in an inactive background tab so webRequest intercepts adsmanager-graph.facebook.com live
  const bgTokens = await tryBackgroundAdsTabExtraction(fallbackAccounts[0]?.accountId || "");
  const hitBg = await evaluateCandidates(bgTokens);
  if (hitBg) return hitBg;

  return { adsToken: null, adsTokenVerified: false, adAccounts: fallbackAccounts };
}

function extractTokenFromText(text) {
  return extractAllTokensFromText(text)[0] || null;
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

    if (!cUserId) {
      return {
        ok: false,
        fbLoggedIn: false,
        fbUserId: null,
        error: "រកមិនឃើញគណនី Facebook ដែលបាន Login លើ Browser ទេ។ សូម Login គណនី Facebook ជាមុនសិន!"
      };
    }

    // Security & anti-ban: keep c_user/xs cookies strictly local inside the user's browser
    return {
      ok: true,
      fbLoggedIn: true,
      fbUserId: cUserId
    };
  } catch (err) {
    return {
      ok: false,
      fbLoggedIn: false,
      fbUserId: null,
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

async function scoreFacebookToken(token) {
  if (!token || typeof token !== "string") return -1;
  let score = token.startsWith("EAAG") ? 0 : 10;
  try {
    const meRes = await fetch(
      `https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(token)}&fields=id,name`
    ).catch(() => null);
    const meData = meRes ? await meRes.json().catch(() => ({})) : {};
    if (!meRes?.ok || !meData?.id) return -1;
    score += meData.name ? 30 : 15;

    const permRes = await fetch(
      `https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(token)}`
    ).catch(() => null);
    const permData = permRes ? await permRes.json().catch(() => ({})) : {};
    if (Array.isArray(permData?.data)) {
      const granted = permData.data.filter((p) => p?.status === "granted").map((p) => p.permission);
      if (granted.includes("publish_video")) score += 100;
      if (granted.includes("pages_manage_posts")) score += 80;
    }
  } catch {
    return -1;
  }
  return score;
}

  // 2. Collect at most 2 candidate EAA Tokens visible in the currently open tab (stop early only if publish permissions exist)
  let bestTokenScore = -1;
  const considerToken = async (candidate) => {
    if (!candidate) return false;
    const score = await scoreFacebookToken(candidate);
    if (score > bestTokenScore || (!result.accessToken && score >= 0)) {
      bestTokenScore = score;
      result.accessToken = candidate;
    }
    return score >= 80;
  };

  const tabTokens = Array.from(new Set(html.match(/EAA[A-Za-z0-9_-]{40,}/g) || []));
  for (const tok of tabTokens.slice(0, 2)) {
    if (await considerToken(tok)) break;
  }
  result.tokenScore = bestTokenScore;
  result.tabTokens = tabTokens.slice(0, 6);

  // 4. If we have an Access Token, fetch pages from Graph API directly
  if (result.accessToken) {
    try {
      const gRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${encodeURIComponent(result.accessToken)}&fields=id,name,access_token,category,picture{url}&limit=100`
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

  // 5. Query Facebook Comet Profile Switcher GraphQL ONLY if Graph API returned 0 pages
  if (pagesMap.size === 0) {
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
  }

  // 6. Query /pages/?category=your_pages ONLY if neither Graph API nor Comet switcher returned any pages
  if (pagesMap.size === 0) {
    try {
      const yourPagesRes = await fetch("/pages/?category=your_pages", { credentials: "include" });
      const yourPagesHtml = await yourPagesRes.text();
      if (yourPagesHtml) {
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
  }

  result.pages = Array.from(pagesMap.values());
  return result;
}

let lastSyncTimestamp = 0;
let lastSyncResult = null;
const SYNC_COOLDOWN_MS = 20000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getFullFacebookSyncPayload() {
  try {
    const now = Date.now();
    if (lastSyncResult && lastSyncResult.ok && lastSyncResult.adsToken && now - lastSyncTimestamp < SYNC_COOLDOWN_MS) {
      return lastSyncResult;
    }

    const session = await getFacebookSessionData();
    if (!session.ok || !session.fbUserId) return session;

    let accessToken = null;
    let accessTokenScore = -1;
    let fbUserName = "Facebook User";
    const pagesMap = new Map();
    const tabSeedTokens = [];

    // 1. Try in-tab extraction on active/Business Suite Facebook tabs (local DOM inspect, zero extra navigation)
    try {
      const rawTabs = await chrome.tabs.query({
        url: ["*://*.facebook.com/*", "*://facebook.com/*"]
      });
      const tabs = [...rawTabs].sort((a, b) => {
        const aBiz = (a.url || "").includes("business.facebook.com") ? 2 : a.active ? 1 : 0;
        const bBiz = (b.url || "").includes("business.facebook.com") ? 2 : b.active ? 1 : 0;
        return bBiz - aBiz;
      });
      for (const tab of tabs.slice(0, 2)) {
        if (!tab?.id || !chrome.scripting) continue;
        const injected = await chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            func: extractDataInsideFacebookTab
          })
          .catch(() => null);

        if (injected?.[0]?.result) {
          const res = injected[0].result;
          if (res.userName && fbUserName === "Facebook User") fbUserName = res.userName;
          if (Array.isArray(res.tabTokens)) tabSeedTokens.push(...res.tabTokens);
          const resScore = typeof res.tokenScore === "number" ? res.tokenScore : (res.accessToken ? 0 : -1);
          if (res.accessToken && (resScore > accessTokenScore || !accessToken)) {
            accessToken = res.accessToken;
            accessTokenScore = resScore;
          }
          if (Array.isArray(res.pages)) {
            for (const p of res.pages) {
              if (p?.id && p?.name && p.id !== session.fbUserId) {
                pagesMap.set(p.id, p);
              }
            }
          }
          if (accessToken && accessTokenScore >= 80 && pagesMap.size > 0) break;
        }
      }
    } catch (e) {}

    // 2. Only if no valid token was found yet, probe at most 2 low-risk Business Suite endpoints with pacing
    if (!accessToken || accessTokenScore < 0) {
      const scoreWorkerToken = async (tok) => {
        if (!tok) return -1;
        let score = tok.startsWith("EAAG") ? 0 : 10;
        try {
          const meRes = await fetch(
            `https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(tok)}&fields=id,name`
          ).catch(() => null);
          const meData = meRes ? await meRes.json().catch(() => ({})) : {};
          if (!meRes?.ok || !meData?.id) return -1;
          score += meData.name ? 30 : 15;
        } catch {
          return -1;
        }
        return score;
      };

      const endpoints = [
        "https://business.facebook.com/content_management",
        "https://business.facebook.com/latest/home"
      ];
      let bestScore = accessTokenScore;
      const seenCandidates = new Set(accessToken ? [accessToken] : []);
      for (const [idx, url] of endpoints.entries()) {
        if (idx > 0) await sleep(400);
        try {
          const res = await fetch(url, { credentials: "include", redirect: "follow" }).catch(() => null);
          if (!res) continue;
          const html = await res.text().catch(() => "");
          if (!html) continue;

          const candidates = extractAllTokensFromText(html).slice(0, 2);
          for (const tok of candidates) {
            if (seenCandidates.has(tok)) continue;
            seenCandidates.add(tok);
            const score = await scoreWorkerToken(tok);
            if (score > bestScore || (!accessToken && score >= 0)) {
              bestScore = score;
              accessToken = tok;
            }
            if (score >= 0) break;
          }
          if (bestScore >= 0) break;
        } catch (e) {}
      }
    }

    // 3. If token is now available and pages are not yet loaded, fetch Graph API pages
    if (accessToken && pagesMap.size === 0) {
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

    const adsCtx = await extractAdsContext([...tabSeedTokens, ...(accessToken ? [accessToken] : [])]);

    const syncedPages = Array.from(pagesMap.values());
    const pageTokenMap = {};
    for (const p of syncedPages) {
      if (p?.id && p?.access_token && /^EAA[A-Za-z0-9_-]{30,}$/.test(p.access_token)) {
        pageTokenMap[String(p.id)] = p.access_token;
      }
    }
    if (Object.keys(pageTokenMap).length > 0 || accessToken) {
      chrome.storage.local
        .set({
          lastSyncedPageTokens: pageTokenMap,
          ...(accessToken ? { lastSyncedUserToken: accessToken } : {})
        })
        .catch(() => {});
    }

    const payload = {
      ...session,
      accessToken,
      adsToken: adsCtx.adsToken || null,
      adsTokenVerified: Boolean(adsCtx.adsTokenVerified),
      adAccounts: adsCtx.adAccounts || [],
      fbUser,
      pages: syncedPages
    };
    lastSyncTimestamp = Date.now();
    lastSyncResult = payload;
    return payload;
  } catch (err) {
    return {
      ok: false,
      error: err?.message || "កំហុសក្នុងការទាញយកទិន្នន័យ Facebook"
    };
  }
}

function uint8ToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function waitForTabComplete(tabId, timeoutMs = 25000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    };
    const onUpdated = (id, changeInfo) => {
      if (id === tabId && changeInfo.status === "complete") {
        finish();
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId, (tab) => {
      if (tab?.status === "complete") finish();
    });
    setTimeout(finish, timeoutMs);
  });
}

function injectComposerAssistant(meta) {
  const existing = document.getElementById("eza-composer-assist");
  if (existing) existing.remove();

  const box = document.createElement("div");
  box.id = "eza-composer-assist";
  box.style.cssText = [
    "position:fixed",
    "right:20px",
    "bottom:20px",
    "z-index:999999",
    "max-width:340px",
    "background:#0f172a",
    "color:#f8fafc",
    "border:1px solid rgba(59,130,246,0.45)",
    "border-radius:14px",
    "padding:14px 16px",
    "box-shadow:0 18px 40px rgba(0,0,0,0.45)",
    "font-family:system-ui,-apple-system,sans-serif",
    "font-size:12px",
    "line-height:1.5"
  ].join(";");

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-weight:700;color:#60a5fa;";
  header.textContent = "⚡ EZA-POST Business Suite Assistant";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.style.cssText = "background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:0 2px;";
  closeBtn.onclick = () => box.remove();
  header.appendChild(closeBtn);

  const statusEl = document.createElement("div");
  statusEl.style.cssText = "color:#e2e8f0;";
  statusEl.textContent = "⏳ កំពុងរង់ចាំ Meta Business Suite Composer ផ្ទុក...";

  box.appendChild(header);
  box.appendChild(statusEl);
  document.body.appendChild(box);

  let reconstructedFile = null;
  if (Array.isArray(window.__ezaMediaChunks) && window.__ezaMediaChunks.length > 0) {
    try {
      const byteArrays = window.__ezaMediaChunks.map((b64) => {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
      });
      delete window.__ezaMediaChunks;
      reconstructedFile = new File(byteArrays, meta.filename || "video.mp4", {
        type: meta.mimeType || "video/mp4"
      });
    } catch {
      reconstructedFile = null;
    }
  }

  let fileAttached = !reconstructedFile;
  let captionFilled = !(meta.caption && meta.caption.trim());
  let attempts = 0;

  const tryFill = () => {
    attempts += 1;

    if (!fileAttached && reconstructedFile) {
      const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
      const preferred =
        inputs.find((el) => {
          const acc = (el.getAttribute("accept") || "").toLowerCase();
          return reconstructedFile.type.startsWith("video/")
            ? acc.includes("video")
            : acc.includes("image");
        }) || inputs[0];

      if (preferred) {
        try {
          const dt = new DataTransfer();
          dt.items.add(reconstructedFile);
          preferred.files = dt.files;
          preferred.dispatchEvent(new Event("change", { bubbles: true }));
          preferred.dispatchEvent(new Event("input", { bubbles: true }));
          fileAttached = true;
        } catch {}
      }
    }

    if (!captionFilled && meta.caption) {
      const boxes = Array.from(
        document.querySelectorAll('[role="textbox"][contenteditable="true"]')
      ).filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 120 && rect.height > 20;
      });
      const editor = boxes[0];
      if (editor) {
        try {
          editor.focus();
          const current = (editor.innerText || "").trim();
          if (!current) {
            document.execCommand("insertText", false, meta.caption);
            editor.dispatchEvent(
              new InputEvent("input", { bubbles: true, inputType: "insertText", data: meta.caption })
            );
          }
          captionFilled = true;
        } catch {}
      }
    }

    if ((fileAttached && captionFilled) || attempts >= 40) {
      clearInterval(timer);
      const parts = [];
      if (meta.pageName) parts.push(`ផេក: ${meta.pageName}`);
      if (reconstructedFile) {
        parts.push(fileAttached ? "✅ បានបញ្ចូលឯកសារវីដេអូ/រូបភាព" : "⚠️ សូមជ្រើសរើសឯកសារដោយដៃ");
      }
      if (meta.caption) {
        parts.push(captionFilled ? "✅ បានបំពេញ Caption" : "⚠️ ចុចប៊ូតុងខាងក្រោមដើម្បីចម្លង Caption");
      }
      if (meta.scheduleLabel) {
        parts.push(`📅 ម៉ោងកំណត់: ${meta.scheduleLabel}`);
      }
      parts.push("👉 រង់ចាំ Upload ពេញ រួចចុច Publish / Schedule ខាងក្រោម!");
      statusEl.textContent = "";
      for (const line of parts) {
        const row = document.createElement("div");
        row.style.marginTop = "3px";
        row.textContent = line;
        statusEl.appendChild(row);
      }

      if (meta.caption) {
        const copyBtn = document.createElement("button");
        copyBtn.textContent = "📋 ចម្លង Caption";
        copyBtn.style.cssText =
          "margin-top:8px;padding:6px 10px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-weight:700;cursor:pointer;font-size:11px;";
        copyBtn.onclick = () => {
          navigator.clipboard?.writeText(meta.caption).catch(() => {});
          copyBtn.textContent = "✅ បានចម្លង Caption!";
        };
        box.appendChild(copyBtn);
      }
    }
  };

  const timer = setInterval(tryFill, 500);
  setTimeout(tryFill, 400);
}

async function openFacebookComposerAssist(payload) {
  const pageId = String(payload?.pageId || "").trim();
  if (!pageId) {
    return { ok: false, error: "សូមជ្រើសរើសផេក Facebook យ៉ាងតិច ១!" };
  }

  const targetUrl = `https://business.facebook.com/latest/composer?asset_id=${encodeURIComponent(pageId)}`;
  let mediaBytes = null;
  let mimeType = payload?.mimeType || "video/mp4";
  let filename = payload?.filename || "video.mp4";

  if (typeof payload?.mediaUrl === "string" && payload.mediaUrl.startsWith("https://")) {
    try {
      const res = await fetch(payload.mediaUrl);
      if (res.ok) {
        mimeType = res.headers.get("Content-Type") || mimeType;
        const buf = await res.arrayBuffer();
        mediaBytes = new Uint8Array(buf);
      }
    } catch {}
  }

  const createdTab = await chrome.tabs.create({ url: targetUrl, active: true });
  await waitForTabComplete(createdTab.id, 25000);
  await sleep(1500);

  if (mediaBytes && mediaBytes.length > 0 && chrome.scripting) {
    await chrome.scripting.executeScript({
      target: { tabId: createdTab.id },
      func: () => {
        window.__ezaMediaChunks = [];
      }
    });
    const chunkBytes = 3 * 1024 * 1024;
    for (let offset = 0; offset < mediaBytes.length; offset += chunkBytes) {
      const slice = mediaBytes.subarray(offset, Math.min(offset + chunkBytes, mediaBytes.length));
      const b64 = uint8ToBase64(slice);
      await chrome.scripting.executeScript({
        target: { tabId: createdTab.id },
        func: (chunk) => {
          window.__ezaMediaChunks = window.__ezaMediaChunks || [];
          window.__ezaMediaChunks.push(chunk);
        },
        args: [b64]
      });
    }
  }

  if (chrome.scripting) {
    await chrome.scripting.executeScript({
      target: { tabId: createdTab.id },
      func: injectComposerAssistant,
      args: [
        {
          pageId,
          pageName: payload?.pageName || "",
          caption: payload?.caption || "",
          filename,
          mimeType,
          scheduleLabel: payload?.scheduleLabel || ""
        }
      ]
    });
  }

  return { ok: true, tabId: createdTab.id };
}

const FB_VALID_CTA_TYPES = new Set([
  "LEARN_MORE",
  "SHOP_NOW",
  "SIGN_UP",
  "BOOK_NOW",
  "WATCH_MORE",
  "WATCH_VIDEO",
  "CONTACT_US",
  "ORDER_NOW",
  "APPLY_NOW",
  "DOWNLOAD",
  "GET_OFFER",
  "GET_QUOTE",
  "SUBSCRIBE",
  "SEE_MORE",
  "LIKE_PAGE",
  "MESSAGE_PAGE",
  "WHATSAPP_MESSAGE"
]);

function extBuildCta(cta, link, pageId) {
  if (!cta || cta === "NO_BUTTON") return undefined;
  const safeLink = typeof link === "string" && /^https?:\/\//i.test(link) ? link : `https://facebook.com/${pageId}`;
  if (cta === "SEND_MESSAGE" || cta === "MESSAGE_PAGE") {
    return { type: "MESSAGE_PAGE", value: { link: safeLink } };
  }
  if (cta === "FOLLOW") {
    return { type: "LEARN_MORE", value: { link: safeLink } };
  }
  const normalizedType = FB_VALID_CTA_TYPES.has(cta) ? cta : "LEARN_MORE";
  return { type: normalizedType, value: { link: safeLink } };
}

function fetchWithTimeout(url, options = {}, timeoutMs = 18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function extGraphPost(url, bodyParams, timeoutMs = 15000) {
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(bodyParams)
    },
    timeoutMs
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const err = data?.error;
    const msg = err?.error_user_msg || err?.message || `HTTP ${res.status}`;
    const code = err?.code != null ? ` (FB #${err.code}${err.error_subcode ? `/${err.error_subcode}` : ""})` : "";
    throw new Error(`${msg}${code}`);
  }
  return data;
}

async function getQuickAdsContext(preferredActId = "") {
  try {
    const stored = await chrome.storage.local
      .get(["capturedAdsToken", "lastSyncedUserToken"])
      .catch(() => ({}));
    const openTokens = await extractAdsTokensFromOpenAdsTabs().catch(() => []);
    const candidates = Array.from(
      new Set(
        [
          ...Array.from(capturedAdsGraphTokens),
          ...Array.from(capturedAdsTokens),
          stored?.capturedAdsToken,
          ...openTokens,
          stored?.lastSyncedUserToken
        ].filter((t) => typeof t === "string" && /^EAA[A-Za-z0-9_-]{30,}$/.test(t))
      )
    );
    for (const tok of candidates.slice(0, 3)) {
      try {
        const res = await fetchWithTimeout(
          `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,account_id,name&limit=10&access_token=${encodeURIComponent(tok)}`,
          { credentials: "include" },
          4000
        ).catch(() => null);
        if (res?.ok) {
          const data = await res.json().catch(() => ({}));
          const accs = Array.isArray(data?.data) ? data.data : [];
          if (accs.length > 0 || preferredActId) {
            return {
              adsToken: tok,
              adAccounts: accs.map((a) => ({ id: String(a.id || `act_${a.account_id}`) }))
            };
          }
        }
      } catch {}
    }
    if (candidates[0]) {
      return {
        adsToken: candidates[0],
        adAccounts: preferredActId ? [{ id: String(preferredActId) }] : []
      };
    }
  } catch {}
  return { adsToken: null, adAccounts: [] };
}

async function extUploadAdVideo(actId, adsToken, videoUrl) {
  let blob = null;
  let filename = "video.mp4";
  try {
    const mediaRes = await fetch(videoUrl);
    if (mediaRes.ok) {
      blob = await mediaRes.blob();
      const parts = videoUrl.split("/");
      const tail = decodeURIComponent(parts[parts.length - 1] || "").split("?")[0];
      if (tail && tail.includes(".")) filename = tail.split("/").pop();
    }
  } catch {}

  const hosts = ["https://graph-video.facebook.com", "https://adsmanager-graph.facebook.com"];
  let lastErr = null;
  if (blob && blob.size > 0) {
    for (const host of hosts) {
      try {
        const form = new FormData();
        form.set("access_token", adsToken);
        form.set("source", blob, filename);
        const res = await fetch(`${host}/v21.0/${encodeURIComponent(actId)}/advideos`, {
          method: "POST",
          credentials: "include",
          body: form
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.id) return String(data.id);
        const err = data?.error;
        lastErr = new Error(`${err?.message || `HTTP ${res.status}`}${err?.code != null ? ` (FB #${err.code})` : ""}`);
      } catch (e) {
        lastErr = e;
      }
    }
  }

  for (const host of ["https://adsmanager-graph.facebook.com", "https://graph-video.facebook.com", "https://graph.facebook.com"]) {
    try {
      const data = await extGraphPost(`${host}/v21.0/${encodeURIComponent(actId)}/advideos`, {
        access_token: adsToken,
        file_url: videoUrl
      });
      if (data?.id) return String(data.id);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("មិនអាច Upload វីដេអូទៅ Ad Account បានទេ");
}

async function extUploadAdImage(actId, adsToken, imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return { hash: null, url: imageUrl };
  try {
    const imgRes = await fetch(imageUrl, { redirect: "follow" });
    if (!imgRes.ok) return { hash: null, url: imageUrl };
    const blob = await imgRes.blob();
    if (!blob || blob.size === 0) return { hash: null, url: imageUrl };
    for (const host of ["https://adsmanager-graph.facebook.com", "https://graph.facebook.com"]) {
      const form = new FormData();
      form.set("access_token", adsToken);
      form.set("filename", blob, "image.jpg");
      const res = await fetch(`${host}/v21.0/${encodeURIComponent(actId)}/adimages`, {
        method: "POST",
        credentials: "include",
        body: form
      });
      const data = await res.json().catch(() => ({}));
      const firstImg = data?.images ? Object.values(data.images)[0] : null;
      if (firstImg?.hash) {
        let cdnUrl = firstImg.url || firstImg.permalink_url || null;
        if (!cdnUrl) {
          try {
            const hashesParam = encodeURIComponent(JSON.stringify([firstImg.hash]));
            const lookRes = await fetch(
              `${host}/v21.0/${encodeURIComponent(actId)}/adimages?hashes=${hashesParam}&fields=hash,url,permalink_url&access_token=${encodeURIComponent(adsToken)}`,
              { credentials: "include" }
            ).catch(() => null);
            const lookData = lookRes?.ok ? await lookRes.json().catch(() => ({})) : {};
            const item = Array.isArray(lookData?.data) ? lookData.data[0] : null;
            cdnUrl = item?.url || item?.permalink_url || null;
          } catch {}
        }
        return { hash: firstImg.hash, url: cdnUrl || imageUrl };
      }
    }
  } catch {}
  return { hash: null, url: imageUrl };
}

async function extResolvePageAvatarCdn(pageId, pageTokens) {
  const tok = pageTokens?.[0];
  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/picture?type=large&redirect=false${tok ? `&access_token=${encodeURIComponent(tok)}` : ""}`;
    const res = await fetch(url, { credentials: "include" }).catch(() => null);
    if (res?.ok) {
      const data = await res.json().catch(() => ({}));
      if (typeof data?.data?.url === "string" && data.data.url.startsWith("https://")) {
        return data.data.url;
      }
    }
  } catch {}
  return `https://graph.facebook.com/${encodeURIComponent(pageId)}/picture?type=large`;
}

async function extUploadImageToFbCdn(pageId, pageTokens, actId, adsToken, imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return { hash: null, photoId: null, url: imageUrl };

  // 1. Upload binary Blob directly to /{pageId}/photos (published=false) FIRST to get a direct scontent.fbcdn.net images[0].source URL
  try {
    const imgRes = await fetch(imageUrl, { redirect: "follow" });
    if (imgRes.ok) {
      const blob = await imgRes.blob();
      if (blob && blob.size > 0) {
        for (const pt of pageTokens || []) {
          try {
            const form = new FormData();
            form.set("access_token", pt);
            form.set("published", "false");
            form.set("source", blob, "card.jpg");
            const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/photos`, {
              method: "POST",
              credentials: "include",
              body: form
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data?.id) {
              const photoId = String(data.id);
              const metaRes = await fetch(
                `https://graph.facebook.com/v21.0/${encodeURIComponent(photoId)}?fields=images,picture&access_token=${encodeURIComponent(pt)}`,
                { credentials: "include" }
              ).catch(() => null);
              const metaData = metaRes?.ok ? await metaRes.json().catch(() => ({})) : {};
              const cdnUrl = metaData?.images?.[0]?.source || metaData?.picture || null;
              if (cdnUrl) {
                return { hash: null, photoId, url: cdnUrl };
              }
            }
          } catch {}
        }
      }
    }
  } catch {}

  // 2. Fallback: Ad Account /adimages (queries ?hashes=[...]&fields=url,permalink_url for fbcdn.net URL)
  if (actId && adsToken) {
    const adImg = await extUploadAdImage(actId, adsToken, imageUrl);
    if (adImg?.hash) {
      return { hash: adImg.hash, photoId: null, url: adImg.url || imageUrl };
    }
  }

  return { hash: null, photoId: null, url: imageUrl };
}

async function extWaitForVideoReady(videoId, token) {
  if (!videoId || !token) return;
  for (let i = 0; i < 5; i++) {
    try {
      for (const host of ["https://adsmanager-graph.facebook.com", "https://graph.facebook.com"]) {
        const res = await fetchWithTimeout(
          `${host}/v21.0/${encodeURIComponent(videoId)}?fields=status&access_token=${encodeURIComponent(token)}`,
          { credentials: "include" },
          3500
        ).catch(() => null);
        if (!res?.ok) continue;
        const data = await res.json().catch(() => ({}));
        const st = data?.status?.video_status || data?.status?.processing_phase?.status;
        if (st === "ready" || st === "complete") return;
        if (st === "error") return;
        break;
      }
    } catch {}
    await sleep(1000);
  }
}

async function extResolvePageAccessToken(pageId, adsToken) {
  const tokens = [];
  if (adsToken) {
    for (const host of ["https://adsmanager-graph.facebook.com", "https://graph.facebook.com"]) {
      try {
        const res = await fetch(
          `${host}/v21.0/${encodeURIComponent(pageId)}?fields=access_token&access_token=${encodeURIComponent(adsToken)}`,
          { credentials: "include" }
        ).catch(() => null);
        if (res?.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.access_token) tokens.push(String(data.access_token));
        }
      } catch {}
    }
    try {
      const accRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token&limit=100&access_token=${encodeURIComponent(adsToken)}`,
        { credentials: "include" }
      ).catch(() => null);
      if (accRes?.ok) {
        const accData = await accRes.json().catch(() => ({}));
        const match = Array.isArray(accData?.data)
          ? accData.data.find((p) => String(p?.id) === String(pageId))
          : null;
        if (match?.access_token) tokens.push(String(match.access_token));
      }
    } catch {}
  }
  try {
    const stored = await chrome.storage.local.get(["lastSyncedPageTokens", "lastSyncedUserToken"]).catch(() => ({}));
    const savedTok = stored?.lastSyncedPageTokens?.[String(pageId)];
    if (savedTok) tokens.push(String(savedTok));
    if (stored?.lastSyncedUserToken) {
      const uRes = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}?fields=access_token&access_token=${encodeURIComponent(stored.lastSyncedUserToken)}`,
        { credentials: "include" }
      ).catch(() => null);
      if (uRes?.ok) {
        const uData = await uRes.json().catch(() => ({}));
        if (uData?.access_token) tokens.push(String(uData.access_token));
      }
    }
  } catch {}
  if (tokens.length === 0) {
    try {
      const bizCtx = await extractBusinessPagesAndTokens();
      const matchedPage = Array.isArray(bizCtx?.pages)
        ? bizCtx.pages.find((p) => String(p?.id) === String(pageId))
        : null;
      if (matchedPage?.access_token) tokens.push(String(matchedPage.access_token));
    } catch {}
  }
  return Array.from(new Set(tokens.filter((t) => /^EAA[A-Za-z0-9_-]{30,}$/.test(t))));
}

async function extUploadPageVideo(pageId, pageTokens, videoUrl, { published = true, description = "", title = "", ctaSpec = null } = {}) {
  let blob = null;
  let filename = "video.mp4";
  try {
    const mediaRes = await fetch(videoUrl);
    if (mediaRes.ok) {
      blob = await mediaRes.blob();
      const parts = videoUrl.split("/");
      const tail = decodeURIComponent(parts[parts.length - 1] || "").split("?")[0];
      if (tail && tail.includes(".")) filename = tail.split("/").pop();
    }
  } catch {}

  let lastErr = null;
  for (const pt of pageTokens) {
    if (blob && blob.size > 0) {
      for (const host of ["https://graph-video.facebook.com", "https://adsmanager-graph.facebook.com"]) {
        try {
          const form = new FormData();
          form.set("access_token", pt);
          form.set("published", published ? "true" : "false");
          if (description) form.set("description", description);
          if (title) form.set("title", title);
          if (ctaSpec) form.set("call_to_action", JSON.stringify(ctaSpec));
          form.set("source", blob, filename);
          const res = await fetch(`${host}/v21.0/${encodeURIComponent(pageId)}/videos`, {
            method: "POST",
            credentials: "include",
            body: form
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data?.id) return { id: String(data.id), token: pt };
          const err = data?.error;
          lastErr = new Error(`${err?.message || `HTTP ${res.status}`}${err?.code != null ? ` (FB #${err.code})` : ""}`);
        } catch (e) {
          lastErr = e;
        }
      }
    }
    try {
      const params = {
        access_token: pt,
        file_url: videoUrl,
        published: published ? "true" : "false",
        ...(description ? { description } : {}),
        ...(title ? { title } : {}),
        ...(ctaSpec ? { call_to_action: JSON.stringify(ctaSpec) } : {})
      };
      const data = await extGraphPost(`https://graph-video.facebook.com/v21.0/${encodeURIComponent(pageId)}/videos`, params);
      if (data?.id) return { id: String(data.id), token: pt };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Page video upload failed");
}

async function extDeletePostQuietly(postId, tokens = []) {
  if (!postId) return;
  for (const tok of tokens.filter(Boolean)) {
    for (const host of ["https://graph.facebook.com", "https://adsmanager-graph.facebook.com"]) {
      try {
        const res = await fetchWithTimeout(
          `${host}/v21.0/${encodeURIComponent(postId)}?access_token=${encodeURIComponent(tok)}`,
          { method: "DELETE", credentials: "include" },
          4000
        ).catch(() => null);
        if (res?.ok) return;
      } catch {}
    }
  }
}

async function extVerifyCarouselOnTimeline(storyId, tokens = [], { requirePublished = false } = {}) {
  if (!storyId) return { checked: false, isCarousel: false, subCount: 0, isPublished: false };
  for (const tok of tokens.filter(Boolean)) {
    for (const host of ["https://graph.facebook.com", "https://adsmanager-graph.facebook.com"]) {
      try {
        const res = await fetchWithTimeout(
          `${host}/v21.0/${encodeURIComponent(storyId)}?fields=id,is_published,attachments{type,media_type,subattachments{type,media_type}}&access_token=${encodeURIComponent(tok)}`,
          { credentials: "include" },
          4500
        ).catch(() => null);
        if (!res?.ok) continue;
        const data = await res.json().catch(() => ({}));
        if (!data?.id) continue;
        const att = Array.isArray(data?.attachments?.data) ? data.attachments.data[0] : null;
        const subCount = Array.isArray(att?.subattachments?.data) ? att.subattachments.data.length : 0;
        const isCarousel = subCount >= 2 || att?.type === "multi_share" || att?.type === "album";
        const isPublished = data.is_published !== false;
        return {
          checked: true,
          isCarousel,
          subCount,
          isPublished: requirePublished ? data.is_published === true : isPublished
        };
      } catch {}
    }
  }
  return { checked: false, isCarousel: false, subCount: 0, isPublished: false };
}

async function extMaterializeCreativeStoryId(actId, adsToken, pageId, creativeId, allTokens = [], createdAfterMs = 0) {
  if (!creativeId || !adsToken) return null;

  const checkCreativeAndAdsPosts = async () => {
    for (const host of ["https://adsmanager-graph.facebook.com", "https://graph.facebook.com"]) {
      try {
        const crLook = await fetchWithTimeout(
          `${host}/v21.0/${encodeURIComponent(creativeId)}?fields=effective_object_story_id,object_story_id,thumbnail_url&access_token=${encodeURIComponent(adsToken)}`,
          { credentials: "include" },
          3500
        ).catch(() => null);
        if (crLook?.ok) {
          const crData = await crLook.json().catch(() => ({}));
          const sid = crData?.effective_object_story_id || crData?.object_story_id;
          if (sid && String(sid).includes("_")) return String(sid);
        }
      } catch {}
    }

    for (const tok of allTokens.slice(0, 2)) {
      for (const endpoint of ["ads_posts?include_inline_create=true", "promotable_posts?is_published=false&include_inline=true"]) {
        try {
          const apRes = await fetchWithTimeout(
            `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/${endpoint}&fields=id,is_published,created_time,attachments{type,subattachments}&limit=5&access_token=${encodeURIComponent(tok)}`,
            { credentials: "include" },
            3500
          ).catch(() => null);
          if (apRes?.ok) {
            const apData = await apRes.json().catch(() => ({}));
            const posts = Array.isArray(apData?.data) ? apData.data : [];
            for (const p of posts) {
              if (!p?.id || !String(p.id).startsWith(`${pageId}_`)) continue;
              const createdMs = p.created_time ? Date.parse(p.created_time) : 0;
              if (createdAfterMs > 0 && createdMs > 0 && createdMs < createdAfterMs - 20000) continue;
              const att = Array.isArray(p?.attachments?.data) ? p.attachments.data[0] : null;
              const subCount = Array.isArray(att?.subattachments?.data) ? att.subattachments.data.length : 0;
              if (subCount >= 2 || att?.type === "multi_share") {
                return String(p.id);
              }
            }
          }
        } catch {}
      }
    }
    return null;
  };

  await Promise.all([
    fetchWithTimeout(
      `https://adsmanager-graph.facebook.com/v21.0/${encodeURIComponent(creativeId)}/previews?ad_format=DESKTOP_FEED_STANDARD&access_token=${encodeURIComponent(adsToken)}`,
      { credentials: "include" },
      3500
    ).catch(() => null),
    fetchWithTimeout(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(creativeId)}/previews?ad_format=MOBILE_FEED_STANDARD&access_token=${encodeURIComponent(adsToken)}`,
      { credentials: "include" },
      3500
    ).catch(() => null)
  ]);

  let storyId = await checkCreativeAndAdsPosts();
  if (storyId) return storyId;

  if (actId && adsToken) {
    let adsetId = null;
    try {
      const asRes = await fetchWithTimeout(
        `https://adsmanager-graph.facebook.com/v21.0/${encodeURIComponent(actId)}/adsets?fields=id,status&limit=5&access_token=${encodeURIComponent(adsToken)}`,
        { credentials: "include" },
        3500
      ).catch(() => null);
      if (asRes?.ok) {
        const asData = await asRes.json().catch(() => ({}));
        const list = Array.isArray(asData?.data) ? asData.data : [];
        const pausedAs = list.find((a) => a?.id && a.status === "PAUSED") || list[0];
        if (pausedAs?.id) adsetId = String(pausedAs.id);
      }
    } catch {}

    if (!adsetId) {
      let campaignId = null;
      try {
        const cpRes = await fetchWithTimeout(
          `https://adsmanager-graph.facebook.com/v21.0/${encodeURIComponent(actId)}/campaigns?fields=id,status,objective&limit=5&access_token=${encodeURIComponent(adsToken)}`,
          { credentials: "include" },
          3500
        ).catch(() => null);
        if (cpRes?.ok) {
          const cpData = await cpRes.json().catch(() => ({}));
          const list = Array.isArray(cpData?.data) ? cpData.data : [];
          const pausedCp = list.find((c) => c?.id && c.status === "PAUSED") || list[0];
          if (pausedCp?.id) campaignId = String(pausedCp.id);
        }
      } catch {}

      if (!campaignId) {
        for (const objective of ["OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "LINK_CLICKS"]) {
          try {
            const newCp = await extGraphPost(
              `https://adsmanager-graph.facebook.com/v21.0/${encodeURIComponent(actId)}/campaigns`,
              {
                access_token: adsToken,
                name: "EZA_PE_HELPER_CAMPAIGN",
                objective,
                status: "PAUSED",
                special_ad_categories: "[]",
                is_adset_budget_sharing_enabled: "false"
              },
              4500
            );
            if (newCp?.id) {
              campaignId = String(newCp.id);
              break;
            }
          } catch {}
        }
      }

      if (campaignId) {
        for (const budget of ["500", "50000"]) {
          try {
            const newAs = await extGraphPost(
              `https://adsmanager-graph.facebook.com/v21.0/${encodeURIComponent(actId)}/adsets`,
              {
                access_token: adsToken,
                name: "EZA_PE_HELPER_ADSET",
                campaign_id: campaignId,
                status: "PAUSED",
                billing_event: "IMPRESSIONS",
                optimization_goal: "LINK_CLICKS",
                bid_strategy: "LOWEST_COST_WITHOUT_CAP",
                daily_budget: budget,
                targeting: JSON.stringify({
                  geo_locations: { countries: ["KH", "US"] },
                  targeting_automation: { advantage_audience: 0 }
                })
              },
              4500
            );
            if (newAs?.id) {
              adsetId = String(newAs.id);
              break;
            }
          } catch {}
        }
      }
    }

    if (adsetId) {
      let tempAdId = null;
      try {
        const adRes = await extGraphPost(
          `https://adsmanager-graph.facebook.com/v21.0/${encodeURIComponent(actId)}/ads`,
          {
            access_token: adsToken,
            name: `EZA_PE_MATERIALIZE_${Date.now()}`,
            adset_id: adsetId,
            status: "PAUSED",
            creative: JSON.stringify({ creative_id: creativeId }),
            fields: "id,effective_object_story_id,creative{effective_object_story_id,object_story_id}"
          },
          6000
        );
        if (adRes?.id) tempAdId = String(adRes.id);
        const sid =
          adRes?.effective_object_story_id ||
          adRes?.creative?.effective_object_story_id ||
          adRes?.creative?.object_story_id;
        if (sid && String(sid).includes("_")) {
          storyId = String(sid);
        }
      } catch {}

      if (!storyId) {
        await sleep(800);
        storyId = await checkCreativeAndAdsPosts();
      }

      if (tempAdId) {
        fetchWithTimeout(
          `https://adsmanager-graph.facebook.com/v21.0/${encodeURIComponent(tempAdId)}?access_token=${encodeURIComponent(adsToken)}`,
          { method: "DELETE", credentials: "include" },
          3500
        ).catch(() => {});
      }
    }
  }

  return storyId;
}

async function publishAdCreativeInBrowser(payload, senderTabId = null) {
  const sendProgress = (text) => {
    if (senderTabId && chrome.tabs?.sendMessage) {
      chrome.tabs.sendMessage(senderTabId, { action: "PUBLISH_AD_CREATIVE_PROGRESS", text }).catch(() => {});
    }
  };

  sendProgress("១/៣ កំពុងពិនិត្យសិទ្ធិផេក Facebook...");
  const adsCtx = await getQuickAdsContext(payload?.adAccountId || "");
  const adsToken = adsCtx?.adsToken || null;
  const rawActId = payload?.adAccountId || adsCtx?.adAccounts?.[0]?.id || "";
  const actId = rawActId ? (String(rawActId).startsWith("act_") ? String(rawActId) : `act_${rawActId}`) : "";

  const pages = Array.isArray(payload?.pages) && payload.pages.length > 0
    ? payload.pages
    : payload?.pageId
      ? [{ id: String(payload.pageId), name: payload.pageName || "Facebook Page" }]
      : [];
  if (pages.length === 0) {
    return { ok: false, error: "សូមជ្រើសរើសផេក Facebook យ៉ាងតិច ១!" };
  }

  const format = String(payload?.format || "video_pe");
  const results = [];
  const errors = [];

  for (const [pageIdx, pg] of pages.entries()) {
    if (pageIdx > 0) await sleep(500);
    const pageId = String(pg.id);
    const pageName = pg.name || "Facebook Page";
    const defaultPageUrl = `https://facebook.com/${pageId}`;
    const baseLink = typeof payload?.link === "string" && /^https?:\/\//i.test(payload.link) ? payload.link : defaultPageUrl;
    const ctaSpec = extBuildCta(payload?.cta, baseLink, pageId);

    try {
      const pageTokens = await extResolvePageAccessToken(pageId, adsToken);
      if (pageTokens.length === 0) {
        throw new Error(`មិនមាន Page Access Token សម្រាប់ផេក ${pageName} — សូមចូលទំព័រ 'ភ្ជាប់ផេក' រួចចុច Sync តាម Extension!`);
      }

      if (format === "text_link") {
        let feedErr = null;
        let posted = false;
        const linkVal = typeof payload?.link === "string" && /^https?:\/\//i.test(payload.link) ? payload.link : "";
        for (const pt of pageTokens) {
          try {
            const params = {
              access_token: pt,
              published: "true",
              message: payload?.caption || ""
            };
            if (linkVal) params.link = linkVal;
            const feedRes = await extGraphPost(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/feed`, params);
            if (feedRes?.id) {
              results.push({
                pageId,
                pageName,
                storyId: String(feedRes.id),
                postUrl: `https://www.facebook.com/${feedRes.id}`,
                publishedToTimeline: true
              });
              posted = true;
              break;
            }
          } catch (e) {
            feedErr = e;
          }
        }
        if (!posted) throw feedErr || new Error("មិនអាចបង្ហោះអត្ថបទ / Link ឡើង Page Timeline បានទេ");
        continue;
      }

      if (format === "photos") {
        const photoUrls = Array.isArray(payload?.imageUrls) && payload.imageUrls.length > 0
          ? payload.imageUrls
          : payload?.imageUrl
            ? [payload.imageUrl]
            : [];
        if (photoUrls.length === 0) {
          throw new Error("សូមដាក់រូបភាពយ៉ាងតិច ១ សន្លឹក!");
        }
        if (photoUrls.length === 1) {
          const imgRes = await fetch(photoUrls[0], { redirect: "follow" });
          const blob = imgRes.ok ? await imgRes.blob() : null;
          let photoErr = null;
          let posted = false;
          for (const pt of pageTokens) {
            try {
              if (blob && blob.size > 0) {
                const form = new FormData();
                form.set("access_token", pt);
                form.set("published", "true");
                if (payload?.caption) form.set("caption", payload.caption);
                form.set("source", blob, "photo.jpg");
                const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/photos`, {
                  method: "POST",
                  credentials: "include",
                  body: form
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && (data?.post_id || data?.id)) {
                  const sid = String(data.post_id || data.id);
                  results.push({
                    pageId,
                    pageName,
                    storyId: sid,
                    postUrl: `https://www.facebook.com/${sid}`,
                    publishedToTimeline: true
                  });
                  posted = true;
                  break;
                }
                photoErr = new Error(data?.error?.message || `HTTP ${res.status}`);
              } else {
                const data = await extGraphPost(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/photos`, {
                  access_token: pt,
                  published: "true",
                  url: photoUrls[0],
                  ...(payload?.caption ? { caption: payload.caption } : {})
                });
                if (data?.post_id || data?.id) {
                  const sid = String(data.post_id || data.id);
                  results.push({
                    pageId,
                    pageName,
                    storyId: sid,
                    postUrl: `https://www.facebook.com/${sid}`,
                    publishedToTimeline: true
                  });
                  posted = true;
                  break;
                }
              }
            } catch (e) {
              photoErr = e;
            }
          }
          if (!posted) throw photoErr || new Error("មិនអាចបង្ហោះរូបភាពឡើង Page Timeline បានទេ");
          continue;
        }

        // Multiple photos (2-10): upload unpublished to /{pageId}/photos then attach via attached_media on /{pageId}/feed
        const uploadedIds = [];
        for (const u of photoUrls.slice(0, 10)) {
          const uploadedAsset = await extUploadImageToFbCdn(pageId, pageTokens, actId, adsToken, u);
          if (uploadedAsset?.photoId) {
            uploadedIds.push(uploadedAsset.photoId);
          }
        }
        if (uploadedIds.length === 0) {
          throw new Error("មិនអាច Upload រូបភាពទៅ Facebook Page បានទេ");
        }
        let multiErr = null;
        let postedMulti = false;
        for (const pt of pageTokens) {
          try {
            const feedRes = await extGraphPost(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/feed`, {
              access_token: pt,
              published: "true",
              message: payload?.caption || "",
              attached_media: JSON.stringify(uploadedIds.map((id) => ({ media_fbid: id })))
            });
            if (feedRes?.id) {
              results.push({
                pageId,
                pageName,
                storyId: String(feedRes.id),
                postUrl: `https://www.facebook.com/${feedRes.id}`,
                publishedToTimeline: true
              });
              postedMulti = true;
              break;
            }
          } catch (e) {
            multiErr = e;
          }
        }
        if (!postedMulti) throw multiErr || new Error("មិនអាចបង្ហោះរូបភាពច្រើនសន្លឹកឡើង Page Timeline បានទេ");
        continue;
      }

      if (format === "video_cta" && payload?.videoUrl) {
        try {
          const uploaded = await extUploadPageVideo(pageId, pageTokens, payload.videoUrl, {
            published: true,
            description: payload?.caption || "",
            title: payload?.headline || pageName,
            ctaSpec
          });
          results.push({
            pageId,
            pageName,
            storyId: uploaded.id,
            postUrl: `https://www.facebook.com/${pageId}/videos/${uploaded.id}`,
            publishedToTimeline: true
          });
          continue;
        } catch {
          // If /{pageId}/videos is blocked by Meta App Review, fall back to Page /feed post with thumbnail & CTA button
          const rawImgUrl = payload?.thumbnailUrl || (await extResolvePageAvatarCdn(pageId, pageTokens));
          const fbImg = await extUploadImageToFbCdn(pageId, pageTokens, actId, adsToken, rawImgUrl);
          let feedErr = null;
          let posted = false;
          for (const pt of pageTokens) {
            try {
              const feedRes = await extGraphPost(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/feed`, {
                access_token: pt,
                published: "true",
                message: payload?.caption || "",
                link: baseLink,
                name: payload?.headline || pageName,
                description: payload?.description || "",
                picture: fbImg.url,
                ...(ctaSpec ? { call_to_action: JSON.stringify(ctaSpec) } : {})
              });
              if (feedRes?.id) {
                results.push({
                  pageId,
                  pageName,
                  storyId: String(feedRes.id),
                  postUrl: `https://www.facebook.com/${feedRes.id}`,
                  publishedToTimeline: true
                });
                posted = true;
                break;
              }
            } catch (e) {
              feedErr = e;
            }
          }
          if (!posted) throw feedErr || new Error("មិនអាចបង្ហោះ Video CTA ឡើង Page Timeline បានទេ");
          continue;
        }
      }

      if (format === "photo_cta" || format === "instant_experience") {
        const rawImgUrl = payload?.imageUrl || payload?.thumbnailUrl || (await extResolvePageAvatarCdn(pageId, pageTokens));
        const fbImg = await extUploadImageToFbCdn(pageId, pageTokens, actId, adsToken, rawImgUrl);
        const canvasLink =
          format === "instant_experience"
            ? (typeof payload?.canvasUrl === "string" && /^https?:\/\//i.test(payload.canvasUrl)
                ? payload.canvasUrl
                : payload?.canvasId
                  ? `https://fb.com/canvas_doc/${encodeURIComponent(payload.canvasId)}`
                  : baseLink)
            : baseLink;
        const resolvedCta = extBuildCta(payload?.cta || "LEARN_MORE", canvasLink, pageId);
        let feedErr = null;
        let posted = false;
        for (const pt of pageTokens) {
          try {
            const feedRes = await extGraphPost(`https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/feed`, {
              access_token: pt,
              published: "true",
              message: payload?.caption || "",
              link: canvasLink,
              name: payload?.headline || pageName,
              description: payload?.description || "",
              picture: fbImg.url,
              ...(resolvedCta ? { call_to_action: JSON.stringify(resolvedCta) } : {})
            });
            if (feedRes?.id) {
              results.push({
                pageId,
                pageName,
                storyId: String(feedRes.id),
                postUrl: `https://www.facebook.com/${feedRes.id}`,
                publishedToTimeline: true
              });
              posted = true;
              break;
            }
          } catch (e) {
            feedErr = e;
          }
        }
        if (!posted) throw feedErr || new Error("មិនអាចបង្ហោះឡើង Page Timeline បានទេ");
        continue;
      }

      if (format === "photo_pe" || format === "video_pe") {
        const cards = Array.isArray(payload?.cards) ? payload.cards.slice(0, 10) : [];
        if (cards.length < 2) throw new Error("Carousel PE តម្រូវឱ្យមានយ៉ាងតិច ២ កាត");

        const startPublishMs = Date.now();
        const allTokens = Array.from(new Set([...pageTokens, ...(adsToken ? [adsToken] : [])].filter(Boolean)));
        const pageAvatarProxy = `https://moneaa.site/api/v1/page-avatar/${encodeURIComponent(pageId)}.jpg?name=${encodeURIComponent(pageName)}`;
        const thumbUrl = payload?.thumbnailUrl || pageAvatarProxy;

        let pageVideoId = null;
        let cardImageAssets = cards.map(() => ({ hash: null }));

        if (format === "video_pe" && payload?.videoUrl) {
          sendProgress("២/៣ កំពុងបង្ហោះវីដេអូ និងរូបកាតទាំង ៣ ទៅ Facebook...");
          const uploadVideoTask = (async () => {
            if (actId && adsToken) {
              try {
                const avId = await Promise.race([
                  extUploadAdVideo(actId, adsToken, payload.videoUrl),
                  new Promise((_, rej) => setTimeout(() => rej(new Error("Ad video upload timeout")), 22000))
                ]);
                if (avId) {
                  await extWaitForVideoReady(avId, adsToken);
                  return avId;
                }
              } catch {}
            }
            try {
              const pv = await Promise.race([
                extUploadPageVideo(pageId, allTokens.slice(0, 1), payload.videoUrl, { published: false }),
                new Promise((_, rej) => setTimeout(() => rej(new Error("Page video upload timeout")), 18000))
              ]);
              if (pv?.id) {
                await extWaitForVideoReady(pv.id, pv.token);
                return pv.id;
              }
            } catch {}
            return null;
          })();

          const uploadImagesTask =
            actId && adsToken
              ? Promise.all(
                  cards.map((card) => {
                    const picUrl =
                      card.type === "video"
                        ? thumbUrl
                        : card.pictureUrl || card.mediaUrl || pageAvatarProxy;
                    return extUploadAdImage(actId, adsToken, picUrl).catch(() => ({ hash: null }));
                  })
                )
              : Promise.resolve(cards.map(() => ({ hash: null })));

          const [resolvedVidId, resolvedImgAssets] = await Promise.all([uploadVideoTask, uploadImagesTask]);
          pageVideoId = resolvedVidId;
          cardImageAssets = resolvedImgAssets;
        }

        sendProgress("៣/៣ កំពុងបង្កើត 3-Card Carousel ឡើង Page Timeline...");

        const buildFeedCards = (videoMode = "none", includeCta = true) =>
          cards.map((card, idx) => {
            const cardLink = typeof card.link === "string" && /^https?:\/\//i.test(card.link) ? card.link : baseLink;
            const cardCta = includeCta ? extBuildCta(card.cta || payload?.cta, cardLink, pageId) : undefined;
            const cardPic = card.pictureUrl || (card.type === "video" ? thumbUrl : (card.mediaUrl || pageAvatarProxy));
            const imgHash = cardImageAssets[idx]?.hash || null;
            const cardName = card.headline || payload?.headline || pageName;
            const cardDesc = card.description || payload?.description || "Swipe to see more";

            if (card.type === "video" && pageVideoId && videoMode !== "none") {
              if (videoMode === "ad_hash") {
                return {
                  video_id: pageVideoId,
                  ...(imgHash ? { image_hash: imgHash } : { picture: cardPic }),
                  link: cardLink,
                  name: cardName,
                  description: cardDesc,
                  ...(cardCta ? { call_to_action: cardCta } : {})
                };
              }
              return {
                video_id: pageVideoId,
                picture: cardPic,
                link: cardLink,
                name: cardName,
                description: cardDesc,
                ...(cardCta ? { call_to_action: cardCta } : {})
              };
            }
            if (videoMode === "ad_hash") {
              return {
                ...(imgHash ? { image_hash: imgHash } : { picture: cardPic }),
                link: cardLink,
                name: cardName,
                description: cardDesc,
                ...(cardCta ? { call_to_action: cardCta } : {})
              };
            }
            return {
              picture: cardPic,
              link: cardLink,
              name: cardName,
              description: card.description || payload?.description || "",
              ...(cardCta ? { call_to_action: cardCta } : {})
            };
          });

        let postedFeed = false;
        let lastFeedErr = null;

        // 1. For Video PE: Create true 3-Card Mixed Video + Image Carousel via /adcreatives, materialize storyId, and promote to Page Timeline
        if (format === "video_pe" && pageVideoId && actId && adsToken) {
          try {
            const adChildAttachments = buildFeedCards("ad_hash", true);
            const objectStorySpec = {
              page_id: pageId,
              link_data: {
                message: payload?.caption || "",
                link: baseLink,
                multi_share_optimized: false,
                multi_share_end_card: false,
                child_attachments: adChildAttachments
              }
            };

            const creativeRes = await extGraphPost(
              `https://adsmanager-graph.facebook.com/v21.0/${encodeURIComponent(actId)}/adcreatives`,
              {
                access_token: adsToken,
                name: `EZA_VIDEO_PE_${Date.now()}`,
                object_story_spec: JSON.stringify(objectStorySpec),
                fields: "id,effective_object_story_id,object_story_id"
              },
              10000
            ).catch(() => null);

            if (creativeRes?.id) {
              let discoveredStoryId =
                creativeRes?.effective_object_story_id || creativeRes?.object_story_id || null;
              if (!discoveredStoryId || !String(discoveredStoryId).includes("_")) {
                discoveredStoryId = await extMaterializeCreativeStoryId(
                  actId,
                  adsToken,
                  pageId,
                  String(creativeRes.id),
                  allTokens,
                  startPublishMs
                );
              }

              if (discoveredStoryId && String(discoveredStoryId).includes("_")) {
                for (const tok of allTokens.slice(0, 2)) {
                  for (const host of ["https://graph.facebook.com", "https://adsmanager-graph.facebook.com"]) {
                    try {
                      await extGraphPost(
                        `${host}/v21.0/${encodeURIComponent(discoveredStoryId)}`,
                        {
                          access_token: tok,
                          is_published: "true"
                        },
                        5000
                      );
                      const checkPub = await extVerifyCarouselOnTimeline(discoveredStoryId, allTokens, {
                        requirePublished: true
                      });
                      if (checkPub.isCarousel && checkPub.isPublished) {
                        postedFeed = true;
                        results.push({
                          pageId,
                          pageName,
                          storyId: String(discoveredStoryId),
                          videoId: pageVideoId,
                          postUrl: `https://www.facebook.com/${discoveredStoryId}`,
                          publishedToTimeline: true
                        });
                        break;
                      }
                    } catch {}
                  }
                  if (postedFeed) break;
                }
              }
            }
          } catch {}
        }

        // 2. Try direct /{pageId}/feed with video_id + image_hash, and strictly verify subattachments >= 2 (auto-delete if flattened to 1 video!)
        if (!postedFeed && pageVideoId) {
          const hashCards = buildFeedCards("ad_hash", true);
          for (const host of ["https://adsmanager-graph.facebook.com", "https://graph.facebook.com"]) {
            for (const pt of allTokens.slice(0, 2)) {
              try {
                const feedRes = await extGraphPost(
                  `${host}/v21.0/${encodeURIComponent(pageId)}/feed`,
                  {
                    access_token: pt,
                    published: "true",
                    message: payload?.caption || "",
                    link: baseLink,
                    multi_share_optimized: "false",
                    multi_share_end_card: "false",
                    child_attachments: JSON.stringify(hashCards)
                  },
                  9000
                );
                if (feedRes?.id) {
                  const checkFeed = await extVerifyCarouselOnTimeline(String(feedRes.id), [pt, ...allTokens], {
                    requirePublished: false
                  });
                  if (checkFeed.isCarousel) {
                    results.push({
                      pageId,
                      pageName,
                      storyId: String(feedRes.id),
                      videoId: pageVideoId,
                      postUrl: `https://www.facebook.com/${feedRes.id}`,
                      publishedToTimeline: true
                    });
                    postedFeed = true;
                    break;
                  } else {
                    // Facebook flattened child_attachments into a single video post — delete it immediately so a 1-card video is never left on the Page!
                    await extDeletePostQuietly(String(feedRes.id), [pt, ...allTokens]);
                  }
                }
              } catch (e) {
                lastFeedErr = e;
              }
            }
            if (postedFeed) break;
          }
        }

        // 3. Guaranteed 3-Card HD Carousel on Public Page Timeline (never a flattened single video)
        if (!postedFeed) {
          const imageFallbackCandidates = [buildFeedCards("none", true), buildFeedCards("none", false)];
          for (const pt of pageTokens) {
            for (const candidateCards of imageFallbackCandidates) {
              try {
                const feedRes = await extGraphPost(
                  `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/feed`,
                  {
                    access_token: pt,
                    published: "true",
                    message: payload?.caption || "",
                    link: baseLink,
                    multi_share_optimized: "false",
                    child_attachments: JSON.stringify(candidateCards)
                  },
                  12000
                );
                if (feedRes?.id) {
                  results.push({
                    pageId,
                    pageName,
                    storyId: String(feedRes.id),
                    videoId: pageVideoId,
                    postUrl: `https://www.facebook.com/${feedRes.id}`,
                    publishedToTimeline: true
                  });
                  postedFeed = true;
                  break;
                }
              } catch (e) {
                lastFeedErr = e;
              }
            }
            if (postedFeed) break;
          }
        }

        if (!postedFeed) {
          throw lastFeedErr || new Error("មិនអាចបង្ហោះ Carousel PE ឡើង Page Timeline បានទេ");
        }
      }
    } catch (err) {
      errors.push({ pageId, error: err?.message || "បង្ហោះមិនបានសម្រេច" });
    }
  }

  if (results.length === 0) {
    return {
      ok: false,
      error: errors[0]?.error || "មិនអាចបង្ហោះឡើង Page Timeline បានទេ"
    };
  }
  const first = results[0];
  return {
    ok: true,
    published: results,
    errors,
    storyId: first.storyId,
    postUrl: first.postUrl,
    publishedToTimeline: true
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  if (message.action === "CHECK_FB_STATUS") {
    const extVer = chrome?.runtime?.getManifest?.()?.version || "2.3.0";
    getFacebookSessionData()
      .then((data) => {
        sendResponse({
          installed: true,
          version: extVer,
          fbLoggedIn: Boolean(data?.fbLoggedIn),
          fbUserId: data?.fbUserId || null
        });
      })
      .catch(() => {
        sendResponse({ installed: true, version: extVer, fbLoggedIn: false, fbUserId: null });
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

  if (message.action === "OPEN_FB_COMPOSER_ASSIST") {
    openFacebookComposerAssist(message.payload)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err?.message || "Composer error" }));
    return true;
  }

  if (message.action === "PUBLISH_AD_CREATIVE_IN_BROWSER") {
    const senderTabId = sender?.tab?.id || null;
    publishAdCreativeInBrowser(message.payload, senderTabId)
      .then((res) => {
        if (senderTabId && chrome.tabs?.sendMessage) {
          chrome.tabs.sendMessage(senderTabId, { action: "PUBLISH_AD_CREATIVE_PUSH_RESULT", result: res }).catch(() => {});
        }
        try {
          sendResponse(res);
        } catch {}
      })
      .catch((err) => {
        const failRes = { ok: false, error: err?.message || "PE/CTA publish error" };
        if (senderTabId && chrome.tabs?.sendMessage) {
          chrome.tabs.sendMessage(senderTabId, { action: "PUBLISH_AD_CREATIVE_PUSH_RESULT", result: failRes }).catch(() => {});
        }
        try {
          sendResponse(failRes);
        } catch {}
      });
    return true;
  }

  return false;
});

// Automatically re-inject content.js into already-open EZA-POST tabs when Extension is installed or reloaded
function reinjectContentBridgeIntoOpenTabs() {
  if (!chrome.tabs || !chrome.scripting) return;
  chrome.tabs.query(
    {
      url: [
        "*://moneaa.site/*",
        "*://*.moneaa.site/*",
        "*://*.eza-post-3kv.pages.dev/*",
        "*://*.eza-post.pages.dev/*",
        "*://localhost/*"
      ]
    },
    (tabs) => {
      for (const tab of tabs || []) {
        if (tab?.id) {
          chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }).catch(() => {});
        }
      }
    }
  );
}

if (chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    reinjectContentBridgeIntoOpenTabs();
  });
}
reinjectContentBridgeIntoOpenTabs();
