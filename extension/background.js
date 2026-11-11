/**
 * ============================================================
 * ⚡ EZA-POST Facebook Sync Extension — Background Service Worker
 * ============================================================
 */

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
    getFacebookSessionData().then((data) => {
      sendResponse(data);
    });
    return true;
  }

  return false;
});
