import React, { useState, useEffect, useCallback } from "react";
import { List, Clock, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { postsAPI } from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function ScheduledPostList({ refreshTrigger, compact = false }) {
    const { user } = useAuth();
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDemo, setIsDemo] = useState(false);
    const [notification, setNotification] = useState(null);

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
        } catch (err) {
            console.error("Failed to fetch queue:", err);
            setLoading(false);
        }
    }, [isDemo]);

    useEffect(() => {
        if (user || isDemo) {
            fetchQueue();
        }
    }, [user, isDemo, fetchQueue, refreshTrigger]);

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

    if (loading && !queue.length) return <div className="text-center py-10 text-gray-500">Loading scheduled posts...</div>;

    return (
        <div className={compact ? "mt-0" : "mt-12"}>
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

            <div className="flex items-center justify-between mb-4">
                <h3 className={`${compact ? "text-lg" : "text-xl"} font-bold text-gray-900 dark:text-white flex items-center gap-2`}>
                    <Clock className="text-blue-600" size={compact ? 20 : 24} />
                    Scheduled Posts
                </h3>
                <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                    {queue.length} Pending
                </span>
            </div>

            {queue.length === 0 ? (
                <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                        <List className="text-gray-400" size={20} />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        No posts scheduled yet.
                    </p>
                </div>
            ) : (
                <div className={`grid gap-4 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
                    {queue.map((q) => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
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
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
