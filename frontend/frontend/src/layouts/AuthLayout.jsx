import React from "react";
import { useTheme } from "../context/ThemeContext";
import { motion } from "framer-motion"; // eslint-disable-line no-unused-vars

const AuthLayout = ({ children, title, subtitle }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className={`min-h-screen flex flex-col md:flex-row transition-all duration-500 ${theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-800"
        }`}
    >
      {/* 🔹 Left Section - Illustration / Branding */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="flex-1 hidden md:flex flex-col justify-center items-center p-12"
      >
        <div className="max-w-sm text-center">
          <motion.h1
            className="text-4xl font-bold mb-3 text-blue-500"
            whileHover={{ scale: 1.05 }}
          >
            EZA_POST 🚀
          </motion.h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Automate your Facebook posts with ease.
            Schedule TikTok videos, connect pages, and manage content—all in one place.
          </p>
          <div className="mt-8">
            <img
              src="/illustrations/auth.svg"
              alt="Auth illustration"
              className="w-full max-w-xs mx-auto opacity-90"
            />
          </div>
        </div>
      </motion.div>

      {/* 🔹 Right Section - Auth Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`flex-1 flex flex-col justify-center items-center p-6 sm:p-10`}
      >
        <div
          className={`w-full max-w-md rounded-2xl shadow-lg border ${theme === "dark"
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
            } p-8`}
        >
          {/* Header */}
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold">{title}</h2>
            {subtitle && (
              <p className="text-sm mt-2 text-gray-500 dark:text-gray-400">
                {subtitle}
              </p>
            )}
          </div>

          {/* Auth Form (children) */}
          <div className="mb-4">{children}</div>

          {/* Theme Toggle */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={toggleTheme}
              className="text-xs px-4 py-2 rounded-md border border-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              {theme === "dark" ? "🌞 Switch to Light Mode" : "🌙 Switch to Dark Mode"}
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} EZA_POST — All rights reserved.
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthLayout;
