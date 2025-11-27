// ============================================================
// 🔐 Login.jsx (FINAL PRODUCTION VERSION – With Demo Login)
// ============================================================

import React, { useState, useEffect } from "react";
import LoginForm from "../components/LoginForm";
import LoginButton from "../components/LoginButton";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../utils/api";
import { saveUserData } from "../utils/apiUtils";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  console.log("🚀 Login Page Loaded: v2025-11-28-FIXED");
  const navigate = useNavigate();
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false); // ✅ Added loading state
  const { user, loading: authLoading, setAuthUser } = useAuth();

  // ------------------------------------------------------------
  // ✅ Auto Redirect if User Already Logged In
  // ------------------------------------------------------------
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // ------------------------------------------------------------
  // ✅ Notification Handler
  // ------------------------------------------------------------
  const showNotification = (type, message, duration = 3000) => {
    setNotification({ type, message });
    if (duration) setTimeout(() => setNotification(null), duration);
  };

  // ------------------------------------------------------------
  // ✅ Login Success → Save Session + Redirect
  // ------------------------------------------------------------
  const handleLoginSuccess = (user) => {
    try {
      saveUserData(user);
      setAuthUser(user); // ✅ Update global auth state immediately
      showNotification(
        "success",
        `✅ Welcome back, ${user.name || "User"}! Redirecting...`,
        1000
      );
      setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
    } catch (err) {
      console.error("❌ Login success handler error:", err);
      showNotification("error", "Login session failed to initialize.");
    }
  };

  // ------------------------------------------------------------
  // ✅ Navigation Helpers
  // ------------------------------------------------------------
  const handleSwitchToRegister = () => navigate("/register");
  const handleForgotPassword = () => navigate("/forgot-password");

  // ------------------------------------------------------------
  // ✅ UI Render
  // ------------------------------------------------------------
  return (
    <div className="flex min-h-screen bg-white">
      {/* 🎨 Left Side - Branding & Visuals (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden flex-col justify-between p-12 text-white">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-2xl font-bold tracking-tight">
            <span className="text-4xl">🚀</span> EZA_POST
          </div>
        </div>

        <div className="relative z-10 mb-12">
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Welcome back to <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Your Dashboard
            </span>
          </h1>
          <p className="text-lg text-slate-300 max-w-md leading-relaxed">
            Sign in to continue managing your social media automation workflows and analytics.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-4 text-sm text-slate-400">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-xs">
                👤
              </div>
            ))}
          </div>
          <p>Trusted by 10,000+ creators</p>
        </div>
      </div>

      {/* 📝 Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-gray-50/50">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Header (Visible only on mobile) */}
          <div className="lg:hidden text-center mb-8">
            <span className="text-4xl">🚀</span>
            <h2 className="text-2xl font-bold text-slate-900 mt-4">EZA_POST</h2>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Welcome back
            </h2>
            <p className="mt-2 text-slate-600">
              Please enter your details to sign in.
            </p>
          </div>

          {/* ✅ Notification Message */}
          {notification && (
            <div
              className={`p-4 rounded-lg text-sm font-medium flex items-center gap-3 ${notification.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : notification.type === "info"
                  ? "bg-blue-50 text-blue-700 border border-blue-100"
                  : "bg-red-50 text-red-700 border border-red-100"
                }`}
            >
              <span>{notification.type === "success" ? "✅" : notification.type === "info" ? "ℹ️" : "⚠️"}</span>
              {notification.message}
            </div>
          )}

          {/* ✅ Login Form */}
          <LoginForm
            onSuccess={handleLoginSuccess}
            onSwitchToRegister={handleSwitchToRegister}
            onForgotPassword={handleForgotPassword}
          />

          {/* 🔹 Facebook Login */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-slate-500">Or continue with</span>
              </div>
            </div>
            <div className="mt-6">
              <LoginButton onFacebookLogin={authAPI.facebookLogin} />
            </div>
          </div>

          {/* ✅ Footer */}
          <div className="text-center lg:text-left mt-6">
            <p className="text-sm text-slate-600">
              Don't have an account?{" "}
              <button
                onClick={handleSwitchToRegister}
                className="font-semibold text-blue-600 hover:text-blue-500 hover:underline transition-colors"
              >
                Sign up for free
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
