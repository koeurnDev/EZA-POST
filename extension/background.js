/**
 * ============================================================
 * ⚡ EZA-POST Facebook Sync Extension — Background Service Worker (v2.2.1)
 * ============================================================
 */

function extractAllTokensFromText(text) {
  if (!text || typeof text !== "string") return [];
  const seen = new Set();
  const normalized = text.replace(/\\\//g, "/");
  const matches = normalized.match(/EAA[A-Za-z0-9_-]{40,}/g) || [];
  for (const tok of matches) {
    seen.add(tok);
  }
  return Array.from(seen);
}

async function validateAdsToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const [accRes, permRes] = await Promise.all([
      fetch(
        `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,account_id,name,account_status,currency&limit=50&access_token=${encodeURIComponent(token)}`
      ).catch(() => null),
      fetch(
        `https://graph.facebook.com/v21.0/me/permissions?access_token=${encodeURIComponent(token)}`
      ).catch(() => null)
    ]);
    if (!accRes?.ok) return null;
    const accData = await accRes.json().catch(() => ({}));
    if (!Array.isArray(accData?.data)) return null;

    const permData = permRes?.ok ? await permRes.json().catch(() => ({})) : {};
    const granted = Array.isArray(permData?.data)
      ? permData.data.filter((p) => p?.status === "granted").map((p) => p.permission)
      : [];
    const hasAdsManage = token.startsWith("EAAB") || granted.includes("ads_management");

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
  let tempTab = null;
  try {
    tempTab = await chrome.tabs.create({ url: targetUrl, active: false });
    await waitForTabComplete(tempTab.id, 18000);
    await sleep(2500);
    let tokens = await collectTokensFromAdsTab(tempTab.id);
    if (!tokens.some((t) => t.startsWith("EAAB"))) {
      await sleep(2000);
      tokens = Array.from(new Set([...tokens, ...(await collectTokensFromAdsTab(tempTab.id))]));
    }
    return tokens;
  } catch {
    return [];
  } finally {
    if (tempTab?.id) {
      chrome.tabs.remove(tempTab.id).catch(() => {});
    }
  }
}

async function extractAdsContext(seedTokens = []) {
  let fallbackAccounts = [];
  const seen = new Set();
  const evaluateCandidates = async (pool) => {
    const filtered = (pool || []).filter(
      (t) => typeof t === "string" && /^EAA[A-Za-z0-9_-]{30,}$/.test(t)
    );
    const ranked = [
      ...filtered.filter((t) => t.startsWith("EAAB")),
      ...filtered.filter((t) => !t.startsWith("EAAB"))
    ];
    for (const tok of ranked) {
      if (seen.has(tok)) continue;
      seen.add(tok);
      const info = await validateAdsToken(tok);
      if (!info) continue;
      if (info.accounts.length > 0 && fallbackAccounts.length === 0) {
        fallbackAccounts = info.accounts;
      }
      if (info.hasAdsManage) {
        return { adsToken: tok, adAccounts: info.accounts.length > 0 ? info.accounts : fallbackAccounts };
      }
    }
    return null;
  };

  const openAdsTokens = await extractAdsTokensFromOpenAdsTabs();
  const hitOpen = await evaluateCandidates([...openAdsTokens, ...seedTokens]);
  if (hitOpen) return hitOpen;

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

  // Fallback: render Ads Manager SPA briefly in an inactive background tab so JS globals / network resources populate EAAB
  const bgTokens = await tryBackgroundAdsTabExtraction(fallbackAccounts[0]?.accountId || "");
  const hitBg = await evaluateCandidates(bgTokens);
  if (hitBg) return hitBg;

  return { adsToken: null, adAccounts: fallbackAccounts };
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

    const payload = {
      ...session,
      accessToken,
      adsToken: adsCtx.adsToken || null,
      adAccounts: adsCtx.adAccounts || [],
      fbUser,
      pages: Array.from(pagesMap.values())
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  if (message.action === "CHECK_FB_STATUS") {
    const extVer = chrome?.runtime?.getManifest?.()?.version || "2.2.1";
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

  return false;
});
