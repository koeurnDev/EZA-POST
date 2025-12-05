// ============================================================
// 🌐 src/utils/api.js — FINAL PRODUCTION VERSION (KR_POST)
// ============================================================

import axios from "axios";
import { getUserData, saveUserData, clearUserData, fetchCsrfToken } from "./apiUtils";

/* -------------------------------------------------------------------------- */
/* ✅ Default Constants                                                       */
/* -------------------------------------------------------------------------- */
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || "/api",
  TIMEOUT: 15000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export const API_ERRORS = {
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT_ERROR: "TIMEOUT_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  SERVER_ERROR: "SERVER_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
};

/* -------------------------------------------------------------------------- */
/* ✅ API Endpoints                                                           */
/* -------------------------------------------------------------------------- */
export const API_ENDPOINTS = {
  AUTH: {
    STATUS: "/auth/status",
    LOGIN: "/auth/login",
    LOGOUT: "/auth/logout",
    REGISTER: "/auth/register",
    FORGOT_PASSWORD: "/auth/forgot-password",
    RESET_PASSWORD: "/auth/reset-password",
    DEMO: "/auth/demo", // ✅ Added for demo login
  },
  SYSTEM: { HEALTH: "/system/health" },
  USER: { PAGES: "/user/pages" },
  POSTS: {
    CREATE: "/posts/create",
    SCHEDULE: "/posts/schedule",
    QUEUE: "/posts/queue",
    CANCEL: "/posts/cancel",
  },
  TIKTOK: {
    VALIDATE: "/tiktok/validate",
    INFO: "/tiktok/info",
  },
  BOT: {
    RULES: "/bot/rules",
    SETTINGS: "/bot/settings",
  },
};

/* -------------------------------------------------------------------------- */
/* ✅ Axios Instance                                                          */
/* -------------------------------------------------------------------------- */
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  withCredentials: true,
});

/* -------------------------------------------------------------------------- */
/* ✅ Request Interceptor                                                     */
/* -------------------------------------------------------------------------- */
api.interceptors.request.use(
  async (config) => {
    // 🛡️ Attach CSRF Token for state-changing methods
    if (['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase())) {
      const token = await fetchCsrfToken();
      if (token) config.headers['X-CSRF-Token'] = token;
    }

    if (import.meta.env.DEV && !config.url?.includes("/auth/status")) {
      console.log(`🔄 [${config.method?.toUpperCase()}] ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error("❌ API Request Error:", error);
    return Promise.reject({
      code: API_ERRORS.NETWORK_ERROR,
      message: getErrorMessage(API_ERRORS.NETWORK_ERROR),
      originalError: error,
    });
  }
);

/* -------------------------------------------------------------------------- */
/* ✅ Response Interceptor                                                    */
/* -------------------------------------------------------------------------- */
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV && !response.config.url?.includes("/auth/status")) {
      console.log(`✅ Success: ${response.config.url}`);
    }
    return response;
  },
  (error) => {
    const url = error.config?.url;
    const status = error.response?.status;
    const data = error.response?.data;

    // 1️⃣ Determine Error Code
    let code = data?.code;
    if (!code) {
      if (status === 400) code = API_ERRORS.VALIDATION_ERROR;
      else if (status === 401) code = API_ERRORS.UNAUTHORIZED;
      else if (status === 403) code = API_ERRORS.FORBIDDEN;
      else if (status === 404) code = API_ERRORS.NOT_FOUND;
      else if (status === 500) code = API_ERRORS.SERVER_ERROR;
      else if (status === 503) code = API_ERRORS.SERVICE_UNAVAILABLE;
      else code = API_ERRORS.NETWORK_ERROR;
    }

    // 2️⃣ Special Handling for Auth Status Check
    if (status === HTTP_STATUS.UNAUTHORIZED && url?.includes("/auth/status")) {
      return Promise.reject({
        code: API_ERRORS.UNAUTHORIZED,
        message: getErrorMessage(API_ERRORS.UNAUTHORIZED),
        details: data,
        originalError: error,
      });
    }

    // 3️⃣ Log Error (except auth checks)
    if (status !== HTTP_STATUS.UNAUTHORIZED || !url?.includes("/auth/status")) {
      console.error("❌ API Response Error:", {
        url,
        status,
        code,
        message: data?.error || error.message,
        fullError: data, // ✅ Log full error object for debugging
      });
    }

    // 4️⃣ Clear Session on 401
    if (status === HTTP_STATUS.UNAUTHORIZED) {
      localStorage.removeItem("kr_post_user");
    }

    // 5️⃣ Construct Error Object
    // Prefer backend error message if available
    const message = data?.error || data?.message || getErrorMessage(code);

    return Promise.reject({
      code,
      message,
      details: data,
      response: error.response, // ✅ Pass original response for components that check it
      originalError: error,
    });
  }
);

/* -------------------------------------------------------------------------- */
/* ✅ Utility Functions                                                       */
/* -------------------------------------------------------------------------- */
const isAuthError = (error) =>
  error?.code === API_ERRORS.UNAUTHORIZED ||
  error?.response?.status === HTTP_STATUS.UNAUTHORIZED;

const isNetworkError = (error) => !error?.response && error?.request;

const isRetryableError = (code) =>
  [
    API_ERRORS.NETWORK_ERROR,
    API_ERRORS.TIMEOUT_ERROR,
    API_ERRORS.SERVER_ERROR,
    API_ERRORS.SERVICE_UNAVAILABLE,
  ].includes(code);

const getErrorMessage = (code) => {
  const messages = {
    [API_ERRORS.NETWORK_ERROR]:
      "Network error. Please check your internet connection.",
    [API_ERRORS.TIMEOUT_ERROR]: "Request timeout. Please try again.",
    [API_ERRORS.UNAUTHORIZED]: "Please log in to continue.",
    [API_ERRORS.FORBIDDEN]:
      "You do not have permission to access this resource.",
    [API_ERRORS.NOT_FOUND]: "The requested resource was not found.",
    [API_ERRORS.SERVER_ERROR]: "Server error. Please try again later.",
    [API_ERRORS.SERVICE_UNAVAILABLE]:
      "Service temporarily unavailable. Please try again later.",
    [API_ERRORS.VALIDATION_ERROR]: "Please check your input and try again.",
    [API_ERRORS.RATE_LIMITED]: "Too many requests. Please wait and try again.",
    USER_EXISTS: "User already exists with this email.",
    INVALID_CREDENTIALS: "Invalid email or password.",
    PASSWORD_TOO_SHORT: "Password must be at least 6 characters.",
    INVALID_TIKTOK_URL: "Please enter a valid TikTok URL.",
    VIDEO_TOO_LONG: "Video is too long to process.",
    VIDEO_UNAVAILABLE: "TikTok video unavailable or private.",
    FACEBOOK_API_ERROR: "Facebook API error. Please try again.",
    QUOTA_EXCEEDED: "Daily posting limit reached. Try again tomorrow.",
  };
  return messages[code] || "An unexpected error occurred.";
};

const getUserErrorMessage = (error) => {
  if (isAuthError(error)) return getErrorMessage(API_ERRORS.UNAUTHORIZED);
  if (isNetworkError(error)) return getErrorMessage(API_ERRORS.NETWORK_ERROR);
  if (error.code && getErrorMessage(error.code)) {
    return getErrorMessage(error.code);
  }
  return error.message || "An unexpected error occurred.";
};

const getFullUrl = (endpoint) => `${API_CONFIG.BASE_URL}${endpoint}`;

/* -------------------------------------------------------------------------- */
/* ✅ API Utilities                                                           */
/* -------------------------------------------------------------------------- */
const apiUtils = {
  isAuthError,
  isNetworkError,
  isRetryableError,
  getErrorMessage,
  getUserErrorMessage,
  getFullUrl,
  getUserData,
  saveUserData,
  clearUserData,

  retry: async (fn, retries = API_CONFIG.RETRY_ATTEMPTS, delay = API_CONFIG.RETRY_DELAY) => {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0 || isAuthError(error) || !isRetryableError(error.code)) {
        throw error;
      }
      await new Promise((res) => setTimeout(res, delay));
      return apiUtils.retry(fn, retries - 1, delay * 2);
    }
  },

  uploadWithProgress: (url, formData, onProgress) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress?.((e.loaded / e.total) * 100);
      });
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(xhr.responseText);
          }
        } else reject(new Error(`Upload failed: ${xhr.statusText}`));
      });
      xhr.addEventListener("error", () =>
        reject(new Error("Upload failed due to network error"))
      );
      xhr.open("POST", getFullUrl(url));
      xhr.withCredentials = true; // Important for cookies
      xhr.send(formData);
    }),
};

/* -------------------------------------------------------------------------- */
/* ✅ API Service Modules                                                     */
/* -------------------------------------------------------------------------- */

// Authentication
const authAPI = {
  checkStatus: async () => {
    try {
      const res = await api.get(API_ENDPOINTS.AUTH.STATUS);
      return res.data;
    } catch (err) {
      if (err.code === API_ERRORS.UNAUTHORIZED)
        return { authenticated: false, user: null };
      throw err;
    }
  },
  facebookLogin: () => (window.location.href = `${API_CONFIG.BASE_URL}/auth/facebook`),
  mockLogin: () => (window.location.href = "/auth/facebook/mock"),
  register: async (data) =>
    (await api.post(API_ENDPOINTS.AUTH.REGISTER, data)).data,
  login: async (data) => (await api.post(API_ENDPOINTS.AUTH.LOGIN, data)).data,
  verify2FALogin: async (tempToken, code) => (await api.post(`${API_ENDPOINTS.AUTH.LOGIN}/2fa`, { tempToken, code })).data,
  demoLogin: async () => (await api.post(API_ENDPOINTS.AUTH.DEMO)).data,
  forgotPassword: async (email) =>
    (await api.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email })).data,
  resetPassword: async (data) =>
    (await api.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, data)).data,
  logout: async () => {
    try {
      const res = await api.post(API_ENDPOINTS.AUTH.LOGOUT);
      // Clear local storage on logout
      localStorage.removeItem("eza_post_user");
      localStorage.removeItem("eza_post_token");
      return res.data;
    } catch (err) {
      // Even if server fails, clear local state
      localStorage.removeItem("eza_post_user");
      localStorage.removeItem("eza_post_token");
      throw err;
    }
  },
  updateProfile: async (data) =>
    (await api.put("/user/update", data)).data,
  uploadCover: async (file) => {
    const formData = new FormData();
    formData.append("cover", file);
    return (await api.post("/upload/cover", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })).data;
  },
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append("avatar", file);
    return (await api.post("/upload/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })).data;
  },
  getStats: async () => (await api.get("/user/stats")).data,
};

// System
const systemAPI = {
  health: async () => {
    try {
      return (await api.get(API_ENDPOINTS.SYSTEM.HEALTH)).data;
    } catch (err) {
      throw {
        code: API_ERRORS.SERVER_ERROR,
        message: getErrorMessage(API_ERRORS.SERVER_ERROR),
        originalError: err,
      };
    }
  },
};

// Facebook Pages
const pagesAPI = {
  getAccounts: async () => (await api.get(API_ENDPOINTS.USER.PAGES)).data,
  refreshAccounts: async () =>
    (
      await api.get(API_ENDPOINTS.USER.PAGES, {
        params: { refresh: true, _t: Date.now() },
      })
    ).data,
};

// Posts
const postsAPI = {
  schedule: async (postData) => {
    const formData = new FormData();
    formData.append("videoUrl", postData.videoUrl);
    formData.append("caption", postData.caption);
    formData.append("accounts", JSON.stringify(postData.accounts));
    if (postData.scheduleTime)
      formData.append("scheduleTime", postData.scheduleTime);
    if (postData.thumbnailFile)
      formData.append("thumbnail", postData.thumbnailFile);

    const res = await api.post(API_ENDPOINTS.POSTS.SCHEDULE, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 45000,
    });
    return res.data;
  },
  create: async (postData) => {
    const formData = new FormData();
    formData.append("videoUrl", postData.videoUrl);
    formData.append("caption", postData.caption);
    formData.append("accounts", JSON.stringify(postData.accounts));
    if (postData.thumbnailFile)
      formData.append("thumbnail", postData.thumbnailFile);

    const res = await api.post(API_ENDPOINTS.POSTS.CREATE, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    });
    return res.data;
  },
  getQueue: async () => (await api.get(API_ENDPOINTS.POSTS.QUEUE)).data,
  cancel: async (id) =>
    (await api.delete(`${API_ENDPOINTS.POSTS.CANCEL}/${id}`)).data,
};

// TikTok
const tiktokAPI = {
  validateUrl: async (url) =>
    (await api.post(API_ENDPOINTS.TIKTOK.VALIDATE, { url })).data,
  getVideoInfo: async (url) =>
    (await api.get(API_ENDPOINTS.TIKTOK.INFO, { params: { url } })).data,
};

// Bot
const botAPI = {
  saveRules: async (rules) =>
    (await api.post(API_ENDPOINTS.BOT.RULES, { rules })).data,
  getRules: async () => (await api.get(API_ENDPOINTS.BOT.RULES)).data,
  updateSettings: async (settings) =>
    (await api.put(API_ENDPOINTS.BOT.SETTINGS, settings)).data,
};

/* -------------------------------------------------------------------------- */
/* ✅ Exports                                                                 */
/* -------------------------------------------------------------------------- */
export default api;
export { authAPI, systemAPI, pagesAPI, postsAPI, tiktokAPI, botAPI, apiUtils };
