/**
 * ============================================================
 * ⚡ EZA-POST Facebook Sync Extension — Content Bridge Script (v2.0.1)
 * ============================================================
 */

(function () {
  // Mark DOM so the EZA-POST web app immediately knows the extension is installed
  document.documentElement.setAttribute("data-eza-extension", "installed");
  document.documentElement.setAttribute("data-eza-extension-version", "2.0.2");

  function isExtensionValid() {
    return typeof chrome !== "undefined" && Boolean(chrome?.runtime?.id);
  }

  function syncWebAuthToStorage() {
    if (!isExtensionValid()) return;
    try {
      const token = localStorage.getItem("eza_post_token") || localStorage.getItem("token") || "";
      const origin = window.location.origin;
      chrome.storage.local.set({
        ezaAuthToken: token,
        serverUrl: origin
      });
    } catch (e) {}
  }

  syncWebAuthToStorage();

  function broadcastStatus() {
    if (!isExtensionValid()) return;
    try {
      chrome.runtime.sendMessage({ action: "CHECK_FB_STATUS" }, (response) => {
        if (chrome.runtime.lastError || !response) return;
        window.postMessage(
          {
            source: "EZA_EXTENSION",
            action: "EXTENSION_STATUS",
            installed: true,
            version: response.version || "2.0.1",
            fbLoggedIn: Boolean(response.fbLoggedIn),
            fbUserId: response.fbUserId || null
          },
          "*"
        );
      });
    } catch (e) {}
  }

  // Initial broadcast after DOM is ready
  setTimeout(broadcastStatus, 300);

  // Listen for requests from the EZA-POST React web app
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== "EZA_WEB_APP") {
      return;
    }

    const { action } = event.data;

    if (action === "CHECK_EXTENSION") {
      syncWebAuthToStorage();
      broadcastStatus();
    } else if (action === "SYNC_FB_PAGES") {
      if (!isExtensionValid()) {
        window.postMessage(
          {
            source: "EZA_EXTENSION",
            action: "FB_SYNC_PAYLOAD",
            ok: false,
            error: "Extension ត្រូវបាន Reload ឬ Update សូម Refresh ទំព័រនេះម្តងទៀត!"
          },
          "*"
        );
        return;
      }

      syncWebAuthToStorage();
      try {
        chrome.runtime.sendMessage({ action: "GET_FB_SYNC_PAYLOAD" }, (response) => {
          if (chrome.runtime.lastError || !response) {
            window.postMessage(
              {
                source: "EZA_EXTENSION",
                action: "FB_SYNC_PAYLOAD",
                ok: false,
                error: "មិនអាចភ្ជាប់ទៅកាន់ Extension បានទេ សូម Refresh ទំព័រនេះម្តងទៀត!"
              },
              "*"
            );
            return;
          }

          window.postMessage(
            {
              source: "EZA_EXTENSION",
              action: "FB_SYNC_PAYLOAD",
              ok: Boolean(response.ok),
              fbUserId: response.fbUserId || null,
              cookieString: response.cookieString || "",
              accessToken: response.accessToken || null,
              fbUser: response.fbUser || null,
              pages: Array.isArray(response.pages) ? response.pages : [],
              error: response.error || null
            },
            "*"
          );
        });
      } catch (err) {
        window.postMessage(
          {
            source: "EZA_EXTENSION",
            action: "FB_SYNC_PAYLOAD",
            ok: false,
            error: "Extension context invalidated, សូម Refresh ទំព័រ!"
          },
          "*"
        );
      }
    }
  });
})();
