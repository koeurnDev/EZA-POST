// ============================================================
// 🌐 NetworkStatus.jsx — Tailwind + Framer Motion Version
// ============================================================

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NetworkStatus = ({
  showOfflineAlert = true,
  autoCheckInterval = 30000, // 30s
  onStatusChange,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(new Date());
  const [retryCount, setRetryCount] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  // ✅ Check endpoints
  const checkNetworkStatus = useCallback(async () => {
    if (isChecking) return;
    setIsChecking(true);
    setLastChecked(new Date());

    try {
      const endpoints = [
        "/api/health",
        "https://www.google.com/favicon.ico",
        "/favicon.ico",
      ];

      let success = false;
      for (const endpoint of endpoints) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(endpoint, {
            method: "HEAD",
            cache: "no-store",
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (res.ok) {
            success = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (success) {
        setIsOnline(true);
        setRetryCount(0);
        onStatusChange?.(true);
      } else throw new Error("All endpoints failed");
    } catch {
      setIsOnline(false);
      setRetryCount((p) => p + 1);
      onStatusChange?.(false);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, onStatusChange]);

  // 🌐 Browser events
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      setRetryCount(0);
      setTimeout(checkNetworkStatus, 1000);
      onStatusChange?.(true);
    };
    const goOffline = () => {
      setIsOnline(false);
      onStatusChange?.(false);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [checkNetworkStatus, onStatusChange]);

  // 🔁 Auto-check interval
  useEffect(() => {
    if (autoCheckInterval <= 0) return;
    const id = setInterval(() => !isChecking && checkNetworkStatus(), autoCheckInterval);
    return () => clearInterval(id);
  }, [autoCheckInterval, isChecking, checkNetworkStatus]);

  // 🧩 Connection quality
  const connectionQuality =
    !isOnline ? "offline" : retryCount > 2 ? "poor" : retryCount > 0 ? "fair" : "good";

  // 🕒 Tooltip info
  const formatLastChecked = () => {
    const diff = (new Date() - lastChecked) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  // 🎨 Color & Text Map
  const colorMap = {
    good: "bg-emerald-500",
    fair: "bg-yellow-400 animate-pulse",
    poor: "bg-amber-500 animate-pulse",
    offline: "bg-red-500",
  };
  const textMap = {
    good: "Online",
    fair: "Unstable",
    poor: "Poor Connection",
    offline: "Offline",
  };

  return (
    <>
      {/* 🌐 Status Indicator */}
      {/* If inline, we render a simple dot/badge without fixed positioning */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        onClick={checkNetworkStatus}
        title={`Connection: ${connectionQuality.toUpperCase()} (Click to refresh)`}
      >
        <span
          className={`w-2 h-2 rounded-full ${colorMap[connectionQuality]}`}
        />
        <span className="hidden sm:inline">
          {isChecking ? "Checking..." : textMap[connectionQuality]}
        </span>
      </div>

      {/* ⚠️ Offline Banner (Global Fixed) */}
      <AnimatePresence>
        {showOfflineAlert && !isOnline && !isChecking && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed top-0 left-0 w-full text-center font-semibold text-white py-3 bg-red-600 shadow-lg flex justify-center items-center gap-3 z-[1000]"
          >
            ⚠️ You’re offline. Some features may not work.
            <button
              onClick={checkNetworkStatus}
              disabled={isChecking}
              className="ml-2 bg-white/20 hover:bg-white/30 text-sm px-3 py-1 rounded-md"
            >
              {isChecking ? "..." : "Retry"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ✅ Connection Restored Banner */}
      <AnimatePresence>
        {showOfflineAlert && isOnline && retryCount > 0 && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed top-0 left-0 w-full text-center font-semibold text-white py-3 bg-emerald-600 shadow-md z-[1000]"
          >
            ✅ Connection Restored!
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default NetworkStatus;
