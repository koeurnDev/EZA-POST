// ============================================================
// 📋 ScheduledPosts.jsx — Queue Management
// ============================================================

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion"; // eslint-disable-line no-unused-vars

import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import { PageLoader } from "../components/LoadingSpinner";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { postsAPI } from "../utils/api";
import { Clock, Trash2, AlertCircle, CheckCircle2, Plus, Calendar } from "lucide-react";

import toast from "react-hot-toast";
import EmptyState from "../components/ui/EmptyState";

// ... (inside component)

export default function ScheduledPosts() {
    const { user } = useAuth();
    useTheme();

    // State
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDemo, setIsDemo] = useState(false);

    // ✅ Initialize Demo Mode
    useEffect(() => {
        if (localStorage.getItem("isDemo") === "true" || user?.isDemo) {
            setIsDemo(true);
        }
    }, [user]);

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
            toast.error("Failed to fetch queue");
            setLoading(false);
        }
    }, [isDemo]);

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

        const toastId = toast.loading("Cancelling post...");
        try {
            if (isDemo) {
                setQueue((prev) => prev.filter((q) => q.id !== postId));
                toast.success("Demo post cancelled", { id: toastId });
                return;
            }
            await postsAPI.cancel(postId);
            toast.success("Post cancelled successfully", { id: toastId });
            fetchQueue();
        } catch {
            toast.error("Error cancelling post", { id: toastId });
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
                <EmptyState
                    icon={Calendar}
                    title="No posts scheduled"
                    description="Your queue is empty. Start creating content to keep your audience engaged!"
                    actionLabel="Create First Post"
                    onAction={() => window.location.href = "/post"}
                    tips={[
                        "Click 'Create First Post' to schedule content.",
                        "You can schedule single videos or mixed carousels.",
                        "Use the 'Schedule' button in the post composer."
                    ]}
                />
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
                                            className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
                                        >
                                            {/* 🖼️ Thumbnail Preview */}
                                            <div className="relative h-48 bg-gray-100 dark:bg-gray-900 overflow-hidden">
                                                {q.thumbnailUrl ? (
                                                    <img
                                                        src={`${import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, "")}${q.thumbnailUrl}`}
                                                        alt="Thumbnail"
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                        <div className="text-center">
                                                            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                                                                <Calendar size={20} />
                                                            </div>
                                                            <span className="text-xs font-medium">No Preview</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Status Badge */}
                                                <div className="absolute top-3 left-3 flex flex-col gap-2">
                                                    <span
                                                        className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase backdrop-blur-md shadow-sm w-fit ${q.status === "scheduled"
                                                            ? "bg-blue-500/90 text-white"
                                                            : q.status === "processing"
                                                                ? "bg-yellow-500/90 text-white"
                                                                : "bg-gray-500/90 text-white"
                                                            }`}
                                                    >
                                                        {q.status}
                                                    </span>
                                                    {q.postType === "carousel" && (
                                                        <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase backdrop-blur-md shadow-sm bg-purple-500/90 text-white w-fit">
                                                            Carousel
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Cancel Button */}
                                                <button
                                                    onClick={() => cancelScheduledPost(q.id)}
                                                    className="absolute top-3 right-3 p-2 bg-white/90 dark:bg-black/50 text-gray-600 dark:text-gray-300 rounded-full hover:bg-red-500 hover:text-white transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                                                    title="Cancel Post"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            <div className="p-4 md:p-5 flex-1 flex flex-col">
                                                <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-3 min-h-[3rem] leading-relaxed">
                                                    {q.caption || "No caption provided"}
                                                </h4>

                                                <div className="mt-auto space-y-3">
                                                    {/* Time */}
                                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/30 p-2.5 rounded-xl">
                                                        <Clock size={16} className="text-blue-500" />
                                                        <span className="font-medium">
                                                            {new Date(q.scheduleTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Phnom_Penh' })}
                                                        </span>
                                                        <span className="text-gray-300 dark:text-gray-600">|</span>
                                                        <span>
                                                            {new Date(q.scheduleTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'Asia/Phnom_Penh' })}
                                                        </span>
                                                    </div>

                                                    {/* Accounts */}
                                                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                                                        <div className="flex -space-x-2 overflow-hidden pl-1">
                                                            {q.accounts?.slice(0, 3).map((acc, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="h-7 w-7 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                                                                    title={acc.name}
                                                                >
                                                                    {acc.name?.[0]}
                                                                </div>
                                                            ))}
                                                            {q.accounts?.length > 3 && (
                                                                <div className="h-7 w-7 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                                    +{q.accounts.length - 3}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="text-xs font-medium text-gray-400">
                                                            To {q.accounts?.length} Page{q.accounts?.length !== 1 && 's'}
                                                        </span>
                                                    </div>
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
