/**
 * ============================================================
 * ⚡ EZA-POST Extension Popup Script (v2.0.0)
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

  let currentCookieString = "";
  let fbUserId = null;

  // Detect active EZA-POST server URL & token
  async function getEzaConnectionConfig() {
    const storageData = await chrome.storage.local.get(["serverUrl", "ezaAuthToken"]);
    let serverUrl = storageData.serverUrl || DEFAULT_SERVER_URL;
    let ezaAuthToken = storageData.ezaAuthToken || "";

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

  // Fetch Facebook Session Cookies
  async function checkFacebookSession() {
    try {
      const cookies = await chrome.cookies.getAll({ domain: ".facebook.com" });
      if (!cookies || cookies.length === 0) {
        setOfflineState("មិនទាន់ Login Facebook លើ Browser ទេ");
        return;
      }

      const cUserCookie = cookies.find((c) => c.name === "c_user");
      const xsCookie = cookies.find((c) => c.name === "xs");

      if (cUserCookie && xsCookie) {
        fbUserId = cUserCookie.value;
        currentCookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

        fbStatusBadge.textContent = "Online";
        fbStatusBadge.className = "badge online";
        statusDot.className = "dot active";
        fbUserText.textContent = `បានរកឃើញគណនី FB: ${fbUserId}`;
        btnSync.disabled = false;
      } else {
        setOfflineState("សូម Login គណនី Facebook លើ Browser ជាមុនសិន");
      }
    } catch (err) {
      setOfflineState("មានបញ្ហាក្នុងការពិនិត្យសម័យ Facebook");
    }
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

  // 1-Click Sync to EZA-POST
  btnSync.addEventListener("click", async () => {
    if (!currentCookieString) {
      showMessage("សូមបើក facebook.com ហើយ Login លើ Browser ជាមុនសិន!", "error");
      return;
    }

    const { serverUrl, ezaAuthToken } = await getEzaConnectionConfig();
    btnSync.disabled = true;
    btnSyncText.textContent = "កំពុង Sync ផេកទៅកាន់ EZA-POST...";

    try {
      const payload = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "GET_FB_SYNC_PAYLOAD" }, (resp) => {
          resolve(resp || { cookieString: currentCookieString });
        });
      });

      const headers = {
        "Content-Type": "application/json"
      };
      if (ezaAuthToken) {
        headers["Authorization"] = `Bearer ${ezaAuthToken}`;
      }

      const res = await fetch(`${serverUrl}/api/user/pages/connect-cookie`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          cookieOrToken: payload.cookieString || currentCookieString,
          accessToken: payload.accessToken || null,
          fbUser: payload.fbUser || null,
          pages: Array.isArray(payload.pages) ? payload.pages : []
        })
      });

      const data = await res.json();

      if (data.success) {
        const count = data.pagesCount ?? (data.pages ? data.pages.length : 0);
        showMessage(
          `🎉 ជោគជ័យ! បានភ្ជាប់ផេកចំនួន ${count} ទៅកាន់ EZA-POST រួចរាល់!`,
          "success"
        );
        btnSyncText.textContent = "✅ Sync ផេកជោគជ័យ!";

        setTimeout(() => {
          chrome.tabs.create({ url: `${serverUrl}/connections` });
        }, 1200);
      } else {
        showMessage(
          `សូមបើកទំព័រ EZA-POST រួចចុចប៊ូតុង Sync នៅលើវេបសាយផ្ទាល់ (${data.error || "Unauthorized"})`,
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

  btnOpenDashboard.addEventListener("click", async () => {
    const { serverUrl } = await getEzaConnectionConfig();
    chrome.tabs.create({ url: `${serverUrl}/connections` });
  });

  checkFacebookSession();
});
