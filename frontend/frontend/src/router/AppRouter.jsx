// ============================================================
// 🌐 AppRouter.jsx - Main Router Configuration for EZA_POST
// ============================================================

import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";

// --- Lazy Loaded Pages ---
// const Dashboard = lazy(() => import("../pages/Dashboard"));
const Login = lazy(() => import("../pages/Login"));
const Register = lazy(() => import("../pages/Register"));
const ScheduledPosts = lazy(() => import("../pages/ScheduledPosts"));
const BotSettingsPage = lazy(() => import("../pages/BotSettingsPage"));
const Settings = lazy(() => import("../pages/Settings"));
const Post = lazy(() => import("../pages/Post"));

const TikTokDownloader = lazy(() => import("../pages/Tools/TikTokDownloader"));
const PinterestDownloader = lazy(() => import("../pages/Tools/PinterestDownloader"));
const YoutubeDownloader = lazy(() => import("../pages/Tools/YoutubeDownloader"));
const FacebookDownloader = lazy(() => import("../pages/Tools/FacebookDownloader")); // ✅ New
const InstagramDownloader = lazy(() => import("../pages/Tools/InstagramDownloader")); // ✅ New
const ThreadsDownloader = lazy(() => import("../pages/Tools/ThreadsDownloader")); // ✅ New
const CapCutDownloader = lazy(() => import("../pages/Tools/CapCutDownloader")); // ✅ New
const DocumentConverter = lazy(() => import("../pages/Tools/DocumentConverter")); // ✅ New
const TikTokTrends = lazy(() => import("../pages/Tools/TikTokTrends")); // ✅ New
const ViralFinder = lazy(() => import("../pages/Tools/ViralFinder")); // ✅ New
const Connections = lazy(() => import("../pages/Connections"));

const ViralPosts = lazy(() => import("../pages/ViralPosts")); // ✅ Boost Feature
const BuyCredits = lazy(() => import("../pages/BuyCredits"));
const Guide = lazy(() => import("../pages/Guide"));

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
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ==================== Public Routes ==================== */}
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Redirect /dashboard to /post */}
          <Route path="/dashboard" element={<Navigate to="/post" replace />} />
          <Route path="/" element={<Navigate to="/post" replace />} />

          {/* ==================== Protected Routes ==================== */}
          <Route
            path="/post"
            element={
              <ProtectedRoute redirectPath="/welcome">
                <Post />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tools/tiktok"
            element={
              <ProtectedRoute>
                <TikTokDownloader />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/tiktok/trends"
            element={
              <ProtectedRoute>
                <TikTokTrends />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/viral-finder"
            element={
              <ProtectedRoute>
                <ViralFinder />
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
            path="/tools/pinterest"
            element={
              <ProtectedRoute>
                <PinterestDownloader />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/youtube"
            element={
              <ProtectedRoute>
                <YoutubeDownloader />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/facebook"
            element={
              <ProtectedRoute>
                <FacebookDownloader />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/instagram"
            element={
              <ProtectedRoute>
                <InstagramDownloader />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/threads"
            element={
              <ProtectedRoute>
                <ThreadsDownloader />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/capcut"
            element={
              <ProtectedRoute>
                <CapCutDownloader />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tools/document-converter"
            element={
              <ProtectedRoute>
                <DocumentConverter />
              </ProtectedRoute>
            }
          />

          <Route
            path="/connections"
            element={
              <ProtectedRoute>
                <Connections />
              </ProtectedRoute>
            }
          />
          <Route
            path="/buy-credits"
            element={
              <ProtectedRoute>
                <BuyCredits />
              </ProtectedRoute>
            }
          />

          <Route
            path="/viral-posts"
            element={
              <ProtectedRoute>
                <ViralPosts />
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

          <Route
            path="/guide"
            element={
              <ProtectedRoute>
                <Guide />
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
                  fontFamily: '"Kantumruy Pro", sans-serif',
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
