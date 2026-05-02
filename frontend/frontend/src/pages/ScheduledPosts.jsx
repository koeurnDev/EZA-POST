// ============================================================
// 📋 ScheduledPosts.jsx — Queue Management (Redesigned 2026)
// ============================================================

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import { PageLoader } from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";
import { postsAPI } from "../utils/api";
import { Clock, Trash2, Calendar, Plus, ChevronRight, LayoutGrid, List as ListIcon, MoreHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";

export default function ScheduledPosts() {
    const { user } = useAuth();

    // State
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDemo, setIsDemo] = useState(false);
    const [viewMode, setViewMode] = useState("grid"); // grid or list

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
                        caption: "Exploring the future of AI in 2026! 🚀 #Future #Tech",
                        scheduleTime: new Date(Date.now() + 3600000).toISOString(),
                        status: "scheduled",
                        accounts: [{ name: "EZA POST" }],
                        thumbnailUrl: null
                    },
                    {
                        id: "demo-2",
                        caption: "New viral trends you can't miss this week! 🔥",
                        scheduleTime: new Date(Date.now() + 86400000).toISOString(),
                        status: "processing",
                        accounts: [{ name: "EZA POST" }, { name: "Gaming Hub" }],
                        thumbnailUrl: null
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
        if (user || isDemo) fetchQueue();
    }, [user, isDemo, fetchQueue]);

    // ✅ Cancel Post
    const cancelScheduledPost = async (postId) => {
        if (!window.confirm("Are you sure you want to cancel this post?")) return;

        const toastId = toast.loading("Removing post...");
        try {
            if (isDemo) {
                setQueue((prev) => prev.filter((q) => q.id !== postId));
                toast.success("Demo post removed", { id: toastId });
                return;
            }
            await postsAPI.cancel(postId);
            toast.success("Post removed successfully", { id: toastId });
            fetchQueue();
        } catch {
            toast.error("Error removing post", { id: toastId });
        }
    };

    // ✅ Group Posts by Date
    const groupedPosts = React.useMemo(() => {
        const groups = { today: [], tomorrow: [], later: [] };
        const now = new Date();
        const todayStr = now.toDateString();
        const tomorrowStr = new Date(now.getTime() + 86400000).toDateString();

        queue.forEach((post) => {
            const dateStr = new Date(post.scheduleTime).toDateString();
            if (dateStr === todayStr) groups.today.push(post);
            else if (dateStr === tomorrowStr) groups.tomorrow.push(post);
            else groups.later.push(post);
        });
        return groups;
    }, [queue]);

    if (loading && !queue.length) return (
        <DashboardLayout>
            <div className="flex flex-col items-center justify-center h-[70vh]">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-500 font-bold tracking-widest uppercase text-xs">Syncing Queue...</p>
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/30">
                                <Clock size={28} />
                            </div>
                            Queue
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Manage and optimize your upcoming content schedule.</p>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3"
                    >
                        <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 hidden md:flex">
                            <button 
                                onClick={() => setViewMode("grid")}
                                className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-400'}`}
                            >
                                <LayoutGrid size={18} />
                            </button>
                            <button 
                                onClick={() => setViewMode("list")}
                                className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-400'}`}
                            >
                                <ListIcon size={18} />
                            </button>
                        </div>
                        <Button
                            onClick={() => window.location.href = "/dashboard"}
                            className="rounded-2xl px-6 shadow-xl"
                        >
                            <Plus size={20} /> Create New
                        </Button>
                    </motion.div>
                </div>

                {/* Queue Content */}
                {queue.length === 0 ? (
                    <EmptyState
                        icon={Calendar}
                        title="Your queue is empty"
                        description="Keep your audience engaged by scheduling content ahead of time."
                        actionLabel="Schedule Now"
                        onAction={() => window.location.href = "/dashboard"}
                    />
                ) : (
                    <div className="space-y-12">
                        {["today", "tomorrow", "later"].map((groupKey) => {
                            const posts = groupedPosts[groupKey];
                            if (posts.length === 0) return null;

                            const title = groupKey === "today" ? "Scheduled Today" : groupKey === "tomorrow" ? "Coming Tomorrow" : "Later this week";

                            return (
                                <div key={groupKey}>
                                    <div className="flex items-center gap-4 mb-6">
                                        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{title}</h3>
                                        <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                                        <span className="text-xs font-black bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full">{posts.length}</span>
                                    </div>

                                    <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-6`}>
                                        <AnimatePresence>
                                            {posts.map((q, idx) => (
                                                <motion.div
                                                    layout
                                                    key={q.id}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className={`group relative bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 ${viewMode === 'list' ? 'flex items-center gap-6 p-4' : 'flex flex-col overflow-hidden'}`}
                                                >
                                                    {/* Media Preview */}
                                                    <div className={`${viewMode === 'list' ? 'w-32 h-20 rounded-2xl' : 'w-full h-48'} bg-gray-50 dark:bg-gray-900 relative overflow-hidden flex-shrink-0`}>
                                                        {q.thumbnailUrl ? (
                                                            <img
                                                                src={`${import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, "")}${q.thumbnailUrl}`}
                                                                alt="Thumbnail"
                                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-400">
                                                                    <Calendar size={24} />
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        {/* Status Overlay */}
                                                        <div className="absolute top-3 left-3">
                                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter backdrop-blur-xl shadow-lg border border-white/20 ${q.status === 'scheduled' ? 'bg-blue-600/90 text-white' : 'bg-amber-500/90 text-white'}`}>
                                                                {q.status}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Content Info */}
                                                    <div className={`p-5 flex-1 flex flex-col ${viewMode === 'list' ? 'p-0' : ''}`}>
                                                        <h4 className="font-bold text-gray-900 dark:text-white line-clamp-2 mb-4 leading-snug">
                                                            {q.caption || "Untitled Post"}
                                                        </h4>

                                                        <div className="flex items-center justify-between mt-auto">
                                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                                                <Clock size={14} className="text-blue-500" />
                                                                <span className="text-xs font-black text-gray-600 dark:text-gray-300">
                                                                    {new Date(q.scheduleTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center -space-x-2">
                                                                {q.accounts?.slice(0, 3).map((acc, i) => (
                                                                    <div key={i} className="h-7 w-7 rounded-full bg-blue-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-black text-white">
                                                                        {acc.name?.[0]}
                                                                    </div>
                                                                ))}
                                                                {q.accounts?.length > 3 && (
                                                                    <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center text-[10px] font-black text-gray-500">
                                                                        +{q.accounts.length - 3}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Actions Overlay / Row */}
                                                    <div className={`${viewMode === 'list' ? 'flex gap-2' : 'absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0'}`}>
                                                        <button 
                                                            onClick={() => cancelScheduledPost(q.id)}
                                                            className="p-2.5 bg-white/95 dark:bg-gray-800/95 text-red-500 rounded-full shadow-xl border border-gray-100 dark:border-gray-700 hover:bg-red-500 hover:text-white transition-all"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
