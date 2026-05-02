import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { TrendingUp, Zap, Heart, MessageCircle, Share2, CheckCircle, BarChart3, Activity, ArrowUpRight, Clock } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

const MotionDiv = motion.div;

export default function BoostAnalytics() {
    const [stats, setStats] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const res = await api.get("/boost/analytics");
            if (res.data.success) {
                setStats(res.data.stats);
                setPosts(res.data.posts);
            }
        } catch (err) {
            toast.error("Analytics sync failed");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Processing Data</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-6 py-10">
                {/* Header */}
                <div className="mb-12">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                            Performance Insights
                        </div>
                    </div>
                    <h1 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">
                        Network <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Impact.</span>
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium">Detailed breakdown of your automated network engagement.</p>
                </div>

                {/* Main Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {[
                        { label: 'Total Boosted', value: stats?.totalBoosted || 0, icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
                        { label: 'Likes Added', value: stats?.totalLikesAdded || 0, icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                        { label: 'Comments Added', value: stats?.totalCommentsAdded || 0, icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                        { label: 'Shares Added', value: stats?.totalSharesAdded || 0, icon: Share2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
                    ].map((item, idx) => (
                        <MotionDiv
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="group bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2rem] p-8 hover:shadow-2xl hover:shadow-emerald-500/5 transition-all duration-500"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className={`w-12 h-12 ${item.bg} rounded-2xl flex items-center justify-center ${item.color}`}>
                                    <item.icon size={24} />
                                </div>
                                <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                                    <ArrowUpRight size={14} /> Live
                                </div>
                            </div>
                            <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">{item.label}</p>
                            <h3 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                                {item.value.toLocaleString()}
                            </h3>
                        </MotionDiv>
                    ))}
                </div>

                {/* Content Table */}
                <MotionDiv 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/5"
                >
                    <div className="p-8 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-50 dark:bg-black rounded-xl flex items-center justify-center text-gray-400">
                                <Activity size={20} />
                            </div>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Post Engagement History</h2>
                        </div>
                    </div>

                    {posts.length === 0 ? (
                        <div className="py-32 text-center">
                            <BarChart3 size={64} className="mx-auto mb-6 text-gray-200" />
                            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No analytics data available yet</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-black/20">
                                        <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Post Content</th>
                                        <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Boost Date</th>
                                        <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Engagement</th>
                                        <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {posts.map((post) => (
                                        <tr key={post._id} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-8 py-6">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1 max-w-xs">{post.postId?.content || 'Unidentified Content'}</p>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">ID: {post.postId?._id?.slice(-8) || 'N/A'}</p>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2 text-gray-500">
                                                    <Clock size={14} />
                                                    <span className="text-xs font-bold">{new Date(post.boostStarted).toLocaleDateString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <span className="flex items-center gap-1.5 text-xs font-black text-rose-500">
                                                        <Heart size={14} /> {post.metrics.likesAdded}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 text-xs font-black text-blue-500">
                                                        <MessageCircle size={14} /> {post.metrics.commentsAdded}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 text-xs font-black text-emerald-500">
                                                        <Share2 size={14} /> {post.metrics.sharesAdded}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${post.status === 'completed' 
                                                    ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                                                    : 'text-amber-500 bg-amber-500/10 border-amber-500/20'}`}>
                                                    {post.status === 'completed' && <CheckCircle size={12} />}
                                                    {post.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </MotionDiv>
            </div>
        </DashboardLayout>
    );
}
