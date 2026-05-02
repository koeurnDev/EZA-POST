import React from "react";
import { useTheme } from "../context/ThemeContext";
import { motion } from "framer-motion";

const AuthLayout = ({ children, title, subtitle }) => {
  const MotionDiv = motion.div;
  const MotionH1 = motion.h1;
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className={`min-h-screen flex flex-col md:flex-row transition-all duration-500 ${theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-800"
        }`}
    >
      {/* 🔹 Left Section - Illustration / Branding */}
      <MotionDiv
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="flex-1 hidden md:flex flex-col justify-center items-center p-12"
      >
        <div className="max-w-sm text-center">
          <MotionH1
            className="text-4xl font-bold mb-3 text-blue-500"
            whileHover={{ scale: 1.05 }}
          >
            EZA_POST 🚀
          </MotionH1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Automate your Facebook posts with ease.
            Schedule TikTok videos, connect pages, and manage content—all in one place.
          </p>
          <div className="mt-8">
            <img
              src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZqOHByOXB4OHB4OHB4OHB4OHB4OHB4OHB4OHB4OHB4OHB4OHB4JnB2PTA/3o7TKDkDbIDJieKbVm/giphy.gif"
              alt="Automate Illustration"
              className="rounded-lg shadow-2xl opacity-80"
            />
          </div>
        </div>
      </MotionDiv>

      {/* 🔹 Right Section - Form Area */}
      <div className="flex-1 flex flex-col justify-center items-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Theme Toggle */}
          <div className="flex justify-end md:absolute md:top-8 md:right-8 mb-6">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:scale-110 transition-transform"
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
          </div>

          <MotionDiv
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={`p-10 rounded-2xl shadow-xl ${theme === "dark" ? "bg-gray-850 border border-gray-700" : "bg-white border border-gray-100"
              }`}
          >
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-black mb-2 tracking-tight">
                {title}
              </h2>
              <p className="text-gray-400 text-sm">
                {subtitle}
              </p>
            </div>

            {children}
          </MotionDiv>

          <footer className="mt-8 text-center text-xs text-gray-500">
            &copy; {new Date().getFullYear()} EZA_POST — All rights reserved.
          </footer>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
