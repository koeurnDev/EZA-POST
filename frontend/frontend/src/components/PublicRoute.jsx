// ============================================================
// 🌐 PublicRoute.jsx — Final Version (EZA_POST Frontend)
// ============================================================

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { motion } from "framer-motion";

const PublicRoute = ({ children, redirectPath = "/dashboard" }) => {
  const MotionDiv = motion.div;
  const { user, loading } = useAuth();
  const location = useLocation();

  // ⏳ Show a smooth loading animation while checking auth
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
        <MotionDiv
          className="w-12 h-12 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        />
        <p className="mt-4 text-sm font-medium">Loading...</p>
      </div>
    );
  }

  // 🚫 Redirect logged-in users away from login/register pages
  if (user) {
    const from = location.state?.from?.pathname || redirectPath;
    return <Navigate to={from} replace />;
  }

  // ✅ Render public page (Login, Register, Forgot Password, etc.)
  return children;
};

export default PublicRoute;
