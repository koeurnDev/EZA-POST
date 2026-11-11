// ============================================================
// 🔐 ProtectedRoute.jsx — Final Version (EZA_POST Frontend)
// ============================================================

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const ProtectedRoute = ({ children, redirectPath = "/login" }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#090d16] text-slate-300 gap-3">
        <div className="w-9 h-9 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-xs font-medium opacity-75">កំពុងផ្ទៀងផ្ទាត់គណនី...</p>
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
