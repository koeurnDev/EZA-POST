/**
 * ============================================================
 * ⚡ EZA-POST Extension Popup Script
 * ============================================================
 */

document.addEventListener("DOMContentLoaded", async () => {
  const fbStatusBadge = document.getElementById("fbStatusBadge");
  const statusDot = document.getElementById("statusDot");
  const fbUserText = document.getElementById("fbUserText");
  const btnSync = document.getElementById("btnSync");
  const btnSyncText = document.getElementById("btnSyncText");
  const btnCopyCookie = document.getElementById("btnCopyCookie");
  const btnOpenDashboard = document.getElementById("btnOpenDashboard");
  const messageBox = document.getElementById("messageBox");
  const messageContent = document.getElementById("messageContent");
  const serverUrlInput = document.getElementById("serverUrl");
  const btnSaveSettings = document.getElementById("btnSaveSettings");

  let currentCookieString = "";
  let fbUserId = null;

  // 1. Load saved settings
  const storageData = await chrome.storage.local.get(["serverUrl"]);
  if (storageData.serverUrl) {
    serverUrlInput.value = storageData.serverUrl;
  }

  btnSaveSettings.addEventListener("click", async () => {
    const newUrl = serverUrlInput.value.trim().replace(/\/$/, "");
    await chrome.storage.local.set({ serverUrl: newUrl });
    showMessage("បានរក្សាទុក Server URL ដោយជោគជ័យ!", "success");
  });

  // 2. Fetch Facebook Session Cookies
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

        // Set Online UI
        fbStatusBadge.textContent = "Online";
        fbStatusBadge.className = "badge online";
        statusDot.className = "dot active";
        fbUserText.textContent = `បានរកឃើញ FB User: ${fbUserId}`;
        btnSync.disabled = false;
      } else {
        setOfflineState("រកមិនឃើញ c_user ឬ xs cookie ឡើយ");
      }
    } catch (err) {
      console.error("Error reading cookies:", err);
      setOfflineState("មានបញ្ហាក្នុងការអាន Cookie");
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

  // 3. 1-Click Sync to EZA-POST
  btnSync.addEventListener("click", async () => {
    if (!currentCookieString) {
      showMessage("សូមបើក Facebook ហើយ Login លើ Browser ជាមុនសិន!", "error");
      return;
    }

    const serverUrl = serverUrlInput.value.trim().replace(/\/$/, "");
    btnSync.disabled = true;
    btnSyncText.textContent = "កំពុង Sync ទៅកាន់ EZA-POST...";

    try {
      const res = await fetch(`${serverUrl}/api/user/pages/connect-cookie`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // send existing session cookie if on localhost
        body: JSON.stringify({
          cookieOrToken: currentCookieString,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const count = data.pagesCount ?? (data.pages ? data.pages.length : 0);
        showMessage(
          `🎉 ជោគជ័យ! បានទាញយក ${count} Pages ទៅកាន់ EZA-POST រួចរាល់!`,
          "success"
        );
        btnSyncText.textContent = "✅ Sync ជោគជ័យ!";

        // Auto open dashboard after 1.5s
        setTimeout(() => {
          chrome.tabs.create({ url: "http://localhost:5173/connections" });
        }, 1500);
      } else {
        showMessage(`បរាជ័យ: ${data.error || "មិនអាចទាញយក Pages បានទេ"}`, "error");
        btnSyncText.textContent = "ព្យាយាមម្តងទៀត";
        btnSync.disabled = false;
      }
    } catch (err) {
      console.error("Sync API Error:", err);
      showMessage(
        `មិនអាចទាក់ទងទៅ EZA-POST Server (${serverUrl}) បានទេ! សូមប្រាកដថា Backend កំពុងដំណើរការ។`,
        "error"
      );
      btnSyncText.textContent = "ព្យាយាមម្តងទៀត";
      btnSync.disabled = false;
    }
  });

  // 4. Quick Actions
  btnCopyCookie.addEventListener("click", () => {
    if (!currentCookieString) {
      showMessage("មិនមាន Cookie សម្រាប់ Copy ទេ", "error");
      return;
    }
    navigator.clipboard.writeText(currentCookieString);
    btnCopyCookie.textContent = "✅ Copied!";
    setTimeout(() => {
      btnCopyCookie.innerHTML = "<span>📋</span> Copy Cookie";
    }, 2000);
  });

  btnOpenDashboard.addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:5173/connections" });
  });

  // Initialize
  checkFacebookSession();
});

