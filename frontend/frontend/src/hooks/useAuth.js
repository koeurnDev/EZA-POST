// ============================================================
// 🔐 useAuth.js — Custom Hook for Authentication Management
// ============================================================

import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

/**
 * ✅ useAuth()
 * Provides easy access to authentication data and actions.
 *
 * Usage:
 *   const { user, isAuthenticated, login, logout, register } = useAuth();
 *
 * Returns:
 *   - user: Current authenticated user object or null
 *   - isAuthenticated: Boolean (true if logged in)
 *   - loading: Boolean (true while checking login state)
 *   - login(email, password): Login function
 *   - register(email, password): Register new user
 *   - logout(): Logout function
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("❌ useAuth() must be used within an <AuthProvider>");
  }

  return context;
};

export default useAuth;
