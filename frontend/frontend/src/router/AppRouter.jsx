// ============================================================
// 🌐 AppRouter.jsx - Main Router Configuration for EZA_POST
// ============================================================

import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";

// --- Lazy Loaded Pages ---
const Login = lazy(() => import("../pages/Login"));
const Register = lazy(() => import("../pages/Register"));
const ScheduledPosts = lazy(() => import("../pages/ScheduledPosts"));
const BotSettingsPage = lazy(() => import("../pages/BotSettingsPage"));
const Settings = lazy(() => import("../pages/Settings"));
const Post = lazy(() => import("../pages/Post"));
const SubtitleStudio = lazy(() => import("../pages/SubtitleStudio")); // 🎬 Khmer AI Subtitle Studio

const TikTokDownloader = lazy(() => import("../pages/Tools/TikTokDownloader"));
const PinterestDownloader = lazy(() => import("../pages/Tools/PinterestDownloader"));
const YoutubeDownloader = lazy(() => import("../pages/Tools/YoutubeDownloader"));
const FacebookDownloader = lazy(() => import("../pages/Tools/FacebookDownloader"));
const InstagramDownloader = lazy(() => import("../pages/Tools/InstagramDownloader"));
const ThreadsDownloader = lazy(() => import("../pages/Tools/ThreadsDownloader"));
const CapCutDownloader = lazy(() => import("../pages/Tools/CapCutDownloader"));
const DocumentConverter = lazy(() => import("../pages/Tools/DocumentConverter"));
const TikTokTrends = lazy(() => import("../pages/Tools/TikTokTrends"));
const ViralFinder = lazy(() => import("../pages/Tools/ViralFinder"));
const PageCleaner = lazy(() => import("../pages/Tools/PageCleaner"));
const LiveStreamer = lazy(() => import("../pages/Tools/LiveStreamer"));
const Connections = lazy(() => import("../pages/Connections"));

const ViralPosts = lazy(() => import("../pages/ViralPosts"));
const BuyCredits = lazy(() => import("../pages/BuyCredits"));
const Guide = lazy(() => import("../pages/Guide"));

const Profile = lazy(() => import("../pages/Profile"));
const Welcome = lazy(() => import("../pages/Welcome"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));
const AuthCallback = lazy(() => import("../pages/AuthCallback"));

// 📱 Digital Business Card & Storefront (Noonlai-Equivalent + Bakong KHQR)
const BioBuilder = lazy(() => import("../pages/BioBuilder"));
const PublicBio = lazy(() => import("../pages/PublicBio"));

// --- Smooth Non-Flashing Loading Indicator ---
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-[#090d16] text-slate-300 gap-3">
    <div className="animate-spin rounded-full h-9 w-9 border-2 border-slate-700 border-t-blue-500"></div>
    <span className="text-xs font-medium opacity-75">កំពុងផ្ទុកទំព័រ...</span>
  </div>
);

// --- App Router Component ---
export default function AppRouter() {
  // Background preload all primary tabs so switching tabs is 0ms instant!
  useEffect(() => {
    const timer = setTimeout(() => {
      import("../pages/Post");
      import("../pages/SubtitleStudio");
      import("../pages/ScheduledPosts");
      import("../pages/BotSettingsPage");
      import("../pages/Connections");
      import("../pages/BioBuilder");
      import("../pages/Tools/TikTokDownloader");
      import("../pages/Tools/YoutubeDownloader");
      import("../pages/Tools/FacebookDownloader");
      import("../pages/Settings");
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ==================== Public Routes ==================== */}
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* 📱 Public Digital Business Card & Storefront */}
          <Route path="/b/:slug" element={<PublicBio />} />
          <Route path="/bio/:slug" element={<PublicBio />} />

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

          {/* 🎬 Khmer AI Subtitle Studio */}
          <Route
            path="/subtitles"
            element={
              <ProtectedRoute redirectPath="/welcome">
                <SubtitleStudio />
              </ProtectedRoute>
            }
          />

          {/* 📱 Digital Business Card / Bio Builder */}
          <Route
            path="/bio"
            element={
              <ProtectedRoute redirectPath="/welcome">
                <BioBuilder />
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

          {/* 🧹 Facebook Page Cleaner (Bulk Post Wiper) */}
          <Route
            path="/tools/page-cleaner"
            element={
              <ProtectedRoute>
                <PageCleaner />
              </ProtectedRoute>
            }
          />

          {/* 🔴 Multi-Page Live Streamer (Fake Live) */}
          <Route
            path="/tools/live-stream"
            element={
              <ProtectedRoute>
                <LiveStreamer />
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
