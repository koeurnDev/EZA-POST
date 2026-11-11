/**
 * ============================================================
 * ⚡ EZA-POST Facebook Sync Extension — Background Service Worker
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

async function getFacebookSessionData() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: ".facebook.com" });
    if (!cookies || cookies.length === 0) {
      return {
        ok: false,
        fbLoggedIn: false,
        fbUserId: null,
        cookieString: "",
        error: "សូមបើក facebook.com ហើយ Login គណនី Facebook លើ Browser ជាមុនសិន!"
      };
    }

    const cUser = cookies.find((c) => c.name === "c_user");
    const xs = cookies.find((c) => c.name === "xs");

    if (!cUser || !xs) {
      return {
        ok: false,
        fbLoggedIn: false,
        fbUserId: null,
        cookieString: "",
        error: "រកមិនឃើញគណនី Facebook ដែលបាន Login លើ Browser ទេ។ សូម Login facebook.com ជាមុនសិន!"
      };
    }

    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    return {
      ok: true,
      fbLoggedIn: true,
      fbUserId: cUser.value,
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
  const session = await getFacebookSessionData();
  if (!session.ok) return session;

  let accessToken = null;
  let fbUser = {
    id: session.fbUserId,
    name: "Facebook User",
    picture: `https://graph.facebook.com/${session.fbUserId}/picture?type=large`
  };
  let pages = [];

  const endpoints = [
    "https://business.facebook.com/business_locations",
    "https://adsmanager.facebook.com/adsmanager/manage/campaigns",
    "https://www.facebook.com/pages/?category=your_pages"
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { credentials: "include", redirect: "follow" });
      const html = await res.text();
      if (!html) continue;

      const tok = extractTokenFromText(html);
      if (tok) {
        accessToken = tok;
        break;
      }

      const nameMatch =
        html.match(/"CURRENT_USER_INITIAL_DATA"\s*,\s*\[\]\s*,\s*\{[^}]*"NAME"\s*:\s*"([^"]+)"/) ||
        html.match(/"NAME"\s*:\s*"([^"]+)"/);
      if (nameMatch && nameMatch[1]) {
        try {
          fbUser.name = JSON.parse(`"${nameMatch[1].replace(/"/g, '\\"')}"`);
        } catch {
          fbUser.name = nameMatch[1];
        }
      }

      const extractedPages = parsePagesFromFacebookHtml(html, session.fbUserId);
      for (const p of extractedPages) {
        if (!pages.some((x) => x.id === p.id)) {
          pages.push(p);
        }
      }
    } catch {}
  }

  return {
    ...session,
    accessToken,
    fbUser,
    pages
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  if (message.action === "CHECK_FB_STATUS") {
    getFacebookSessionData().then((data) => {
      sendResponse({
        installed: true,
        version: "2.0.0",
        fbLoggedIn: data.fbLoggedIn,
        fbUserId: data.fbUserId
      });
    });
    return true;
  }

  if (message.action === "GET_FB_SYNC_PAYLOAD") {
    getFullFacebookSyncPayload().then((data) => {
      sendResponse(data);
    });
    return true;
  }

  return false;
});
