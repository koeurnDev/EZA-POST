/**
 * ============================================================
 * ⚡ EZA-POST Facebook Sync Extension — Content Bridge Script (v2.4.3)
 * ============================================================
 */

(function () {
  const MY_BRIDGE_VERSION = "2.4.3";
  // Prevent duplicate listeners if re-injected on extension reload
  if (window.__ezaContentBridgeVersion === MY_BRIDGE_VERSION) return;
  window.__ezaContentBridgeVersion = MY_BRIDGE_VERSION;

  // Mark DOM so the EZA-POST web app immediately knows the extension is installed
  document.documentElement.setAttribute("data-eza-extension", "installed");
  document.documentElement.setAttribute("data-eza-extension-version", MY_BRIDGE_VERSION);

  function isCurrentBridge() {
    return window.__ezaContentBridgeVersion === MY_BRIDGE_VERSION;
  }

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
            version: response.version || "2.4.0",
            fbLoggedIn: Boolean(response.fbLoggedIn),
            fbUserId: response.fbUserId || null
          },
          "*"
        );
      });
    } catch (e) {}
  }

  // Initial broadcast after DOM is ready
  setTimeout(broadcastStatus, 200);

  // Listen for push progress and push results from background service worker (immune to MV3 sendResponse timeout)
  if (isExtensionValid() && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || !msg.action) return;
      if (msg.action === "PUBLISH_AD_CREATIVE_PROGRESS") {
        window.postMessage(
          {
            source: "EZA_EXTENSION",
            action: "PUBLISH_AD_CREATIVE_PROGRESS",
            text: msg.text || ""
          },
          "*"
        );
      } else if (msg.action === "PUBLISH_AD_CREATIVE_PUSH_RESULT") {
        window.postMessage(
          {
            source: "EZA_EXTENSION",
            action: "PUBLISH_AD_CREATIVE_RESULT",
            ...(msg.result || {})
          },
          "*"
        );
      }
    });
  }

  // Listen for requests from the EZA-POST React web app
  window.addEventListener("message", (event) => {
    if (!isCurrentBridge()) return;
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
              accessToken: response.accessToken || null,
              adsToken: response.adsToken || null,
              adsTokenVerified: Boolean(response.adsTokenVerified),
              adAccounts: Array.isArray(response.adAccounts) ? response.adAccounts : [],
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
    } else if (action === "PUBLISH_AD_CREATIVE") {
      if (!isExtensionValid()) {
        window.postMessage(
          {
            source: "EZA_EXTENSION",
            action: "PUBLISH_AD_CREATIVE_RESULT",
            ok: false,
            error: "Extension ត្រូវបាន Reload — សូម Refresh ទំព័រនេះម្តងទៀត!"
          },
          "*"
        );
        return;
      }

      try {
        chrome.runtime.sendMessage(
          { action: "PUBLISH_AD_CREATIVE_IN_BROWSER", payload: event.data.payload || {} },
          (response) => {
            if (chrome.runtime.lastError || !response) {
              window.postMessage(
                {
                  source: "EZA_EXTENSION",
                  action: "PUBLISH_AD_CREATIVE_RESULT",
                  ok: false,
                  error: chrome.runtime.lastError?.message || "Extension មិនឆ្លើយតបពេលផុស PE/CTA"
                },
                "*"
              );
              return;
            }
            window.postMessage(
              {
                source: "EZA_EXTENSION",
                action: "PUBLISH_AD_CREATIVE_RESULT",
                ...response
              },
              "*"
            );
          }
        );
      } catch {
        window.postMessage(
          {
            source: "EZA_EXTENSION",
            action: "PUBLISH_AD_CREATIVE_RESULT",
            ok: false,
            error: "Extension context invalidated, សូម Refresh ទំព័រ!"
          },
          "*"
        );
      }
    } else if (action === "PREPARE_COMPOSER_POST") {
      if (!isExtensionValid()) {
        window.postMessage(
          {
            source: "EZA_EXTENSION",
            action: "COMPOSER_ASSIST_RESULT",
            ok: false,
            error: "Extension ត្រូវបាន Reload — សូម Refresh ទំព័រនេះម្តងទៀត!"
          },
          "*"
        );
        return;
      }

      try {
        chrome.runtime.sendMessage(
          { action: "OPEN_FB_COMPOSER_ASSIST", payload: event.data.payload || {} },
          (response) => {
            if (chrome.runtime.lastError || !response) {
              window.postMessage(
                {
                  source: "EZA_EXTENSION",
                  action: "COMPOSER_ASSIST_RESULT",
                  ok: false,
                  error: "មិនអាចបើក Meta Business Suite តាម Extension បានទេ"
                },
                "*"
              );
              return;
            }
            window.postMessage(
              {
                source: "EZA_EXTENSION",
                action: "COMPOSER_ASSIST_RESULT",
                ok: Boolean(response.ok),
                error: response.error || null
              },
              "*"
            );
          }
        );
      } catch {
        window.postMessage(
          {
            source: "EZA_EXTENSION",
            action: "COMPOSER_ASSIST_RESULT",
            ok: false,
            error: "Extension context invalidated, សូម Refresh ទំព័រ!"
          },
          "*"
        );
      }
    }
  });
})();
