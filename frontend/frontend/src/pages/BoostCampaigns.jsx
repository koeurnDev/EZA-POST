import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div;
const MotionAnimatePresence = AnimatePresence;
import { Rocket, DollarSign, Eye, MousePointerClick, TrendingUp, Pause, Play, Trash2, RefreshCw, Calendar, Target, Activity, ChevronRight, AlertCircle, BarChart3 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import DashboardLayout from '../layouts/DashboardLayout';
import Button from '../components/ui/Button';

const BoostCampaigns = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); 

    useEffect(() => {
        fetchCampaigns();
        const interval = setInterval(fetchCampaigns, 30000);
        return () => clearInterval(interval);
    }, [filter]);

    const fetchCampaigns = async () => {
        try {
            const response = await api.get(`/api/boost/campaigns?status=${filter}&limit=50`);
            setCampaigns(response.data.campaigns);
        } catch (error) {
            toast.error('Sync failed');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id, action, status) => {
        try {
            if (action === 'delete') {
                if (!confirm('Cancel this campaign?')) return;
                await api.delete(`/api/boost/campaigns/${id}`);
                toast.success('Campaign terminated');
            } else {
                await api.patch(`/api/boost/campaigns/${id}/status`, { status });
                toast.success(`Campaign ${status}`);
            }
            fetchCampaigns();
        } catch (error) {
            toast.error('Action failed');
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'active': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
            case 'paused': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
            case 'completed': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
            default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
        }
    };

    const calculateProgress = (campaign) => {
        const totalBudget = campaign.budget * campaign.duration;
        const spent = campaign.metrics?.spend || 0;
        return Math.min(100, (spent / totalBudget) * 100);
    };

    const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading Campaigns</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-6 py-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-[10px] font-black text-purple-500 uppercase tracking-widest">
                                Ad Manager PRO
                            </div>
                        </div>
                        <h1 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">
                            Active <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">Growth.</span>
                        </h1>
                        <p className="text-gray-500 mt-2 font-medium">Real-time performance tracking for your boosted content.</p>
                    </div>

                    <div className="flex bg-gray-100 dark:bg-white/5 p-1.5 rounded-[1.5rem] border border-gray-200/50 dark:border-white/5">
                        {['all', 'active', 'paused'].map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilter(s)}
                                className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === s 
                                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xl shadow-black/5' 
                                    : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Campaigns Grid */}
                <div className="space-y-6">
                    <MotionAnimatePresence mode="popLayout">
                        {campaigns.length === 0 ? (
                            <MotionDiv 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="py-32 text-center bg-gray-50 dark:bg-white/5 rounded-[3rem] border border-dashed border-gray-200 dark:border-white/10"
                            >
                                <Rocket size={64} className="mx-auto mb-6 text-gray-300" />
                                <h3 className="text-2xl font-black text-gray-400 tracking-tight">No Active Campaigns</h3>
                                <p className="text-gray-500 mt-2 font-medium">Launch a new campaign from your Viral Hub.</p>
                            </MotionDiv>
                        ) : (
                            campaigns.map((campaign, i) => (
                                <MotionDiv
                                    key={campaign._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="group bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-8 hover:shadow-2xl hover:shadow-purple-500/5 transition-all duration-500 overflow-hidden relative"
                                >
                                    <div className="flex flex-col lg:flex-row gap-8 relative z-10">
                                        {/* Left: Content Preview */}
                                        <div className="w-full lg:w-72 shrink-0">
                                            <div className="relative aspect-[4/3] rounded-[2rem] overflow-hidden bg-gray-100 dark:bg-black border border-gray-100 dark:border-white/5 group-hover:scale-[1.02] transition-transform duration-500">
                                                {campaign.post?.videoUrl ? (
                                                    <video src={campaign.post.videoUrl} className="w-full h-full object-cover" muted />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300"><Rocket size={48} /></div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                                                    <p className="text-white text-[10px] font-bold uppercase tracking-widest">Post Preview</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Metrics & Controls */}
                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                                                <div>
                                                    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight mb-2 line-clamp-1">{campaign.post?.caption || 'Growth Campaign'}</h3>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusStyle(campaign.status)}`}>
                                                            {campaign.status}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                                            <Calendar size={12} /> {formatDate(campaign.startDate)} — {formatDate(campaign.endDate)}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex gap-2">
                                                    {campaign.status === 'active' && (
                                                        <button onClick={() => handleAction(campaign._id, 'status', 'paused')} className="p-3 bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white rounded-2xl transition-all"><Pause size={20} /></button>
                                                    )}
                                                    {campaign.status === 'paused' && (
                                                        <button onClick={() => handleAction(campaign._id, 'status', 'active')} className="p-3 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-2xl transition-all"><Play size={20} /></button>
                                                    )}
                                                    <button onClick={() => handleAction(campaign._id, 'delete')} className="p-3 bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white rounded-2xl transition-all"><Trash2 size={20} /></button>
                                                </div>
                                            </div>

                                            {/* Live Stats Grid */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                                {[
                                                    { label: 'Total Spend', value: `$${campaign.metrics?.spend?.toFixed(2) || '0'}`, icon: DollarSign, color: 'text-emerald-500' },
                                                    { label: 'Impressions', value: (campaign.metrics?.impressions || 0).toLocaleString(), icon: Eye, color: 'text-blue-500' },
                                                    { label: 'Reach', value: (campaign.metrics?.reach || 0).toLocaleString(), icon: Target, color: 'text-purple-500' },
                                                    { label: 'Avg CTR', value: `${campaign.metrics?.ctr?.toFixed(2) || '0'}%`, icon: TrendingUp, color: 'text-pink-500' }
                                                ].map((stat, idx) => (
                                                    <div key={idx} className="bg-gray-50 dark:bg-black/40 p-4 rounded-3xl border border-gray-100 dark:border-white/5 hover:border-blue-500/20 transition-colors">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <stat.icon size={12} className={stat.color} />
                                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</span>
                                                        </div>
                                                        <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{stat.value}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-end">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Budget Utilization</p>
                                                    <p className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">
                                                        {calculateProgress(campaign).toFixed(1)}% <span className="text-gray-400 ml-1">Allocated</span>
                                                    </p>
                                                </div>
                                                <div className="h-2.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden border border-gray-200 dark:border-white/5">
                                                    <MotionDiv 
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${calculateProgress(campaign)}%` }}
                                                        className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-500 rounded-full"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sync Status Badge */}
                                    {campaign.lastSyncedAt && (
                                        <div className="mt-6 flex justify-end">
                                            <div className="flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                                <Activity size={10} className="animate-pulse text-emerald-500" />
                                                Live Sync: {new Date(campaign.lastSyncedAt).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    )}
                                </MotionDiv>
                            ))
                        )}
                    </MotionAnimatePresence>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default BoostCampaigns;
