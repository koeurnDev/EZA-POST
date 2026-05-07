import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { TrendingUp, Flame, Eye, Heart, MessageCircle, Share2, DollarSign, RefreshCw, Sparkles, Filter } from 'lucide-react';
import api from '../utils/api';
import DashboardLayout from '../layouts/DashboardLayout';
import BoostPostModal from '../components/BoostPostModal';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';

const ViralPosts = () => {
    const MotionDiv = motion.div;
    const MotionAnimatePresence = AnimatePresence;
    const [viralPosts, setViralPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState(null);
    const [showBoostModal, setShowBoostModal] = useState(false);
    const [filter, setFilter] = useState('high'); // 'all', 'medium', 'high', 'viral'
    const [syncing, setSyncing] = useState(null);

    useEffect(() => {
        fetchViralPosts();
        const interval = setInterval(fetchViralPosts, 60000);
        return () => clearInterval(interval);
    }, [filter]);

    const fetchViralPosts = async () => {
        try {
            const response = await api.get(`/boost/viral-posts?tier=${filter}&limit=20`);
            setViralPosts(response.data.posts);
        } catch (error) {
            console.error('Error fetching viral posts:', error);
            toast.error('Failed to load viral posts');
        } finally {
            setLoading(false);
        }
    };

    const handleSyncMetrics = async (postId) => {
        setSyncing(postId);
        try {
            await api.post(`/boost/metrics/sync/${postId}`);
            toast.success('Metrics updated!');
            await fetchViralPosts();
        } catch (error) {
            toast.error('Failed to sync metrics');
        } finally {
            setSyncing(null);
        }
    };

    const handleBoostClick = (post) => {
        setSelectedPost(post);
        setShowBoostModal(true);
    };

    if (loading) return (
        <DashboardLayout>
            <div className="flex flex-col items-center justify-center h-[70vh]">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-500 font-bold tracking-widest uppercase text-xs">Hunting Viral Content...</p>
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout>
    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-10 gap-6 px-1">
                    <MotionDiv 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <h1 className="text-2xl md:text-4xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                            <div className="p-2 md:p-2.5 bg-orange-600 text-white rounded-xl md:rounded-2xl shadow-xl shadow-orange-500/30">
                                <Flame size={22} md:size={28} />
                            </div>
                            Viral Hub
                        </h1>
                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">Detect and scale your best performing content instantly.</p>
                    </MotionDiv>
 
                    <MotionDiv 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-1.5 md:gap-2 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 w-fit"
                    >
                        {['medium', 'high', 'viral'].map((tier) => (
                            <button
                                key={tier}
                                onClick={() => setFilter(tier)}
                                className={`px-3 md:px-5 py-2 rounded-xl text-[10px] md:text-xs font-bold transition-all uppercase tracking-widest ${filter === tier ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                {tier}
                            </button>
                        ))}
                    </MotionDiv>
                </div>
 
                {/* Posts Grid */}
                {viralPosts.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl md:rounded-[2.5rem] border border-dashed border-gray-200 dark:border-gray-700 mx-1">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
                            <TrendingUp size={32} md:size={40} className="text-gray-300" />
                        </div>
                        <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">No viral posts found</h3>
                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-2">Publish more content to see performance insights here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 px-1">
                        <MotionAnimatePresence>
                            {viralPosts.map((item, index) => (
                                <MotionDiv
                                    key={item.post._id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="group relative bg-white dark:bg-gray-800 rounded-3xl md:rounded-[2.5rem] border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-500"
                                >
                                    {/* Video Preview */}
                                    <div className="relative aspect-[4/5] bg-gray-900 overflow-hidden">
                                        <video
                                            src={item.post.videoUrl}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            muted
                                            loop
                                            onMouseEnter={e => e.target.play()}
                                            onMouseLeave={e => e.target.pause()}
                                            playsInline
                                        />
                                        
                                        {/* Status & Badges */}
                                        <div className="absolute top-3 md:top-4 inset-x-3 md:inset-x-4 flex justify-between items-start">
                                            <div className="flex flex-col gap-2">
                                                <div className={`px-3 md:px-4 py-1.5 rounded-full backdrop-blur-xl bg-orange-600/90 text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-xl border border-white/20 flex items-center gap-1.5 md:gap-2`}>
                                                    <Flame size={10} md:size={12} strokeWidth={3} />
                                                    {item.viralTier}
                                                </div>
                                                {item.post.isBoosted && (
                                                    <div className="px-3 md:px-4 py-1.5 rounded-full backdrop-blur-xl bg-green-600/90 text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-white/20 text-center">
                                                        Boosted
                                                    </div>
                                                )}
                                            </div>

                                            <div className="bg-white/90 dark:bg-black/50 backdrop-blur-md px-2.5 md:px-3 py-1 md:py-1.5 rounded-xl md:rounded-2xl flex items-center gap-1.5 md:gap-2 shadow-lg">
                                                <Sparkles size={12} md:size={14} className="text-orange-500" />
                                                <span className="text-xs md:text-sm font-black text-gray-900 dark:text-white">{Math.round(item.viralScore)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content Info */}
                                    <div className="p-5 md:p-6">
                                        <p className="text-gray-700 dark:text-gray-300 text-xs md:text-sm font-medium mb-4 md:mb-6 line-clamp-2 leading-relaxed h-10">
                                            {item.post.caption || "No caption provided"}
                                        </p>

                                        {/* Metrics Grid */}
                                        <div className="grid grid-cols-4 gap-1 md:gap-2 mb-6 md:mb-8 bg-gray-50 dark:bg-gray-900/50 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-gray-700">
                                            <div className="text-center">
                                                <Eye className="w-3.5 h-3.5 md:w-4 md:h-4 text-purple-500 mx-auto mb-1 md:mb-1.5" />
                                                <p className="text-gray-900 dark:text-white font-black text-[10px] md:text-xs">{item.metrics.reach > 1000 ? (item.metrics.reach/1000).toFixed(1) + 'k' : item.metrics.reach}</p>
                                            </div>
                                            <div className="text-center border-l border-gray-200 dark:border-gray-700">
                                                <Heart className="w-3.5 h-3.5 md:w-4 md:h-4 text-pink-500 mx-auto mb-1 md:mb-1.5" />
                                                <p className="text-gray-900 dark:text-white font-black text-[10px] md:text-xs">{item.metrics.likes}</p>
                                            </div>
                                            <div className="text-center border-l border-gray-200 dark:border-gray-700">
                                                <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-500 mx-auto mb-1 md:mb-1.5" />
                                                <p className="text-gray-900 dark:text-white font-black text-[10px] md:text-xs">{item.metrics.comments}</p>
                                            </div>
                                            <div className="text-center border-l border-gray-200 dark:border-gray-700">
                                                <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-500 mx-auto mb-1 md:mb-1.5" />
                                                <p className="text-gray-900 dark:text-white font-black text-[10px] md:text-xs">{item.metrics.shares}</p>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2 md:gap-3">
                                            <Button
                                                onClick={() => handleBoostClick(item)}
                                                className="flex-1 rounded-xl md:rounded-2xl bg-gradient-to-r from-orange-600 to-red-600 border-none h-11 md:h-12 text-xs md:text-sm"
                                            >
                                                <TrendingUp size={16} md:size={18} /> Boost
                                            </Button>
                                            <button
                                                onClick={() => handleSyncMetrics(item.post._id)}
                                                disabled={syncing === item.post._id}
                                                className="w-11 h-11 md:w-12 md:h-12 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-xl md:rounded-2xl flex items-center justify-center transition-all disabled:opacity-50"
                                            >
                                                <RefreshCw size={16} md:size={18} className={syncing === item.post._id ? 'animate-spin' : ''} />
                                            </button>
                                        </div>
                                    </div>
                                </MotionDiv>
                            ))}
                        </MotionAnimatePresence>
                    </div>
                )}
            </div>

            {/* Boost Modal */}
            {showBoostModal && selectedPost && (
                <BoostPostModal
                    post={selectedPost}
                    onClose={() => {
                        setShowBoostModal(false);
                        setSelectedPost(null);
                    }}
                    onSuccess={() => {
                        fetchViralPosts();
                        setShowBoostModal(false);
                        setSelectedPost(null);
                    }}
                />
            )}
        </DashboardLayout>
    );
};

export default ViralPosts;
