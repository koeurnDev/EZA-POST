// ============================================================
// 🔐 AuthContext.jsx — Final Optimized for EZA_POST Frontend
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI } from "../utils/api";
import { getUserData, saveUserData, clearUserData } from "../utils/apiUtils";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  console.log("🔐 AuthProvider Loaded: v2025-11-28-FIXED");
  const [user, setUser] = useState(() => {
    try {
      return getUserData();
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // ------------------------------------------------------------
  // ✅ Check session on app load
  // ------------------------------------------------------------
  const checkAuthStatus = useCallback(async () => {
    try {
      // Check if we have a demo user in localStorage - if so, use it directly
      const savedUser = getUserData();
      const isDemo = localStorage.getItem("isDemo") === "true";

      if (isDemo && savedUser) {
        // For demo users, trust localStorage and skip backend check
        try {
          setUser(savedUser);
          setLoading(false);
          return;
        } catch (e) {
          console.error("Failed to parse saved user:", e);
        }
      }

      // For regular users, check with backend
      const data = await authAPI.checkStatus();
      if (data?.authenticated && data.user) {
        setUser(data.user);
        saveUserData(data.user);
      } else {
        // ✅ Backend says NOT authenticated -> Clear everything
        setUser(null);
        clearUserData();
      }
    } catch {
      // On error (e.g. network error), keep the localStorage user if it exists
      // BUT if it's a 401, the interceptor will handle it.
      // For other errors, we might want to be careful not to log them out aggressively
      // unless we are sure.
      const savedUser = getUserData();
      if (!savedUser) {
        setUser(null);
        clearUserData();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // ------------------------------------------------------------
  // ✅ Login
  // ------------------------------------------------------------
  const login = async (email, password) => {
    try {
      const data = await authAPI.login({ email, password });
      if (data?.user) {
        setUser(data.user);
        saveUserData(data.user);
      }
      return data.user;
    } catch (err) {
      throw err;
    }
  };

  // ------------------------------------------------------------
  // ✅ Register
  // ------------------------------------------------------------
  const register = async (name, email, password) => {
    try {
      const data = await authAPI.register({ name, email, password });
      if (data?.user) {
        setUser(data.user);
        saveUserData(data.user);
      }
      return data.user;
    } catch (err) {
      throw err;
    }
  };

  // ------------------------------------------------------------
  // ✅ Demo Login
  // ------------------------------------------------------------
  const demoLogin = async () => {
    try {
      const data = await authAPI.demoLogin();
      if (data?.user) {
        setUser(data.user);
        saveUserData(data.user);
        // Also set isDemo flag in localStorage for Dashboard
        localStorage.setItem("isDemo", "true");
      }
      return data;
    } catch (err) {
      throw err;
    }
  };

  // ------------------------------------------------------------
  // ✅ Logout
  // ------------------------------------------------------------
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch { }
    setUser(null);
    clearUserData();
  };

  // ✅ Update User Profile
  const updateUser = async (data) => {
    try {
      const res = await authAPI.updateProfile(data);
      if (res.success) {
        setUser(res.user); // Update state
        saveUserData(res.user);
        return { success: true, message: res.message };
      }
    } catch (err) {
      return { success: false, message: err.message || "Failed to update profile" };
    }
  };

  // ------------------------------------------------------------
  // ✅ Context Value
  // ------------------------------------------------------------
  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    demoLogin,
    logout,
    updateUser, // ✅ Exposed
    refreshAuth: checkAuthStatus,
    setAuthUser: setUser,
  };

  // ------------------------------------------------------------
  // ✅ Render Provider
  // ------------------------------------------------------------
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// ✅ Custom Hook
export const useAuth = () => useContext(AuthContext);
