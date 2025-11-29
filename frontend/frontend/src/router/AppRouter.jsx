// ============================================================
// 🌐 AppRouter.jsx - Main Router Configuration for EZA_POST
// ============================================================

import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";

// --- Lazy Loaded Pages ---
const Login = lazy(() => import("../pages/Login"));
const Register = lazy(() => import("../pages/Register"));
const ScheduledPosts = lazy(() => import("../pages/ScheduledPosts"));
const BotSettingsPage = lazy(() => import("../pages/BotSettingsPage"));
const Settings = lazy(() => import("../pages/Settings"));
const PostComposer = lazy(() => import("../pages/PostComposer"));
const Profile = lazy(() => import("../pages/Profile"));
const Welcome = lazy(() => import("../pages/Welcome"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));

// --- Loading Component ---
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

// --- App Router Component ---
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ==================== Public Routes ==================== */}
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Redirect /dashboard to / */}
          <Route path="/dashboard" element={<Navigate to="/" replace />} />

          {/* ==================== Protected Routes ==================== */}
          <Route
            path="/"
            element={
              <ProtectedRoute redirectPath="/welcome">
                <PostComposer />
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
      </Suspense>
    </BrowserRouter>
  );
}
