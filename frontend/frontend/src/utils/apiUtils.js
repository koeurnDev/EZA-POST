/**
 * ============================================================
 * 🧩 apiUtils.js — Shared API Helper Functions (Final Optimized)
 * ============================================================
 */

import { API_ERRORS, ERROR_MESSAGES, API_CONFIG } from "./apiConstants";
import axios from "axios";

/* ----------------------------------------------- */
/* 🛡️ CSRF Protection Setup */
/* ----------------------------------------------- */
let csrfToken = null;

export const fetchCsrfToken = async () => {
  try {
    const res = await axios.get(getFullUrl("/csrf-token"), { withCredentials: true });
    csrfToken = res.data.csrfToken;
    return csrfToken;
  } catch (err) {
    console.warn("⚠️ Failed to fetch CSRF token:", err);
  }
};

// ✅ Axios Interceptor to attach CSRF Token
axios.interceptors.request.use(async (config) => {
  // Only attach for state-changing methods
  if (['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase())) {
    if (!csrfToken) await fetchCsrfToken();
    if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
}, (error) => Promise.reject(error));

/* ----------------------------------------------- */
/* ✅ Error Message Helpers */
/* ----------------------------------------------- */
export const getErrorMessage = (code) =>
  ERROR_MESSAGES?.[code] ||
  "An unexpected error occurred. Please try again later.";

/* ----------------------------------------------- */
/* ✅ Error Type Checks */
/* ----------------------------------------------- */
export const isAuthError = (error) =>
  error?.code === API_ERRORS.UNAUTHORIZED ||
  error?.code === API_ERRORS.TOKEN_EXPIRED ||
  error?.response?.status === 401;

export const isNetworkError = (error) =>
  !error?.response &&
  (error?.message?.toLowerCase().includes("network") ||
    error?.message?.toLowerCase().includes("timeout"));

export const isRetryableError = (code) =>
  [
    API_ERRORS.NETWORK_ERROR,
    API_ERRORS.SERVER_ERROR,
    API_ERRORS.RATE_LIMITED,
  ].includes(code);

/* ----------------------------------------------- */
/* ✅ Retry with exponential backoff */
/* ----------------------------------------------- */
export const retryRequest = async (
  fn,
  retries = API_CONFIG.RETRY_ATTEMPTS,
  delay = API_CONFIG.RETRY_DELAY
) => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0 || isAuthError(error) || !isRetryableError(error?.code)) {
      throw error;
    }
    console.warn(
      `⏳ Retrying request (${API_CONFIG.RETRY_ATTEMPTS - retries + 1}) after ${delay}ms...`
    );
    await new Promise((res) => setTimeout(res, delay));
    return retryRequest(fn, retries - 1, delay * 2);
  }
};

/* ----------------------------------------------- */
/* ✅ Full API URL Builder */
/* ----------------------------------------------- */
export const getFullUrl = (endpoint) => {
  if (!endpoint) throw new Error("Missing API endpoint.");
  const base = API_CONFIG.BASE_URL?.replace(/\/+$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};

/* ----------------------------------------------- */
/* ✅ Local Storage Helpers (Safe Context) */
/* ----------------------------------------------- */
export const saveUserData = (user) => {
  try {
    window.localStorage.setItem("eza_post_user", JSON.stringify(user));
  } catch (err) {
    console.warn("⚠️ Failed to save user data:", err);
  }
};

export const getUserData = () => {
  try {
    const raw = window.localStorage.getItem("eza_post_user");
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("⚠️ Failed to parse user data:", err);
    return null;
  }
};

export const clearUserData = () => {
  const keys = [
    "eza_post_user",
    "eza_post_custom_accounts",
    "eza_post_bot_rules",
    "eza_post_bot_enabled",
  ];
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      console.warn("⚠️ Failed to remove key:", key, err);
    }
  }
};

/* ----------------------------------------------- */
/* ✅ Upload with progress tracking */
/* ----------------------------------------------- */
export const uploadWithProgress = (url, formData, onProgress) =>
  new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && typeof onProgress === "function") {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(xhr.responseText);
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () =>
        reject(new Error("Upload failed due to network error."));
      xhr.open("POST", getFullUrl(url));
      xhr.withCredentials = true;
      xhr.send(formData);
    } catch (err) {
      reject(err);
    }
  });

/* ----------------------------------------------- */
/* ✅ User-Friendly Error Formatting */
/* ----------------------------------------------- */
export const getUserErrorMessage = (error) => {
  if (!error) return "Unknown error occurred.";

  if (isAuthError(error)) return getErrorMessage(API_ERRORS.UNAUTHORIZED);
  if (isNetworkError(error)) return getErrorMessage(API_ERRORS.NETWORK_ERROR);
  if (error?.code && ERROR_MESSAGES?.[error.code])
    return ERROR_MESSAGES[error.code];

  return error?.message || "Unexpected error occurred.";
};

/* ----------------------------------------------- */
/* ✅ Centralized Error Handling & Logging */
/* ----------------------------------------------- */
export const logError = (context, error) => {
  console.error(`[${context}] Error:`, error);
  // In a real app, you would send this to Sentry/LogRocket here
};

export const handleApiError = (error, toastId = null) => {
  const message = getUserErrorMessage(error);

  if (toastId) {
    // Update existing loading toast
    import("react-hot-toast").then(({ toast }) => {
      toast.error(message, { id: toastId });
    });
  } else {
    // Create new error toast
    import("react-hot-toast").then(({ toast }) => {
      toast.error(message);
    });
  }

  return message;
};

/* ----------------------------------------------- */
/* ✅ Export Everything */
/* ----------------------------------------------- */
const apiUtils = {
  getErrorMessage,
  getUserErrorMessage,
  isAuthError,
  isNetworkError,
  isRetryableError,
  retryRequest,
  getFullUrl,
  uploadWithProgress,
  saveUserData,
  getUserData,
  clearUserData,
  logError,
  handleApiError,
  // Facebook Pages
  getUserPages: () => axios.get(getFullUrl("/user/pages"), { withCredentials: true }),
  toggleUserPage: (pageId, isSelected) => axios.post(getFullUrl("/user/pages/toggle"), { pageId, isSelected }, { withCredentials: true }),
  updatePageSettings: (pageId, settings) => axios.post(getFullUrl("/user/pages/settings"), { pageId, settings }, { withCredentials: true }),
  disconnectFacebook: () => axios.delete(getFullUrl("/auth/facebook"), { withCredentials: true }), // ✅ Disconnect Facebook
};

export default apiUtils;
