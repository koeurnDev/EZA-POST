// ============================================================
// 🌐 useAxios.js — Axios Hook with Token Interceptors
// ============================================================

import { useEffect } from "react";
import axios from "axios";
import useAuth from "./useAuth";

// ✅ Base API configuration
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true, // allow sending cookies if backend uses sessions
  headers: { "Content-Type": "application/json" },
});

/**
 * ✅ useAxios()
 * Automatically attaches JWT token to requests
 * and handles unauthorized (401) responses globally.
 */
const useAxios = () => {
  const { user, logout } = useAuth();

  useEffect(() => {
    // 🧩 Request Interceptor → attach token
    const requestInterceptor = axiosInstance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("eza_post_token");
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 🚨 Response Interceptor → handle expired tokens or errors
    const responseInterceptor = axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // 401 → Token expired or unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            // Attempt token refresh (if backend supports it)
            const refreshResponse = await axiosInstance.post("/auth/refresh-token");
            const newToken = refreshResponse.data?.token;

            if (newToken) {
              localStorage.setItem("eza_post_token", newToken);
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return axiosInstance(originalRequest); // Retry with new token
            }
          } catch (refreshError) {
            console.warn("⚠️ Token refresh failed:", refreshError.message);
            logout?.(); // Logout user if refresh fails
          }
        }

        // Handle network or server errors gracefully
        if (!error.response) {
          console.error("❌ Network error: Please check your connection.");
        } else {
          console.error(
            `❌ API Error [${error.response.status}]: ${error.response.data?.message || "Unknown error"}`
          );
        }

        return Promise.reject(error);
      }
    );

    // 🧹 Cleanup interceptors on unmount
    return () => {
      axiosInstance.interceptors.request.eject(requestInterceptor);
      axiosInstance.interceptors.response.eject(responseInterceptor);
    };
  }, [logout, user]);

  return axiosInstance;
};

export default useAxios;
