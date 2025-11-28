// ============================================================
// 🚀 Dashboard.jsx (Redesigned with Tailwind CSS)
// ============================================================

import React, { useState, useEffect } from "react";

import DashboardLayout from "../layouts/DashboardLayout";
import VideoPreview from "../components/VideoPreview";
import ThumbnailUpload from "../components/ThumbnailUpload";
import AccountSelector from "../components/AccountSelector";
import PostButton from "../components/PostButton";
import BotReplySettings from "../components/BotReplySettings";
import { List, Clock, Trash2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { pagesAPI } from "../utils/api";

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
  const [queue] = useState([]);
  const [isDemo, setIsDemo] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);

  // ✅ Initialize Demo Mode
  useEffect(() => {
    if (localStorage.getItem("isDemo") === "true" || user?.isDemo) {
      setIsDemo(true);
    }
  }, [user]);

  // ✅ Fetch Pages
  useEffect(() => {
    const fetchPages = async () => {
      try {
        const res = await pagesAPI.getAccounts();
        if (res.success) {
          setAvailablePages(res.accounts);
        }
      } catch (err) {
        console.error("Failed to fetch pages", err);
      }
    };
    if (user && !isDemo) fetchPages();
  }, [user, isDemo]);

  // ✅ Validate Form
  useEffect(() => {
    const hasMedia = tiktokUrl || videoFile;
    const hasAccounts = accounts.length > 0;
    setIsFormValid(hasMedia && hasAccounts);
  }, [tiktokUrl, videoFile, accounts]);

  const handleVideoSelect = (file) => {
    setVideoFile(file);
    setTiktokUrl(""); // Clear URL if file is selected
  };

  const handlePostSuccess = () => {
    setTiktokUrl("");
    setVideoFile(null);
    setThumbnail(null);
    setCaption("");
    setScheduleTime("");
    setAccounts([]);
    alert("Post created successfully!");
  };

  const handlePostError = (msg) => {
    alert(msg);
  };

  const getMinScheduleTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10); // Min 10 mins in future
    return now.toISOString().slice(0, 16);
  };

  const cancelScheduledPost = async (id) => {
    // Implement cancel logic
    console.log("Cancel post", id);
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
