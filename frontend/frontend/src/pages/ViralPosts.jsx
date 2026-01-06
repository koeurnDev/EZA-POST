import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Flame, Eye, Heart, MessageCircle, Share2, DollarSign, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import BoostPostModal from '../components/BoostPostModal';
import toast from 'react-hot-toast';

const ViralPosts = () => {
    const [viralPosts, setViralPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState(null);
    const [showBoostModal, setShowBoostModal] = useState(false);
    const [filter, setFilter] = useState('high'); // 'all', 'medium', 'high', 'viral'
    const [syncing, setSyncing] = useState(null);

    useEffect(() => {
        fetchViralPosts();

        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchViralPosts, 30000);
        return () => clearInterval(interval);
    }, [filter]);

    const fetchViralPosts = async () => {
        try {
            const response = await api.get(`/api/boost/viral-posts?tier=${filter}&limit=20`);
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
            await api.post(`/api/boost/metrics/sync/${postId}`);
            toast.success('Metrics synced successfully!');
            await fetchViralPosts();
        } catch (error) {
            console.error('Error syncing metrics:', error);
            toast.error(error.response?.data?.error || 'Failed to sync metrics');
        } finally {
            setSyncing(null);
        }
    };

    const handleBoostClick = (post) => {
        setSelectedPost(post);
        setShowBoostModal(true);
    };

    const getViralBadgeColor = (tier) => {
        switch (tier) {
            case 'viral': return 'bg-gradient-to-r from-red-500 to-pink-500';
            case 'high': return 'bg-gradient-to-r from-orange-500 to-yellow-500';
            case 'medium': return 'bg-gradient-to-r from-blue-500 to-cyan-500';
            default: return 'bg-gray-500';
        }
    };

    const getViralIcon = (tier) => {
        if (tier === 'viral') return <Flame className="w-4 h-4" />;
        return <TrendingUp className="w-4 h-4" />;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-6">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between"
                >
                    <div>
                        <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                            <Flame className="w-10 h-10 text-orange-500" />
                            Viral Posts Dashboard
                        </h1>
                        <p className="text-gray-400 mt-2">
                            Identify trending content and boost your best-performing posts
                        </p>
                    </div>
                    <button
                        onClick={fetchViralPosts}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </motion.div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mt-6">
                    {['all', 'medium', 'high', 'viral'].map((tier) => (
                        <button
                            key={tier}
                            onClick={() => setFilter(tier)}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${filter === tier
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Posts Grid */}
            <div className="max-w-7xl mx-auto">
                {viralPosts.length === 0 ? (
                    <div className="text-center py-20">
                        <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-400">No viral posts yet</h3>
                        <p className="text-gray-500 mt-2">
                            Publish more content and check back later!
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {viralPosts.map((item, index) => (
                            <motion.div
                                key={item.post._id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-gray-800 rounded-xl overflow-hidden shadow-xl hover:shadow-2xl transition-shadow"
                            >
                                {/* Video Preview */}
                                <div className="relative aspect-video bg-gray-900">
                                    <video
                                        src={item.post.videoUrl}
                                        className="w-full h-full object-cover"
                                        muted
                                    />

                                    {/* Viral Badge */}
                                    <div className={`absolute top-3 right-3 ${getViralBadgeColor(item.viralTier)} text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm font-bold shadow-lg`}>
                                        {getViralIcon(item.viralTier)}
                                        {Math.round(item.viralScore)}
                                    </div>

                                    {/* Boosted Badge */}
                                    {item.post.isBoosted && (
                                        <div className="absolute top-3 left-3 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                                            BOOSTED
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-4 md:p-5">
                                    {/* Caption */}
                                    <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                                        {item.post.caption}
                                    </p>

                                    {/* Metrics */}
                                    <div className="grid grid-cols-4 gap-2 mb-4">
                                        <div className="text-center">
                                            <Heart className="w-4 h-4 text-red-400 mx-auto mb-1" />
                                            <p className="text-white font-semibold text-sm">{item.metrics.likes}</p>
                                            <p className="text-gray-500 text-xs">Likes</p>
                                        </div>
                                        <div className="text-center">
                                            <MessageCircle className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                                            <p className="text-white font-semibold text-sm">{item.metrics.comments}</p>
                                            <p className="text-gray-500 text-xs">Comments</p>
                                        </div>
                                        <div className="text-center">
                                            <Share2 className="w-4 h-4 text-green-400 mx-auto mb-1" />
                                            <p className="text-white font-semibold text-sm">{item.metrics.shares}</p>
                                            <p className="text-gray-500 text-xs">Shares</p>
                                        </div>
                                        <div className="text-center">
                                            <Eye className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                                            <p className="text-white font-semibold text-sm">{item.metrics.reach}</p>
                                            <p className="text-gray-500 text-xs">Reach</p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleBoostClick(item)}
                                            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-2 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all"
                                        >
                                            <DollarSign className="w-4 h-4" />
                                            Boost Post
                                        </button>
                                        <button
                                            onClick={() => handleSyncMetrics(item.post._id)}
                                            disabled={syncing === item.post._id}
                                            className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${syncing === item.post._id ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>

                                    {/* Recommended Budget */}
                                    <div className="mt-3 text-center text-xs text-gray-500">
                                        Recommended: ${item.recommendedBudget.recommended}/day
                                    </div>
                                </div>
                            </motion.div>
                        ))}
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
        </div>
    );
};

export default ViralPosts;
