import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Rocket, DollarSign, Eye, MousePointerClick, TrendingUp, Pause, Play, Trash2, RefreshCw, Calendar, Target } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const BoostCampaigns = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'active', 'paused', 'completed'

    useEffect(() => {
        fetchCampaigns();

        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchCampaigns, 30000);
        return () => clearInterval(interval);
    }, [filter]);

    const fetchCampaigns = async () => {
        try {
            const response = await api.get(`/api/boost/campaigns?status=${filter}&limit=50`);
            setCampaigns(response.data.campaigns);
        } catch (error) {
            console.error('Error fetching campaigns:', error);
            toast.error('Failed to load campaigns');
        } finally {
            setLoading(false);
        }
    };

    const handlePauseCampaign = async (campaignId) => {
        try {
            await api.patch(`/api/boost/campaigns/${campaignId}/status`, { status: 'paused' });
            toast.success('Campaign paused');
            fetchCampaigns();
        } catch (error) {
            console.error('Error pausing campaign:', error);
            toast.error('Failed to pause campaign');
        }
    };

    const handleResumeCampaign = async (campaignId) => {
        try {
            await api.patch(`/api/boost/campaigns/${campaignId}/status`, { status: 'active' });
            toast.success('Campaign resumed');
            fetchCampaigns();
        } catch (error) {
            console.error('Error resuming campaign:', error);
            toast.error('Failed to resume campaign');
        }
    };

    const handleDeleteCampaign = async (campaignId) => {
        if (!confirm('Are you sure you want to cancel this campaign?')) return;

        try {
            await api.delete(`/api/boost/campaigns/${campaignId}`);
            toast.success('Campaign cancelled');
            fetchCampaigns();
        } catch (error) {
            console.error('Error deleting campaign:', error);
            toast.error('Failed to cancel campaign');
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            active: 'bg-green-600 text-white',
            paused: 'bg-yellow-600 text-white',
            completed: 'bg-gray-600 text-white',
            failed: 'bg-red-600 text-white',
            draft: 'bg-blue-600 text-white'
        };
        return badges[status] || 'bg-gray-600 text-white';
    };

    const calculateProgress = (campaign) => {
        const totalBudget = campaign.budget * campaign.duration;
        const spent = campaign.metrics?.spend || 0;
        return Math.min(100, (spent / totalBudget) * 100);
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
                            <Rocket className="w-10 h-10 text-blue-500" />
                            Boost Campaigns
                        </h1>
                        <p className="text-gray-400 mt-2">
                            Manage and monitor your active ad campaigns
                        </p>
                    </div>
                    <button
                        onClick={fetchCampaigns}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </motion.div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mt-6">
                    {['all', 'active', 'paused', 'completed'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${filter === status
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Campaigns List */}
            <div className="max-w-7xl mx-auto">
                {campaigns.length === 0 ? (
                    <div className="text-center py-20">
                        <Rocket className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-400">No campaigns yet</h3>
                        <p className="text-gray-500 mt-2">
                            Create your first boost campaign from the Viral Posts page!
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {campaigns.map((campaign, index) => (
                            <motion.div
                                key={campaign._id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-gray-800 rounded-xl p-4 md:p-6 shadow-xl hover:shadow-2xl transition-shadow"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        {/* Post Info */}
                                        {campaign.post && (
                                            <div className="flex items-start gap-4 mb-4">
                                                <video
                                                    src={campaign.post.videoUrl}
                                                    className="w-32 h-20 object-cover rounded-lg"
                                                    muted
                                                />
                                                <div className="flex-1">
                                                    <p className="text-white font-medium line-clamp-2">
                                                        {campaign.post.caption}
                                                    </p>
                                                    <p className="text-gray-500 text-sm mt-1">
                                                        Posted {formatDate(campaign.post.createdAt)}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Campaign Details */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                            <div>
                                                <p className="text-gray-400 text-xs mb-1">Budget</p>
                                                <p className="text-white font-semibold">${campaign.budget}/day</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400 text-xs mb-1">Duration</p>
                                                <p className="text-white font-semibold">{campaign.duration} days</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400 text-xs mb-1">Start Date</p>
                                                <p className="text-white font-semibold">{formatDate(campaign.startDate)}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-400 text-xs mb-1">End Date</p>
                                                <p className="text-white font-semibold">{formatDate(campaign.endDate)}</p>
                                            </div>
                                        </div>

                                        {/* Metrics */}
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                                            <div className="bg-gray-900 p-3 rounded-lg">
                                                <DollarSign className="w-4 h-4 text-green-400 mb-1" />
                                                <p className="text-white font-bold text-lg">${campaign.metrics?.spend?.toFixed(2) || '0.00'}</p>
                                                <p className="text-gray-500 text-xs">Spent</p>
                                            </div>
                                            <div className="bg-gray-900 p-3 rounded-lg">
                                                <Eye className="w-4 h-4 text-blue-400 mb-1" />
                                                <p className="text-white font-bold text-lg">{campaign.metrics?.impressions?.toLocaleString() || '0'}</p>
                                                <p className="text-gray-500 text-xs">Impressions</p>
                                            </div>
                                            <div className="bg-gray-900 p-3 rounded-lg">
                                                <Target className="w-4 h-4 text-purple-400 mb-1" />
                                                <p className="text-white font-bold text-lg">{campaign.metrics?.reach?.toLocaleString() || '0'}</p>
                                                <p className="text-gray-500 text-xs">Reach</p>
                                            </div>
                                            <div className="bg-gray-900 p-3 rounded-lg">
                                                <MousePointerClick className="w-4 h-4 text-orange-400 mb-1" />
                                                <p className="text-white font-bold text-lg">{campaign.metrics?.clicks?.toLocaleString() || '0'}</p>
                                                <p className="text-gray-500 text-xs">Clicks</p>
                                            </div>
                                            <div className="bg-gray-900 p-3 rounded-lg">
                                                <TrendingUp className="w-4 h-4 text-pink-400 mb-1" />
                                                <p className="text-white font-bold text-lg">{campaign.metrics?.ctr?.toFixed(2) || '0'}%</p>
                                                <p className="text-gray-500 text-xs">CTR</p>
                                            </div>
                                        </div>

                                        {/* Budget Progress */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-gray-400 text-sm">Budget Progress</p>
                                                <p className="text-white text-sm font-semibold">
                                                    ${campaign.metrics?.spend?.toFixed(2) || '0'} / ${campaign.budget * campaign.duration}
                                                </p>
                                            </div>
                                            <div className="w-full bg-gray-700 rounded-full h-2">
                                                <div
                                                    className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all"
                                                    style={{ width: `${calculateProgress(campaign)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status & Actions */}
                                    <div className="ml-6 flex flex-col items-end gap-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusBadge(campaign.status)}`}>
                                            {campaign.status.toUpperCase()}
                                        </span>

                                        <div className="flex gap-2">
                                            {campaign.status === 'active' && (
                                                <button
                                                    onClick={() => handlePauseCampaign(campaign._id)}
                                                    className="p-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                                                    title="Pause Campaign"
                                                >
                                                    <Pause className="w-4 h-4" />
                                                </button>
                                            )}
                                            {campaign.status === 'paused' && (
                                                <button
                                                    onClick={() => handleResumeCampaign(campaign._id)}
                                                    className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                                                    title="Resume Campaign"
                                                >
                                                    <Play className="w-4 h-4" />
                                                </button>
                                            )}
                                            {['active', 'paused'].includes(campaign.status) && (
                                                <button
                                                    onClick={() => handleDeleteCampaign(campaign._id)}
                                                    className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                                    title="Cancel Campaign"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        {campaign.lastSyncedAt && (
                                            <p className="text-gray-500 text-xs">
                                                Updated {new Date(campaign.lastSyncedAt).toLocaleTimeString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BoostCampaigns;
