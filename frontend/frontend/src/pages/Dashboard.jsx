import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

import DashboardLayout from "../layouts/DashboardLayout";
import VideoPreview from "../components/VideoPreview";
import ThumbnailUpload from "../components/ThumbnailUpload";
import AccountSelector from "../components/AccountSelector";
import ScheduledPostList from "../components/ScheduledPostList";
import BotReplySettings from "../components/BotReplySettings";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { List, Clock, Trash2, Send, Calendar, Sparkles, LayoutDashboard, Share2, MessageSquare, Plus, Activity, ChevronRight, Zap } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { pagesAPI, postsAPI, tiktokAPI } from "../utils/api";
import apiUtils from "../utils/apiUtils";

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("schedule");
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

  useEffect(() => {
    if (localStorage.getItem("isDemo") === "true" || user?.isDemo) {
      setIsDemo(true);
    }
  }, [user]);

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
            setCaption(res.description);
            toast.success("Identity metadata synchronized");
          }
        }
      } catch (err) {
        console.error("Failed to fetch TikTok metadata", err);
      } finally {
        setIsFetchingMeta(false);
      }
    };

    const timeoutId = setTimeout(fetchMetadata, 1000);
    return () => clearTimeout(timeoutId);
  }, [tiktokUrl]);

  useEffect(() => {
    const fetchPages = async () => {
      try {
        const res = await pagesAPI.getAccounts();
        if (res.success) {
          setAvailablePages(res.accounts);
          const allPageIds = res.accounts.map(p => p.id);
          setAccounts(allPageIds);
        }
      } catch (err) {
        toast.error("Failed to load authorized pages");
      }
    };
    if (user && !isDemo) fetchPages();
  }, [user, isDemo]);

  useEffect(() => {
    let intervalId;
    const fetchQueue = async () => {
      if (activeTab === 'queue') {
        setQueueError(null);
        try {
          const res = await apiUtils.retryRequest(() => postsAPI.getQueue());
          setQueue(res.posts || []);
        } catch (error) {
          setQueueError(apiUtils.getUserErrorMessage(error));
        }
      }
    };

    if (user && !isDemo && activeTab === 'queue') {
      fetchQueue();
      intervalId = setInterval(fetchQueue, 10000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeTab, user, isDemo]);

  const handleVideoSelect = (file) => {
    setVideoFile(file);
    setTiktokUrl("");
  };

  const cancelScheduledPost = async (id) => {
    if (!window.confirm("Terminate this scheduled process?")) return;
    const toastId = toast.loading("Aborting transmission...");
    try {
      await postsAPI.cancel(id);
      toast.success("Process terminated", { id: toastId });
      setQueue(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      toast.error("Termination failed", { id: toastId });
    }
  };

  const handlePost = async (isSchedule = false) => {
    if (!accounts.length) return toast.error("Select at least one active network.");
    if (!videoFile && !tiktokUrl) return toast.error("Video data required.");
    if (!caption) return toast.error("Caption is required for engagement.");
    if (isSchedule && !scheduleTime) return toast.error("Select a chronological slot.");

    setIsSubmitting(true);
    const toastId = toast.loading(isSchedule ? "Queueing..." : "Distributing...");

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
      const baseURL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/api$/, "");
      const response = await fetch(`${baseURL}${endpoint}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        toast.success(isSchedule ? "Transmission queued" : "Content distributed", { id: toastId });
        setTiktokUrl("");
        setVideoFile(null);
        setThumbnail(null);
        setCaption("");
        setScheduleTime("");
        setAccounts([]);

        if (isSchedule) setActiveTab("queue");
      } else {
        throw new Error(data.error || "Broadcast failure");
      }
    } catch (error) {
      toast.error(error.message || "Network protocol error", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-black text-blue-500 uppercase tracking-widest">
                Command Center
              </div>
            </div>
            <h1 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">
              Main <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Terminal.</span>
            </h1>
            <p className="text-gray-500 mt-2 font-medium">Orchestrate and monitor your multi-platform content distribution.</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-1.5 bg-gray-50 dark:bg-white/5 rounded-[1.5rem] w-fit mb-12 border border-gray-100 dark:border-white/5">
          {[
            { id: 'schedule', label: 'Broadcast', icon: Share2 },
            { id: 'queue', label: 'Ledger', icon: List },
            { id: 'bot', label: 'Automation', icon: Zap }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                ? "bg-white dark:bg-gray-900 text-blue-600 shadow-xl shadow-black/5 border border-gray-100 dark:border-white/10"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="activeDashboardTab" className="absolute inset-0 bg-blue-500/5 rounded-2xl -z-10" />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === "schedule" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Form Column */}
                <div className="lg:col-span-7 space-y-8">
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-10 shadow-2xl shadow-black/5">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600">
                        <Plus size={20} />
                      </div>
                      <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Compose Dispatch</h3>
                    </div>

                    <div className="space-y-8">
                      {/* TikTok URL */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Network Payload (TikTok URL)</label>
                        <input
                          type="text"
                          placeholder="Paste source identity link..."
                          value={tiktokUrl}
                          onChange={(e) => setTiktokUrl(e.target.value)}
                          disabled={!!videoFile}
                          className="w-full px-6 py-4 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-900 dark:text-white font-bold"
                        />
                      </div>

                      {/* Caption */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Narrative (Caption)</label>
                        <textarea
                          placeholder="Construct your message..."
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                          rows={6}
                          className="w-full px-6 py-4 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-900 dark:text-white font-bold resize-none"
                        />
                        <div className="flex justify-end text-[10px] font-black text-gray-300 uppercase tracking-widest">
                          {caption.length} / 2200
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-10 shadow-2xl shadow-black/5">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600">
                        <Activity size={20} />
                      </div>
                      <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Broadcast Protocol</h3>
                    </div>

                    <div className="space-y-10">
                      {/* Accounts */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Target Networks</label>
                        {availablePages.length > 0 ? (
                          <AccountSelector
                            accounts={accounts}
                            availablePages={availablePages}
                            onChange={setAccounts}
                            isDemo={isDemo}
                          />
                        ) : (
                          <EmptyState
                            title="No Authorized Networks"
                            description="Connect your digital identities in settings to begin distribution."
                            actionLabel="Initialize Connections"
                            onAction={() => window.location.href = "/settings"}
                          />
                        )}
                      </div>

                      {/* Schedule Time */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Chronological Slot (Optional)</label>
                        <input
                          type="datetime-local"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-full px-6 py-4 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-900 dark:text-white font-bold"
                        />
                      </div>

                      {/* Submit Actions */}
                      <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <Button
                          onClick={() => handlePost(false)}
                          disabled={!!scheduleTime || isSubmitting}
                          isLoading={isSubmitting && !scheduleTime}
                          className="flex-1 h-16 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20"
                        >
                          <Send size={18} className="mr-3" /> Execute Now
                        </Button>
                        <Button
                          onClick={() => handlePost(true)}
                          disabled={!scheduleTime || isSubmitting}
                          isLoading={isSubmitting && !!scheduleTime}
                          variant="secondary"
                          className="flex-1 h-16 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                        >
                          <Calendar size={18} className="mr-3" /> Queue Slot
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview Column */}
                <div className="lg:col-span-5 space-y-8">
                  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-10 shadow-2xl shadow-black/5 sticky top-28">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
                        <Sparkles size={20} />
                      </div>
                      <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Identity Preview</h3>
                    </div>

                    <div className="space-y-8">
                      <VideoPreview
                        videoUrl={tiktokUrl}
                        videoFile={videoFile}
                        onFileSelect={handleVideoSelect}
                        isDemo={isDemo}
                        metadata={videoMetadata}
                        isLoadingMeta={isFetchingMeta}
                      />

                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Custom Display Identity (Optional)</label>
                        <ThumbnailUpload
                          onChange={setThumbnail}
                          currentThumbnail={thumbnail}
                          isDemo={isDemo}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "queue" && (
              <div className="space-y-8">
                <ScheduledPostList
                  posts={queue}
                  onCancel={cancelScheduledPost}
                  onRetry={() => {
                    setQueueError(null);
                    const retryFetch = async () => {
                      try {
                        const res = await apiUtils.retryRequest(() => postsAPI.getQueue());
                        setQueue(res.posts || []);
                      } catch (error) {
                        setQueueError(apiUtils.getUserErrorMessage(error));
                      }
                    };
                    retryFetch();
                  }}
                  error={queueError}
                />
              </div>
            )}

            {activeTab === "bot" && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[3rem] overflow-hidden shadow-2xl shadow-black/5"
              >
                <div className="p-10 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600">
                            <Zap size={24} />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Neural Response Logic</h2>
                    </div>
                </div>
                <div className="p-10">
                  <BotReplySettings isDemo={isDemo} />
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
