// ============================================================
// 📋 ScheduledPosts.jsx — Queue Management
// ============================================================

import React, { useState, useEffect, useCallback } from "react";

import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import { PageLoader } from "../components/LoadingSpinner";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { postsAPI } from "../utils/api";
import { Clock, Trash2, AlertCircle, CheckCircle2, Plus, Calendar } from "lucide-react";

export default function ScheduledPosts() {
    const { user } = useAuth();
    useTheme();

    // State
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
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

    // ✅ Fetch Queue
    const fetchQueue = useCallback(async () => {
        try {
            if (isDemo) {
                setQueue([
                    {
                        id: "demo-1",
                        caption: "Demo post scheduled from TikTok 🎥",
                        scheduleTime: new Date(Date.now() + 3600000).toISOString(),
                        status: "scheduled",
                        accounts: [{ name: "Demo Page" }],
                    },
                    {
                        id: "demo-2",
                        caption: "Another awesome video coming up! 🔥",
                        scheduleTime: new Date(Date.now() + 86400000).toISOString(),
                        status: "processing",
                        accounts: [{ name: "Demo Page" }, { name: "Gaming Hub" }],
                    },
                ]);
                setLoading(false);
            } else {
                const res = await postsAPI.getQueue();
                setQueue(res.posts || []);
                setLoading(false);
            }
        } catch {
            showNotification("Failed to fetch queue", "error");
            setLoading(false);
        }
    }, [isDemo, showNotification]);

    useEffect(() => {
        if (user || isDemo) {
            fetchQueue();
        }
    }, [user, isDemo, fetchQueue]);

    // ✅ Auto-refresh queue
    useEffect(() => {
        const interval = setInterval(fetchQueue, 60000);
        return () => clearInterval(interval);
    }, [fetchQueue]);

    // ✅ Cancel Post
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
        } catch {
            showNotification("❌ Error cancelling post", "error");
        }
    };

    // ✅ Group Posts by Date
    const groupedPosts = React.useMemo(() => {
        const groups = { today: [], tomorrow: [], later: [] };
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfter = new Date(tomorrow);
        dayAfter.setDate(dayAfter.getDate() + 1);

        queue.forEach((post) => {
            const date = new Date(post.scheduleTime);
            if (date >= today && date < tomorrow) {
                groups.today.push(post);
            } else if (date >= tomorrow && date < dayAfter) {
                groups.tomorrow.push(post);
            } else {
                groups.later.push(post);
            }
        });
        return groups;
    }, [queue]);

    // ✅ Loading State
    if (loading && !queue.length) return <PageLoader text="Loading queue..." />;

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
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Scheduled Posts
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Manage your upcoming content queue.
                    </p>
                </div>
                <Link
                    to="/dashboard"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-500/20"
                >
                    <Plus size={18} />
                    Schedule Post
                </Link>
            </div>

            {/* Queue Grid */}
            {queue.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                    <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Calendar className="text-blue-500" size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        No posts scheduled
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
                        Your queue is empty. Start creating content to keep your audience engaged!
                    </p>
                    <Link
                        to="/dashboard"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all hover:scale-105 shadow-lg shadow-blue-500/20"
                    >
                        <Plus size={20} />
                        Create First Post
                    </Link>
                </div>
            ) : (
                <div className="space-y-10">
                    {["today", "tomorrow", "later"].map((groupKey) => {
                        const posts = groupedPosts[groupKey];
                        if (posts.length === 0) return null;

                        const title =
                            groupKey === "today"
                                ? "Today"
                                : groupKey === "tomorrow"
                                    ? "Tomorrow"
                                    : "Later";

                        return (
                            <div key={groupKey}>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
                                    {title}
                                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                                        ({posts.length})
                                    </span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {posts.map((q) => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            key={q.id}
                                            className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                                        >
                                            <div className="p-5">
                                                <div className="flex justify-between items-start mb-4">
                                                    <span
                                                        className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${q.status === "scheduled"
                                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                                            : q.status === "processing"
                                                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                                                : "bg-gray-100 text-gray-700"
                                                            }`}
                                                    >
                                                        {q.status}
                                                    </span>
                                                    <button
                                                        onClick={() => cancelScheduledPost(q.id)}
                                                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Cancel Post"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>

                                                <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-4 min-h-[3rem] leading-relaxed">
                                                    {q.caption || "No caption"}
                                                </h4>

                                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-5 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl">
                                                    <Clock size={16} className="text-blue-500" />
                                                    <span className="font-medium">
                                                        {new Date(q.scheduleTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span className="text-gray-400">|</span>
                                                    <span>
                                                        {new Date(q.scheduleTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>

                                                <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex items-center justify-between">
                                                    <div className="flex -space-x-2 overflow-hidden pl-1">
                                                        {q.accounts?.map((acc, i) => (
                                                            <div
                                                                key={i}
                                                                className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-sm"
                                                                title={acc.name}
                                                            >
                                                                {acc.name?.[0]}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-400">
                                                        {q.accounts?.length} account{q.accounts?.length !== 1 && 's'}
                                                    </span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </DashboardLayout>
    );
}
