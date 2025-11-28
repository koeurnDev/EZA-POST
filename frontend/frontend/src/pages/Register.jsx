// ============================================================
// 📝 Register.jsx (FINAL VERSION – Clean Split Layout)
// ============================================================

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion"; // eslint-disable-line no-unused-vars

import { useNavigate } from "react-router-dom";
// Removed unused authAPI import
import { getUserData } from "../utils/apiUtils";
import RegisterForm from "../components/RegisterForm";
// Removed unused LoginButton import

export default function Register() {
  const navigate = useNavigate();
  const [notification, setNotification] = useState({ type: "", message: "" });

  // ------------------------------------------------------------
  // ✅ Redirect to dashboard if already logged in
  // ------------------------------------------------------------
  useEffect(() => {
    const user = getUserData();
    if (user) navigate("/dashboard", { replace: true });
  }, [navigate]);

  // ------------------------------------------------------------
  // ✅ Show notification (success/error)
  // ------------------------------------------------------------
  const showNotification = (type, message, duration = 3000) => {
    setNotification({ type, message });
    if (duration) setTimeout(() => setNotification({ type: "", message: "" }), duration);
  };

  // ------------------------------------------------------------
  // ✅ Success Handler
  // ------------------------------------------------------------
  const handleRegisterSuccess = () => {
    showNotification("success", "✅ Registration successful! Redirecting...");
    setTimeout(() => navigate("/login", { replace: true }), 1500);
  };

  // ------------------------------------------------------------
  // ✅ UI
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
            Automate your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Social Workflow
            </span>
          </h1>
          <p className="text-lg text-slate-300 max-w-md leading-relaxed">
            Join thousands of creators who use EZA_POST to schedule, manage, and analyze their content across all platforms effortlessly.
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
              Create an account
            </h2>
            <p className="mt-2 text-slate-600">
              Start your 14-day free trial. No credit card required.
            </p>
          </div>

          {/* ✅ Notifications */}
          {notification.message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg text-sm font-medium flex items-center gap-3 ${notification.type === "error"
                ? "bg-red-50 text-red-700 border border-red-100"
                : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                }`}
            >
              <span>{notification.type === "error" ? "⚠️" : "✅"}</span>
              {notification.message}
            </motion.div>
          )}

          {/* ✅ Form */}
          <RegisterForm
            onSuccess={handleRegisterSuccess}
            onSwitchToLogin={() => navigate("/login")}
          />



          {/* ✅ Switch to Login */}
          <div className="text-center lg:text-left mt-6">
            <p className="text-sm text-slate-600">
              Already have an account?{" "}
              <button
                onClick={() => navigate("/login")}
                className="font-semibold text-blue-600 hover:text-blue-500 hover:underline transition-colors"
              >
                Log in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
