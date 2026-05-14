// ============================================================
// 👤 Profile.jsx — Premium User Profile (Redesigned 2026)
// ============================================================

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { authAPI, pagesAPI } from "../utils/api";
import { 
    User, Mail, MapPin, Calendar, Camera, Edit3, 
    TrendingUp, MessageSquare, Shield, Clock, 
    Settings, LogOut, ChevronRight, Activity 
} from "lucide-react";
import EditProfileModal from "../components/EditProfileModal";
import Button from "../components/ui/Button";


export default function Profile() {
    const MotionDiv = motion.div;
    const MotionH1 = motion.h1;
    const MotionP = motion.p;
    const MotionAnimatePresence = AnimatePresence;
    const { user, updateUser, loading } = useAuth();
    const [isDemo, setIsDemo] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Stats Configuration
    const statConfig = [
        { label: "Posts", icon: TrendingUp, color: "blue" },
        { label: "Replies", icon: MessageSquare, color: "emerald" },
        { label: "Pages", icon: Shield, color: "purple" },
    ];

    const [stats, setStats] = useState(() => {
        try {
            const cached = localStorage.getItem("profileStatsValues");
            const values = cached ? JSON.parse(cached) : { posts: "0", replies: "0", pages: "0" };
            return [
                { ...statConfig[0], value: values.posts },
                { ...statConfig[1], value: values.replies },
                { ...statConfig[2], value: values.pages },
            ];
        } catch {
            return statConfig.map(s => ({ ...s, value: "0" }));
        }
    });

    useEffect(() => {
        if (localStorage.getItem("isDemo") === "true" || user?.isDemo) setIsDemo(true);

        const fetchStats = async () => {
            try {
                const [pagesRes, statsRes] = await Promise.all([
                    pagesAPI.getAccounts(),
                    authAPI.getStats()
                ]);

                const pageCount = pagesRes.success ? pagesRes.accounts.length : 0;
                const postsCount = statsRes.success ? statsRes.stats.posts : 0;
                const repliesCount = statsRes.success ? statsRes.stats.replies : 0;

                setStats([
                    { ...statConfig[0], value: postsCount.toString() },
                    { ...statConfig[1], value: repliesCount.toString() },
                    { ...statConfig[2], value: pageCount.toString() },
                ]);

                localStorage.setItem("profileStatsValues", JSON.stringify({
                    posts: postsCount.toString(),
                    replies: repliesCount.toString(),
                    pages: pageCount.toString()
                }));
            } catch (err) {
                console.error("Failed to fetch profile stats:", err);
            }
        };

        if (user) fetchStats();
    }, [user]);

    const activities = [
        { id: 1, action: "Logged in via Desktop", time: "2 hours ago", icon: User },
        { id: 2, action: "Scheduled video post", time: "5 hours ago", icon: TrendingUp },
        { id: 3, action: "Updated bot rules", time: "1 day ago", icon: Settings },
        { id: 4, action: "Connected new page", time: "2 days ago", icon: Shield },
    ];

    const handleFileUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const uploadRes = type === 'cover' ? await authAPI.uploadCover(file) : await authAPI.uploadAvatar(file);
            if (uploadRes.success) {
                await updateUser({ [type === 'cover' ? 'coverImage' : 'avatar']: uploadRes.file.url });
            }
        } catch (err) {
            console.error(`Failed to upload ${type}:`, err);
        }
    };

    if (loading) return (
        <DashboardLayout>
            <div className="flex flex-col items-center justify-center h-[70vh]">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
                {/* Hero Section */}
                <div className="relative mb-32">
                    {/* Cover Photo */}
                    <MotionDiv 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="h-48 md:h-80 w-full rounded-[2.5rem] bg-gray-200 dark:bg-gray-800 overflow-hidden relative group shadow-2xl"
                    >
                        {user?.coverImage ? (
                            <img src={user.coverImage} alt="Cover" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700" />
                        )}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                        
                        <label className="absolute bottom-6 right-6 p-3 bg-white/10 backdrop-blur-xl text-white rounded-2xl border border-white/20 hover:bg-white/20 cursor-pointer transition-all shadow-xl group-hover:translate-x-[-10px]">
                            <Camera size={20} />
                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'cover')} />
                        </label>
                    </MotionDiv>

                    {/* Profile Overlay */}
                    <div className="absolute -bottom-16 left-8 md:left-12 flex items-end gap-6 md:gap-8">
                        <MotionDiv 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="relative group"
                        >
                            <div className="w-32 h-32 md:w-44 md:h-44 rounded-full border-[6px] border-white dark:border-gray-900 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden flex items-center justify-center relative">
                                {user?.avatar ? (
                                    <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-4xl font-black text-gray-300 uppercase">{user?.name?.[0]}</span>
                                )}
                                <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    <Camera size={32} className="text-white" />
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'avatar')} />
                                </label>
                            </div>
                        </MotionDiv>
 
                        <div className="mb-4">
                            <MotionH1 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-2xl md:text-4xl font-black text-gray-900 dark:text-white flex items-center gap-3 tracking-tight"
                            >
                                {user?.name}
                                {isDemo && <span className="px-3 py-1 text-[10px] bg-amber-500 text-white rounded-full font-black">DEMO</span>}
                            </MotionH1>
                            <MotionP 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                                className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-xs mt-1"
                            >
                                {user?.role || "Power User"}
                            </MotionP>
                        </div>
                    </div>

                    {/* Edit Profile Action */}
                    <div className="absolute -bottom-10 right-8 md:right-12">
                        <Button onClick={() => setIsEditModalOpen(true)} className="rounded-2xl px-8 shadow-xl py-6 text-sm">
                            <Edit3 size={18} /> Edit Profile
                        </Button>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Panel: Info & Stats */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Stats Summary */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {stats.map((stat, idx) => (
                                <MotionDiv
                                    key={idx}
                                    initial={{ opacity: 0, y: window.innerWidth < 768 ? 0 : 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 + idx * 0.05, duration: 0.3 }}
                                    className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center group hover:shadow-xl hover:shadow-blue-500/5 transition-all"
                                >
                                    <div className={`p-4 rounded-2xl mb-4 bg-${stat.color}-500/10 text-${stat.color}-600 group-hover:scale-110 transition-transform`}>
                                        <stat.icon size={28} />
                                    </div>
                                    <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-1 tracking-tight">{stat.value}</h3>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                                </MotionDiv>
                            ))}
                        </div>

                        {/* Personal Details */}
                        <MotionDiv 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-gray-100 dark:border-gray-700"
                        >
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                                <User size={20} className="text-blue-600" /> Account Details
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Display Name</label>
                                    <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{user?.name || "N/A"}</div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email Identity</label>
                                    <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{user?.email || "N/A"}</div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Geographic Location</label>
                                    <div className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                        <MapPin size={16} className="text-red-500" /> Phnom Penh, Cambodia
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Member Since</label>
                                    <div className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                        <Calendar size={16} className="text-blue-500" /> Nov 2023
                                    </div>
                                </div>
                            </div>
                        </MotionDiv>
                    </div>

                    {/* Right Panel: Activity Feed */}
                    <div className="lg:col-span-4">
                        <MotionDiv 
                            initial={{ opacity: 0, x: window.innerWidth < 768 ? 0 : 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3, duration: 0.4 }}
                            className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 shadow-sm border border-gray-100 dark:border-gray-700 h-full"
                        >
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                                <Activity size={20} className="text-blue-600" /> Pulse
                            </h3>

                            <div className="space-y-10 relative">
                                <div className="absolute left-6 top-2 bottom-2 w-px bg-gray-100 dark:bg-gray-700" />
                                {activities.map((item, idx) => (
                                    <div key={item.id} className="flex gap-6 relative group">
                                        <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center shrink-0 text-gray-400 border border-gray-100 dark:border-gray-700 shadow-sm z-10 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                                            <item.icon size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-gray-200">{item.action}</p>
                                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                                                <Clock size={10} /> {item.time}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button className="w-full mt-12 py-4 text-xs font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-2xl transition-all flex items-center justify-center gap-2">
                                Full Activity Logs <ChevronRight size={14} />
                            </button>
                        </MotionDiv>
                    </div>
                </div>
            </div>

            <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
        </DashboardLayout>
    );
}
