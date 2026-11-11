/**
 * ============================================================
 * ⚡ EZA-POST Extension Popup Script (v2.0.1)
 * ============================================================
 */

const DEFAULT_SERVER_URL = "https://eza-post-3kv.pages.dev";

document.addEventListener("DOMContentLoaded", async () => {
  const fbStatusBadge = document.getElementById("fbStatusBadge");
  const statusDot = document.getElementById("statusDot");
  const fbUserText = document.getElementById("fbUserText");
  const btnSync = document.getElementById("btnSync");
  const btnSyncText = document.getElementById("btnSyncText");
  const btnOpenDashboard = document.getElementById("btnOpenDashboard");
  const messageBox = document.getElementById("messageBox");
  const messageContent = document.getElementById("messageContent");

  let fbUserId = null;

  async function getEzaConnectionConfig() {
    const storageData = await chrome.storage.local.get(["serverUrl", "ezaAuthToken"]).catch(() => ({}));
    let serverUrl = storageData?.serverUrl || DEFAULT_SERVER_URL;
    let ezaAuthToken = storageData?.ezaAuthToken || "";

    try {
      const tabs = await chrome.tabs.query({
        url: ["https://*.pages.dev/*", "http://localhost:*/*", "http://127.0.0.1:*/*"]
      });
      if (tabs && tabs.length > 0 && tabs[0].url) {
        const u = new URL(tabs[0].url);
        serverUrl = u.origin;
      }
    } catch (e) {}

    return { serverUrl: serverUrl.replace(/\/$/, ""), ezaAuthToken };
  }

  function setOnlineState(userId) {
    fbStatusBadge.textContent = "Online";
    fbStatusBadge.className = "badge online";
    statusDot.className = "dot active";
    fbUserText.textContent = `បានរកឃើញគណនី FB: ${userId}`;
    btnSync.disabled = false;
  }

  function setOfflineState(message) {
    fbStatusBadge.textContent = "Offline";
    fbStatusBadge.className = "badge offline";
    statusDot.className = "dot";
    fbUserText.textContent = message;
    btnSync.disabled = true;
  }

  function showMessage(msg, type = "success") {
    messageBox.className = `message-box ${type}`;
    messageContent.textContent = msg;
    messageBox.classList.remove("hidden");
  }

  function checkFacebookSession() {
    chrome.runtime.sendMessage({ action: "CHECK_FB_STATUS" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        setOfflineState("មានបញ្ហាក្នុងការពិនិត្យសម័យ Facebook");
        return;
      }
      if (response.fbLoggedIn && response.fbUserId) {
        fbUserId = response.fbUserId;
        setOnlineState(fbUserId);
      } else {
        setOfflineState("សូម Login គណនី Facebook លើ Browser ជាមុនសិន");
      }
    });
  }

  btnSync.addEventListener("click", async () => {
    btnSync.disabled = true;
    btnSyncText.textContent = "កំពុងទាញយកទិន្នន័យពី Facebook...";

    chrome.runtime.sendMessage({ action: "GET_FB_SYNC_PAYLOAD" }, async (payload) => {
      if (chrome.runtime.lastError || !payload || !payload.ok) {
        showMessage(payload?.error || "សូម Login គណនី Facebook លើ Browser ជាមុនសិន!", "error");
        btnSync.disabled = false;
        btnSyncText.textContent = "ព្យាយាមម្តងទៀត";
        return;
      }

      const { serverUrl, ezaAuthToken } = await getEzaConnectionConfig();
      btnSyncText.textContent = "កំពុង Sync ផេកទៅកាន់ EZA-POST...";

      try {
        const headers = { "Content-Type": "application/json" };
        if (ezaAuthToken) {
          headers["Authorization"] = `Bearer ${ezaAuthToken}`;
        }

        const res = await fetch(`${serverUrl}/api/user/pages/connect-cookie`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            cookieOrToken: payload.cookieString,
            accessToken: payload.accessToken || null,
            fbUser: payload.fbUser || null,
            pages: Array.isArray(payload.pages) ? payload.pages : []
          })
        });

        const data = await res.json().catch(() => ({}));

        if (data?.success) {
          const count = data.pagesCount ?? (data.pages ? data.pages.length : 0);
          const userName = payload.fbUser?.name || "គណនី Facebook";
          const countText = count > 0
            ? `បានភ្ជាប់ ${count} គោលដៅ (គណនី និងផេក)`
            : `បានភ្ជាប់គណនី ${userName}`;
          showMessage(
            `🎉 ជោគជ័យ! ${countText} ទៅកាន់ EZA-POST រួចរាល់!`,
            "success"
          );
          btnSyncText.textContent = "✅ Sync ជោគជ័យ!";

          setTimeout(() => {
            chrome.tabs.create({ url: `${serverUrl}/connections` });
          }, 1200);
        } else {
          showMessage(
            `សូមបើកទំព័រ EZA-POST រួចចុចប៊ូតុង Sync នៅលើវេបសាយផ្ទាល់ (${data?.error || "Unauthorized"})`,
            "error"
          );
          btnSyncText.textContent = "ព្យាយាមម្តងទៀត";
          btnSync.disabled = false;
        }
      } catch (err) {
        showMessage(
          "សូមបើកទំព័រភ្ជាប់ផេក EZA-POST រួចចុចប៊ូតុង Sync នៅលើវេបសាយផ្ទាល់!",
          "error"
        );
        btnSyncText.textContent = "ព្យាយាមម្តងទៀត";
        btnSync.disabled = false;
      }
    });
  });

  btnOpenDashboard.addEventListener("click", async () => {
    const { serverUrl } = await getEzaConnectionConfig();
    chrome.tabs.create({ url: `${serverUrl}/connections` });
  });

  checkFacebookSession();
});
