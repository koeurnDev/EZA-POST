// ============================================================
// 🌐 AppRouter.jsx - Main Router Configuration for EZA_POST
// ============================================================

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// --- Pages ---
import Login from "../pages/Login";
import Register from "../pages/Register";
import Overview from "../pages/Overview";
import ScheduledPosts from "../pages/ScheduledPosts";
import BotSettingsPage from "../pages/BotSettingsPage";
import Settings from "../pages/Settings";
import Settings from "../pages/Settings";
import Profile from "../pages/Profile";
import Welcome from "../pages/Welcome"; // 🚀 New Welcome Page

// --- Components ---
import ForgotPassword from "../pages/ForgotPassword";
import ResetPassword from "../pages/ResetPassword";

// --- Components ---
import ProtectedRoute from "../components/ProtectedRoute";

// --- App Router Component ---
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ==================== Public Routes ==================== */}
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ==================== Protected Routes ==================== */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Overview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/posts"
          element={
            <ProtectedRoute>
              <ScheduledPosts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bot"
          element={
            <ProtectedRoute>
              <BotSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* ==================== Fallback Route ==================== */}
        <Route
          path="*"
          element={
            <div
              style={{
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "system-ui",
                color: "#475569",
              }}
            >
              <h1 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>
                404 - Page Not Found 😢
              </h1>
              <a
                href="/"
                style={{
                  color: "#3b82f6",
                  textDecoration: "underline",
                  fontWeight: 600,
                }}
              >
                Go back to Home
              </a>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
