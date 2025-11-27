// ============================================================
// 🚀 Overview.jsx — Main Dashboard (Scheduler)
// ============================================================

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import VideoPreview from "../components/VideoPreview";
import ThumbnailUpload from "../components/ThumbnailUpload";
import AccountSelector from "../components/AccountSelector";
import PostButton from "../components/PostButton";
import { PageLoader } from "../components/LoadingSpinner";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { pagesAPI } from "../utils/api";
import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Calendar, Plus } from "lucide-react";
import ScheduledPostList from "../components/ScheduledPostList";

export default function Overview() {
    const { user, logout: onLogout } = useAuth();
    const { theme } = useTheme();

    // State
    const [tiktokUrl, setTiktokUrl] = useState("");
    const [videoFile, setVideoFile] = useState(null);
    const [caption, setCaption] = useState("");
    const [thumbnail, setThumbnail] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [scheduleTime, setScheduleTime] = useState("");
    const [availablePages, setAvailablePages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState(null);
    const [isDemo, setIsDemo] = useState(false);
    const [refreshQueue, setRefreshQueue] = useState(0);

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

    // ✅ Fetch Pages
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

    useEffect(() => {
        if (user || isDemo) {
            fetchUserPages();
        }
    }, [user, isDemo, fetchUserPages]);

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
        resetForm();
        setRefreshQueue(prev => prev + 1); // Refresh the list
    };

    const handlePostError = (err) => {
        showNotification(err?.message || "❌ Failed to post video", "error");
    };

    const handleVideoSelect = (file) => {
        setVideoFile(file);
        if (file) setTiktokUrl("");
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
                        {notification.type === "error" ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                        <span className="font-medium">{notification.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Overview
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Create and schedule your social media posts.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Form */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                            Post Details
                        </h3>

                        {/* TikTok URL */}
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
                                    if (e.target.value) setVideoFile(null);
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

                    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
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

                        {/* Schedule Toggle */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Schedule for later?
                                </label>
                                <input
                                    type="checkbox"
                                    checked={!!scheduleTime}
                                    onChange={(e) => {
                                        if (!e.target.checked) setScheduleTime("");
                                        else {
                                            const now = new Date();
                                            now.setMinutes(now.getMinutes() + 60); // Default to 1 hour later
                                            now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Local time adjustment
                                            setScheduleTime(now.toISOString().slice(0, 16));
                                        }
                                    }}
                                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                />
                            </div>

                            {/* Schedule Time Input (Conditional) */}
                            <AnimatePresence>
                                {scheduleTime && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <input
                                            type="datetime-local"
                                            value={scheduleTime}
                                            onChange={(e) => setScheduleTime(e.target.value)}
                                            min={getMinScheduleTime()}
                                            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none mt-2"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Submit Button */}
                        <PostButton
                            selectedAccounts={accounts}
                            videoUrl={tiktokUrl}
                            videoFile={videoFile}
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
                    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 sticky top-24">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                            Preview
                        </h3>

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

                    {/* 📋 Scheduled Posts List (Sidebar) */}
                    <ScheduledPostList refreshTrigger={refreshQueue} compact={true} />
                </div>
            </div>

        </DashboardLayout>
    );
}
