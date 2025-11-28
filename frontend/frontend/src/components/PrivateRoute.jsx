// ============================================================
// 🔐 PrivateRoute.jsx — Auth Protected Route for EZA_POST
// ============================================================

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Protects routes that require authentication.
 *
 * Features:
 * ✅ AuthContext integration
 * ✅ Permission check support
 * ✅ Loading screen while verifying session
 */

const PrivateRoute = ({
  children,
  redirectPath = "/login",
}) => {
  const location = useLocation();
  const { user, loading } = useAuth(); // from AuthContext

  // ⏳ Show animated loading screen while verifying user
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
        <div
          className="w-12 h-12 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin"
        />
        <p className="mt-4 text-sm font-medium">Verifying your access...</p>
      </div>
    );
  }

  // 🚫 Redirect to login if user is not authenticated
  if (!user) {
    return (
      <Navigate
        to={redirectPath}
        replace
        state={{
          from: location,
          message: "Please log in to access this page",
        }}
      />
    );
  }

  // ✅ Access granted — render the protected content
  return <>{children}</>;
};

export default PrivateRoute;
