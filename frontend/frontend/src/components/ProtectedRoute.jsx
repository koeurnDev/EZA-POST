// ============================================================
// 🔐 ProtectedRoute.jsx — Final Version (EZA_POST Frontend)
// ============================================================

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";

/**
 * Restricts access to authenticated users only.
 * - Uses AuthContext automatically
 * - Shows animated loading screen
 * - Redirects unauthenticated users to /login
 */

const ProtectedRoute = ({ children, redirectPath = "/login" }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // ⏳ Animated loading while checking authentication
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
        <motion.div
          className="w-12 h-12 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        />
        <p className="mt-4 text-sm font-medium">Checking authentication...</p>
      </div>
    );
  }

  // 🚫 Redirect if user not authenticated
  if (!user) {
    return (
      <Navigate
        to={redirectPath}
        replace
        state={{ from: location, message: "Please log in to continue" }}
      />
    );
  }

  // ✅ Authenticated → render child component
  return children;
};

export default ProtectedRoute;
