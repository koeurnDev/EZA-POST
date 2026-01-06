import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { TrendingUp, Zap, Heart, MessageCircle, Share2, CheckCircle } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";

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
            toast.error("Failed to load analytics");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div></DashboardLayout>;
    }

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                        <TrendingUp className="text-green-500" size={32} />
                        Boost Analytics
                    </h1>
                    <p className="text-gray-500">Track your auto-boost performance</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Boosted</h3>
                            <Zap className="text-yellow-500" size={20} />
                        </div>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.totalBoosted || 0}</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Likes Added</h3>
                            <Heart className="text-red-500" size={20} />
                        </div>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.totalLikesAdded || 0}</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Comments Added</h3>
                            <MessageCircle className="text-blue-500" size={20} />
                        </div>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.totalCommentsAdded || 0}</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Shares Added</h3>
                            <Share2 className="text-green-500" size={20} />
                        </div>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.totalSharesAdded || 0}</p>
                    </div>
                </div>

                {/* Boosted Posts List */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Boosted Posts</h2>
                    </div>

                    {posts.length === 0 ? (
                        <div className="p-6 md:p-12 text-center text-gray-500">
                            <Zap size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No boosted posts yet. Enable auto-boost in settings!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Post</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Boosted</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Likes</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Comments</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Shares</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {posts.map((post) => (
                                        <tr key={post._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                                                    {post.postId?.content || 'Post deleted'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(post.boostStarted).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600">
                                                    <Heart size={14} />
                                                    +{post.metrics.likesAdded}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600">
                                                    <MessageCircle size={14} />
                                                    +{post.metrics.commentsAdded}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
                                                    <Share2 size={14} />
                                                    +{post.metrics.sharesAdded}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${post.status === 'completed'
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    }`}>
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
                </div>
            </div>
        </DashboardLayout>
    );
}
