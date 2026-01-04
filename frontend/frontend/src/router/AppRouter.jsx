// ============================================================
// 🌐 AppRouter.jsx - Main Router Configuration for EZA_POST
// ============================================================

import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";

// --- Lazy Loaded Pages ---
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Login = lazy(() => import("../pages/Login"));
const Register = lazy(() => import("../pages/Register"));
const ScheduledPosts = lazy(() => import("../pages/ScheduledPosts"));
const BotSettingsPage = lazy(() => import("../pages/BotSettingsPage"));
const Settings = lazy(() => import("../pages/Settings"));
const Post = lazy(() => import("../pages/Post"));
const BulkPost = lazy(() => import("../pages/BulkPost"));
const TikTokDownloader = lazy(() => import("../pages/Tools/TikTokDownloader"));
const PinterestDownloader = lazy(() => import("../pages/Tools/PinterestDownloader"));
const YoutubeDownloader = lazy(() => import("../pages/Tools/YoutubeDownloader"));
const FacebookDownloader = lazy(() => import("../pages/Tools/FacebookDownloader")); // ✅ New
const TelegramDownloader = lazy(() => import("../pages/Tools/TelegramDownloader")); // ✅ New
const InstagramDownloader = lazy(() => import("../pages/Tools/InstagramDownloader")); // ✅ New
const CapCutDownloader = lazy(() => import("../pages/Tools/CapCutDownloader")); // ✅ New
const VideoCreator = lazy(() => import("../pages/Tools/VideoCreator")); // ✅ New
const DropshipCenter = lazy(() => import("../pages/Tools/DropshipCenter")); // ✅ New
const SubtitleGenerator = lazy(() => import("../pages/Tools/SubtitleGenerator")); // ✅ New
const MagicMotion = lazy(() => import('../pages/Tools/MagicMotion'));
const CensorshipTool = lazy(() => import('../pages/Tools/CensorshipTool')); // ✅ New
const LabelSwapTool = lazy(() => import('../pages/Tools/LabelSwapTool')); // ✅ New
const ScriptWriter = lazy(() => import('../pages/Tools/ScriptWriter')); // ✅ New
const ThumbnailGenerator = lazy(() => import('../pages/Tools/ThumbnailGenerator')); // ✅ New
const TelegramCloud = lazy(() => import('../pages/Tools/TelegramCloud')); // ✅ New
const FarmControl = lazy(() => import('../pages/Tools/FarmControl')); // ✅ New
const TikTokTrends = lazy(() => import("../pages/Tools/TikTokTrends")); // ✅ New
const ViralFinder = lazy(() => import("../pages/Tools/ViralFinder")); // ✅ New
const AiTools = lazy(() => import("../pages/Tools/AiTools"));
const Connections = lazy(() => import("../pages/Connections"));
const Analytics = lazy(() => import("../pages/Analytics")); // ✅ New

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
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

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
            path="/bulk-upload"
            element={
              <ProtectedRoute>
                <BulkPost />
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
            path="/tools/ai"
            element={
              <ProtectedRoute>
                <AiTools />
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
            path="/tools/telegram"
            element={
              <ProtectedRoute>
                <TelegramDownloader />
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
            path="/tools/capcut"
            element={
              <ProtectedRoute>
                <CapCutDownloader />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/video-creator"
            element={
              <ProtectedRoute>
                <VideoCreator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/dropship-center"
            element={
              <ProtectedRoute>
                <DropshipCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/subtitle-generator"
            element={
              <ProtectedRoute>
                <SubtitleGenerator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/magic-motion"
            element={
              <ProtectedRoute>
                <MagicMotion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/censorship"
            element={
              <ProtectedRoute>
                <CensorshipTool />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/label-swap"
            element={
              <ProtectedRoute>
                <LabelSwapTool />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/script-writer"
            element={
              <ProtectedRoute>
                <ScriptWriter />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/thumbnail-generator"
            element={
              <ProtectedRoute>
                <ThumbnailGenerator />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/telegram-cloud"
            element={
              <ProtectedRoute>
                <TelegramCloud />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tools/farm"
            element={
              <ProtectedRoute>
                <FarmControl />
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
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
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
            path="/tools/facebook"
            element={
              <ProtectedRoute>
                <FacebookDownloader />
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
