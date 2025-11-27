// ============================================================
// 🚀 Dashboard.jsx (Redesigned with Tailwind CSS)
// ============================================================

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import VideoPreview from "../components/VideoPreview";
import ThumbnailUpload from "../components/ThumbnailUpload";
import AccountSelector from "../components/AccountSelector";
import BotReplySettings from "../components/BotReplySettings";
import PostButton from "../components/PostButton";
import { PageLoader } from "../components/LoadingSpinner";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { pagesAPI, postsAPI } from "../utils/api";
import { Calendar, List, MessageSquare, Clock, Trash2, AlertCircle } from "lucide-react";

export default function Dashboard() {
  const { user, logout: onLogout } = useAuth();
  const { theme } = useTheme();

  // State
  const [activeTab, setActiveTab] = useState("schedule");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [videoFile, setVideoFile] = useState(null); // 🎥 New Video File State
  const [caption, setCaption] = useState("");
  const [thumbnail, setThumbnail] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [scheduleTime, setScheduleTime] = useState("");
  const [availablePages, setAvailablePages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState([]);
  const [notification, setNotification] = useState(null);
  const [isDemo, setIsDemo] = useState(false);

  // ✅ Initialize Demo Mode
  useEffect(() => {
    if (localStorage.getItem("isDemo") === "true" || user?.isDemo) {
      setIsDemo(true);
    }
  }, [user]);

  // ✅ Notification Handler
  const showNotification = useCallback((message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  }, []);

  // ✅ Fetch Data
  const fetchUserPages = useCallback(async () => {
    try {
      setLoading(true);
      if (isDemo) {
        setAvailablePages([
          { id: "demo-1", name: "Demo Page 1" },
          { id: "demo-2", name: "Demo Page 2" },
        ]);
      } else {
        const res = await pagesAPI.getAccounts();
        setAvailablePages(res.accounts || []);
      }
    } catch (err) {
      showNotification("Failed to load Facebook pages", "error");
      if (err.code === "UNAUTHORIZED") onLogout();
    } finally {
      setLoading(false);
    }
  }, [isDemo, showNotification, onLogout]);

  const fetchQueue = useCallback(async () => {
    try {
      if (isDemo) {
        setQueue([
          {
            id: "demo-1",
            caption: "Demo post scheduled from TikTok 🎥",
            scheduleTime: new Date().toISOString(),
            status: "scheduled",
            accounts: [{ name: "Demo Page" }],
          },
        ]);
      } else {
        const res = await postsAPI.getQueue();
        setQueue(res.posts || []);
      }
    } catch (err) {
      showNotification("Failed to fetch queue", "error");
    }
  }, [isDemo, showNotification]);

  useEffect(() => {
    if (user || isDemo) {
      fetchUserPages();
      fetchQueue();
    }
  }, [user, isDemo, fetchUserPages, fetchQueue]);

  // ✅ Auto-refresh queue
  useEffect(() => {
    const interval = setInterval(fetchQueue, 60000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // ✅ Form Helpers
  const resetForm = () => {
    setTiktokUrl("");
    setVideoFile(null);
    setCaption("");
    setThumbnail(null);
    setScheduleTime("");
    setAccounts([]);
  };

  const handlePostSuccess = (res) => {
    showNotification(res?.message || "✅ Post scheduled successfully!");
    fetchQueue();
    resetForm();
    setActiveTab("queue");
  };

  const handlePostError = (err) => {
    showNotification(err?.message || "❌ Failed to post video", "error");
  };

  const cancelScheduledPost = async (postId) => {
    if (!window.confirm("Cancel this scheduled post?")) return;
    try {
      if (isDemo) {
        setQueue((prev) => prev.filter((q) => q.id !== postId));
        showNotification("Demo post cancelled");
        return;
      }
      await postsAPI.cancel(postId);
      showNotification("Post cancelled successfully");
      fetchQueue();
    } catch (err) {
      showNotification("❌ Error cancelling post", "error");
    }
  };

  // ✅ Handle Video Selection
  const handleVideoSelect = (file) => {
    setVideoFile(file);
    if (file) setTiktokUrl(""); // Clear URL if file selected
  };

  // ✅ Validation
  const isFormValid =
    (videoFile || tiktokUrl.trim()) &&
    caption.trim() &&
    accounts.length > 0 &&
    caption.length <= 2200;

  const getMinScheduleTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    return now.toISOString().slice(0, 16);
  };

  // ✅ Loading State
  if (!user && !isDemo) return <PageLoader text="Redirecting..." />;
  if (loading && !availablePages.length && !isDemo) return <PageLoader text="Loading dashboard..." />;

  // ============================================================
  // 🎨 UI Components
  // ============================================================

  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${activeTab === id
        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
        }`}
    >
      <Icon size={18} />
      {label}
      {id === "queue" && queue.length > 0 && (
        <span className="ml-1 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
          {queue.length}
        </span>
      )}
    </button>
  );

  return (
    <DashboardLayout>
      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-24 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${notification.type === "error"
              ? "bg-red-500 text-white"
              : "bg-emerald-500 text-white"
              }`}
          >
            {notification.type === "error" ? <AlertCircle size={20} /> : <Clock size={20} />}
            <span className="font-medium">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.name?.split(" ")[0]}! 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your social media automation workflow.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-4 mb-8">
        <TabButton id="schedule" label="Schedule Post" icon={Calendar} />
        <TabButton id="queue" label="Queue" icon={List} />
        <TabButton id="bot" label="Auto-Reply" icon={MessageSquare} />
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {/* 📅 SCHEDULE TAB */}
          {activeTab === "schedule" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Form */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                    Post Details
                  </h3>

                  {/* TikTok URL (Optional / Alternative) */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      TikTok Video URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://www.tiktok.com/@user/video/..."
                      value={tiktokUrl}
                      onChange={(e) => {
                        setTiktokUrl(e.target.value);
                        if (e.target.value) setVideoFile(null); // Clear file if URL entered
                      }}
                      disabled={!!videoFile}
                      className={`w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all ${videoFile ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                    />
                    {videoFile && (
                      <p className="text-xs text-blue-500">
                        * URL input disabled because a video file is selected.
                      </p>
                    )}
                  </div>

                  {/* Caption */}
                  <div className="space-y-2 mt-4">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Caption
                    </label>
                    <textarea
                      placeholder="Write an engaging caption..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                    />
                    <div className="text-right text-xs text-gray-400">
                      {caption.length}/2200
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                    Publishing Settings
                  </h3>

                  {/* Accounts */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Pages
                    </label>
                    <AccountSelector
                      accounts={accounts}
                      availablePages={availablePages}
                      onChange={setAccounts}
                      isDemo={isDemo}
                    />
                  </div>

                  {/* Schedule Time */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Schedule Time (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      min={getMinScheduleTime()}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <PostButton
                    selectedAccounts={accounts}
                    videoUrl={tiktokUrl}
                    videoFile={videoFile} // 🎥 Pass video file
                    thumbnailFile={thumbnail}
                    caption={caption}
                    scheduleTime={scheduleTime ? new Date(scheduleTime) : null}
                    onPostSuccess={handlePostSuccess}
                    onPostError={handlePostError}
                    disabled={!isFormValid}
                  />
                </div>
              </div>

              {/* Right Column: Preview */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 sticky top-24">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                    Preview
                  </h3>

                  {/* 🎥 Video Preview with Drag & Drop */}
                  <VideoPreview
                    videoUrl={tiktokUrl}
                    videoFile={videoFile}
                    onFileSelect={handleVideoSelect}
                    isDemo={isDemo}
                  />

                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Custom Thumbnail (Optional)
                    </label>
                    <ThumbnailUpload
                      onChange={setThumbnail}
                      currentThumbnail={thumbnail}
                      isDemo={isDemo}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 📋 QUEUE TAB */}
          {activeTab === "queue" && (
            <div className="space-y-6">
              {queue.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <List className="text-gray-400" size={32} />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Queue is empty
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Schedule your first post to see it here.
                  </p>
                  <button
                    onClick={() => setActiveTab("schedule")}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Create Post
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {queue.map((q) => (
                    <div
                      key={q.id}
                      className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="p-5">
                        <div className="flex justify-between items-start mb-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${q.status === "scheduled"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              : q.status === "processing"
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                : "bg-gray-100 text-gray-700"
                              }`}
                          >
                            {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                          </span>
                          <button
                            onClick={() => cancelScheduledPost(q.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Cancel Post"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <h4 className="font-medium text-gray-900 dark:text-white line-clamp-2 mb-3 min-h-[3rem]">
                          {q.caption || "No caption"}
                        </h4>

                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                          <Clock size={16} />
                          {new Date(q.scheduleTime).toLocaleString()}
                        </div>

                        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-4">
                          <div className="flex -space-x-2 overflow-hidden">
                            {q.accounts?.map((acc, i) => (
                              <div
                                key={i}
                                className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600"
                                title={acc.name}
                              >
                                {acc.name?.[0]}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 🤖 BOT TAB */}
          {activeTab === "bot" && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <BotReplySettings isDemo={isDemo} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </DashboardLayout>
  );
}
