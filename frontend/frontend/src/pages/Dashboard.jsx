// ============================================================
// 🚀 Dashboard.jsx (Redesigned with Tailwind CSS)
// ============================================================

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion"; // eslint-disable-line no-unused-vars
import toast from "react-hot-toast";

import DashboardLayout from "../layouts/DashboardLayout";
import VideoPreview from "../components/VideoPreview";
import ThumbnailUpload from "../components/ThumbnailUpload";
import AccountSelector from "../components/AccountSelector";
import ScheduledPostList from "../components/ScheduledPostList";
import BotReplySettings from "../components/BotReplySettings";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { List, Clock, Trash2, Send, Calendar } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { pagesAPI, postsAPI, tiktokAPI } from "../utils/api";
import apiUtils from "../utils/apiUtils";

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("schedule"); // schedule, queue, bot
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [caption, setCaption] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [availablePages, setAvailablePages] = useState([]);
  const [queue, setQueue] = useState([]);
  const [queueError, setQueueError] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [videoMetadata, setVideoMetadata] = useState(null);
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);

  // ✅ Initialize Demo Mode
  useEffect(() => {
    if (localStorage.getItem("isDemo") === "true" || user?.isDemo) {
      setIsDemo(true);
    }
  }, [user]);

  // ✅ Fetch TikTok Metadata
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!tiktokUrl || !tiktokUrl.includes("tiktok.com")) {
        setVideoMetadata(null);
        return;
      }

      setIsFetchingMeta(true);
      try {
        const res = await tiktokAPI.getVideoInfo(tiktokUrl);
        if (res.success) {
          setVideoMetadata(res);
          if (res.description && !caption) {
            setCaption(res.description); // Auto-fill caption
            toast.success("Caption auto-filled from TikTok!");
          }
        }
      } catch (err) {
        console.error("Failed to fetch TikTok metadata", err);
      } finally {
        setIsFetchingMeta(false);
      }
    };

    const timeoutId = setTimeout(fetchMetadata, 1000); // Debounce
    return () => clearTimeout(timeoutId);
  }, [tiktokUrl]);

  // ✅ Fetch Pages & Auto-Select All
  useEffect(() => {
    const fetchPages = async () => {
      try {
        const res = await pagesAPI.getAccounts();
        if (res.success) {
          setAvailablePages(res.accounts);
          // 🪄 Auto-select all pages by default
          const allPageIds = res.accounts.map(p => p.id);
          setAccounts(allPageIds);
        }
      } catch (err) {
        console.error("Failed to fetch pages", err);
        toast.error("Failed to load pages");
      }
    };
    if (user && !isDemo) fetchPages();
  }, [user, isDemo]);

  // ✅ Fetch Queue (with Auto-Refresh)
  useEffect(() => {
    let intervalId;

    const fetchQueue = async () => {
      if (activeTab === 'queue') {
        setQueueError(null);
        try {
          // 🔄 Retry up to 3 times
          const res = await apiUtils.retryRequest(() => postsAPI.getQueue());
          setQueue(res.posts || []);
        } catch (error) {
          apiUtils.logError("Dashboard.fetchQueue", error);
          setQueueError(apiUtils.getUserErrorMessage(error));
        }
      }
    };

    if (user && !isDemo && activeTab === 'queue') {
      fetchQueue(); // Initial fetch
      intervalId = setInterval(fetchQueue, 10000); // Poll every 10 seconds
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeTab, user, isDemo]);


  const handleVideoSelect = (file) => {
    setVideoFile(file);
    setTiktokUrl(""); // Clear URL if file is selected
  };

  const getMinScheduleTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10); // Min 10 mins in future
    return now.toISOString().slice(0, 16);
  };

  const cancelScheduledPost = async (id) => {
    if (!window.confirm("Cancel this scheduled post?")) return;
    const toastId = toast.loading("Cancelling post...");
    try {
      await postsAPI.cancel(id);
      toast.success("Post cancelled", { id: toastId });
      setQueue(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      toast.error("Failed to cancel post", { id: toastId });
    }
  };

  const handlePost = async (isSchedule = false) => {
    if (!accounts.length) return toast.error("Please select at least one page.");
    if (!videoFile && !tiktokUrl) return toast.error("Please provide a video.");
    if (!caption) return toast.error("Please enter a caption.");
    if (isSchedule && !scheduleTime) return toast.error("Please select a schedule time.");

    setIsSubmitting(true);
    const toastId = toast.loading(isSchedule ? "Scheduling..." : "Publishing...");

    try {
      const formData = new FormData();
      if (videoFile) formData.append("video", videoFile);
      if (tiktokUrl) formData.append("tiktokUrl", tiktokUrl);
      if (thumbnail) formData.append("thumbnail", thumbnail);
      formData.append("caption", caption);
      formData.append("accounts", JSON.stringify(accounts));
      if (isSchedule) formData.append("scheduleTime", scheduleTime);

      const endpoint = "/api/posts/create";
      const token = localStorage.getItem("token");
      const response = await fetch(`${(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "")}${endpoint}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        toast.success(isSchedule ? "Post scheduled!" : "Post published!", { id: toastId });
        // Reset form
        setTiktokUrl("");
        setVideoFile(null);
        setThumbnail(null);
        setCaption("");
        setScheduleTime("");
        setAccounts([]);

        // ✅ Auto-switch to Queue tab if scheduled
        if (isSchedule) {
          setActiveTab("queue");
        }
      } else {
        throw new Error(data.error || "Failed to create post");
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Something went wrong", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your social media presence.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-gray-200 dark:border-gray-700">
        {["schedule", "queue", "bot"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-1 text-sm font-medium transition-all relative ${activeTab === tab
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {activeTab === tab && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
              />
            )}
          </button>
        ))}
      </div>

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
                    Create New Post
                  </h3>

                  {/* TikTok URL Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      TikTok Video URL
                    </label>
                    <input
                      type="text"
                      placeholder="Paste TikTok link here..."
                      value={tiktokUrl}
                      onChange={(e) => setTiktokUrl(e.target.value)}
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
                    {availablePages.length > 0 ? (
                      <AccountSelector
                        accounts={accounts}
                        availablePages={availablePages}
                        onChange={setAccounts}
                        isDemo={isDemo}
                      />
                    ) : (
                      <EmptyState
                        title="No Pages Found"
                        description="Connect your Facebook pages in Settings to start posting."
                        actionLabel="Go to Settings"
                        onAction={() => window.location.href = "/settings"}
                      />
                    )}
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

                  {/* Submit Buttons */}
                  <div className="flex gap-4">
                    <Button
                      onClick={() => handlePost(false)}
                      disabled={!!scheduleTime || isSubmitting}
                      isLoading={isSubmitting && !scheduleTime}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
                      size="large"
                    >
                      <Send size={20} className="mr-2" /> Post Now
                    </Button>
                    <Button
                      onClick={() => handlePost(true)}
                      disabled={!scheduleTime || isSubmitting}
                      isLoading={isSubmitting && !!scheduleTime}
                      variant="secondary"
                      className="flex-1"
                      size="large"
                    >
                      <Calendar size={20} className="mr-2" /> Schedule
                    </Button>
                  </div>
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
                    metadata={videoMetadata}
                    isLoadingMeta={isFetchingMeta}
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
              <ScheduledPostList
                posts={queue}
                onCancel={cancelScheduledPost}
                onRetry={() => {
                  setQueueError(null);
                  // Re-trigger fetch by toggling tab or calling a function if we extracted it.
                  // Since fetchQueue is in useEffect [activeTab], we can just force re-fetch or call api directly.
                  // Better: extract fetchQueue outside useEffect or just use a simple state toggle.
                  // For now, let's just reload the tab logic by setting activeTab to something else then back? No, that's hacky.
                  // Let's just call the API directly here or make fetchQueue available.
                  // Actually, I'll just use the same logic as useEffect.
                  const retryFetch = async () => {
                    setQueueError(null);
                    try {
                      const res = await apiUtils.retryRequest(() => postsAPI.getQueue());
                      setQueue(res.posts || []);
                    } catch (error) {
                      apiUtils.logError("Dashboard.fetchQueueRetry", error);
                      setQueueError(apiUtils.getUserErrorMessage(error));
                    }
                  };
                  retryFetch();
                }}
                error={queueError}
              />
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
