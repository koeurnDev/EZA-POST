// ============================================================
// 🔐 PrivateRoute.jsx — Auth Protected Route for KR_POST
// ============================================================

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth";

/**
 * Protects routes that require authentication.
 *
 * Features:
 * ✅ AuthContext integration
 * ✅ Permission check support
 * ✅ Loading screen while verifying session
 * ✅ Animated transitions
 */

const PrivateRoute = ({
  children,
  redirectPath = "/login",
  requiredPermissions = [],
}) => {
  const location = useLocation();
  const { user, loading } = useAuth(); // from AuthContext

  // ⏳ Show animated loading screen while verifying user
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
        <motion.div
          className="w-12 h-12 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
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

  // 🔐 Optional: Check user permissions
  if (requiredPermissions.length > 0 && !checkPermissions(requiredPermissions)) {
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{
          from: location,
          message: "You do not have permission to view this page",
        }}
      />
    );
  }

  // ✅ Access granted — render the protected content
  return <AnimatePresence mode="wait">{children}</AnimatePresence>;
};

/**
 * 🧠 checkPermissions()
 * Replace this with your actual logic (e.g. roles from AuthContext or JWT)
 */
const checkPermissions = (requiredPermissions) => {
  // Example placeholder:
  // const userPermissions = getUserPermissionsFromContext();
  // return requiredPermissions.every(p => userPermissions.includes(p));
  return true;
};

export default PrivateRoute;
