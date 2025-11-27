// ============================================================
// ⚙️ apiConstants.js — Centralized API Configuration & Constants
// ============================================================

// ✅ API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || "/api",
  TIMEOUT: 15000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// ✅ HTTP Status Codes
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

// ✅ Error Code Map
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

// ✅ API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    STATUS: "/auth/status",
    LOGIN: "/auth/login",
    LOGOUT: "/auth/logout",
    REGISTER: "/auth/register",
    FORGOT_PASSWORD: "/auth/forgot",
    RESET_PASSWORD: "/auth/reset",
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

// ✅ Reusable Utility Functions
export const API_UTILS = {
  // Full URL builder
  getFullUrl: (endpoint) => `${API_CONFIG.BASE_URL}${endpoint}`,

  // Identify auth-related errors
  isAuthError: (code) =>
    code === API_ERRORS.UNAUTHORIZED ||
    code === HTTP_STATUS.UNAUTHORIZED,

  // Identify retryable errors
  isRetryableError: (code) =>
    [
      API_ERRORS.NETWORK_ERROR,
      API_ERRORS.TIMEOUT_ERROR,
      API_ERRORS.SERVER_ERROR,
      API_ERRORS.SERVICE_UNAVAILABLE,
    ].includes(code),

  // User-friendly error message map
  getErrorMessage: (code) => {
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
      [API_ERRORS.VALIDATION_ERROR]:
        "Please check your input and try again.",
      [API_ERRORS.RATE_LIMITED]:
        "Too many requests. Please wait and try again.",
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
  },
};
