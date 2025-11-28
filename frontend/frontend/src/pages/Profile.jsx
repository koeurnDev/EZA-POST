// ============================================================
// 👤 Profile.jsx — Premium User Profile
// ============================================================

import React, { useState, useEffect } from "react";

import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { authAPI, pagesAPI } from "../utils/api";
import {
    User,
    Mail,
    MapPin,
    Calendar,
    Edit2,
    Camera,
    Activity,
    Video,
    MessageSquare,
    ShieldCheck
} from "lucide-react";

import EditProfileModal from "../components/EditProfileModal";

export default function Profile() {
    const { user, updateUser } = useAuth();
    const [isDemo, setIsDemo] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [stats, setStats] = useState([
        { label: "Posts Created", value: "0", icon: Video, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
        { label: "Auto-Replies", value: "0", icon: MessageSquare, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
        { label: "Pages Connected", value: "0", icon: ShieldCheck, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
    ]);

    // ✅ Initialize Demo Mode & Fetch Stats
    useEffect(() => {
        if (localStorage.getItem("isDemo") === "true" || user?.isDemo) {
            setIsDemo(true);
        }

        const fetchStats = async () => {
            try {
                // Fetch Pages Count
                const pagesRes = await pagesAPI.getAccounts();
                const pageCount = pagesRes.success ? pagesRes.accounts.length : 0;

                // Fetch Real Stats
                const statsRes = await authAPI.getStats();
                const postsCount = statsRes.success ? statsRes.stats.posts : 0;
                const repliesCount = statsRes.success ? statsRes.stats.replies : 0;

                // Update Stats
                setStats(prev => prev.map(stat => {
                    if (stat.label === "Pages Connected") return { ...stat, value: pageCount.toString() };
                    if (stat.label === "Posts Created") return { ...stat, value: postsCount.toString() };
                    if (stat.label === "Auto-Replies") return { ...stat, value: repliesCount.toString() };
                    return stat;
                }));
            } catch (err) {
                console.error("Failed to fetch profile stats:", err);
            }
        };

        if (user) fetchStats();
    }, [user]);

    // 🕒 Mock Activity
    const activities = [
        { id: 1, action: "Logged in from new device", time: "2 hours ago", icon: User },
        { id: 2, action: "Scheduled a new post", time: "5 hours ago", icon: Video },
        { id: 3, action: "Updated auto-reply rules", time: "1 day ago", icon: MessageSquare },
        { id: 4, action: "Connected 'Gaming Hub' page", time: "2 days ago", icon: ShieldCheck },
    ];

    // 🖼️ Handle Cover Upload
    const handleCoverChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Optimistic UI Update (optional, but good for UX)
        // For now, we'll wait for the upload to finish

        try {
            const uploadRes = await authAPI.uploadCover(file);
            if (uploadRes.success) {
                const updateRes = await updateUser({ coverImage: uploadRes.file.url });
                if (updateRes.success) {
                    // Success toast or notification could go here
                }
            }
        } catch (err) {
            console.error("Failed to upload cover:", err);
            // Error toast
        }
    };

    // 👤 Handle Avatar Upload
    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const uploadRes = await authAPI.uploadAvatar(file);
            if (uploadRes.success) {
                const updateRes = await updateUser({ avatar: uploadRes.file.url });
                if (updateRes.success) {
                    // Success toast
                }
            }
        } catch (err) {
            console.error("Failed to upload avatar:", err);
        }
    };

    return (
        <DashboardLayout>
            {/* 🖼️ Hero Section */}
            <div className="relative mb-24">
                {/* Cover Image */}
                <div className="h-40 md:h-64 w-full rounded-2xl bg-gray-200 dark:bg-gray-800 overflow-hidden relative group">
                    {user?.coverImage ? (
                        <img
                            src={user.coverImage}
                            alt="Cover"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
                    )}

                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />

                    <div className="absolute bottom-4 right-4 z-10">
                        <label className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-lg text-xs md:text-sm font-medium transition-colors cursor-pointer">
                            <Camera size={14} className="md:w-4 md:h-4" />
                            <span className="hidden sm:inline">Change Cover</span>
                            <span className="sm:hidden">Cover</span>
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleCoverChange}
                            />
                        </label>
                    </div>
                </div>

                {/* Avatar & Info Overlay */}
                <div className="absolute -bottom-16 left-4 md:left-10 flex items-end gap-4 md:gap-6">
                    <div className="relative group">
                        <div className="w-28 h-28 md:w-40 md:h-40 rounded-full border-4 border-white dark:border-gray-900 bg-white dark:bg-gray-800 shadow-xl overflow-hidden flex items-center justify-center text-3xl md:text-4xl font-bold text-gray-400 relative">
                            {user?.avatar ? (
                                <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                user?.name?.[0] || "U"
                            )}

                            {/* Avatar Upload Overlay */}
                            <label className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <Camera className="text-white w-8 h-8" />
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                />
                            </label>
                        </div>
                    </div>

                    <div className="mb-1 md:mb-4">
                        <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            {user?.name || "User Name"}
                            {isDemo && (
                                <span className="px-2 py-0.5 text-[10px] md:text-xs bg-yellow-100 text-yellow-800 rounded-full font-medium">
                                    DEMO
                                </span>
                            )}
                        </h1>
                        <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-medium">
                            {user?.role || "Administrator"}
                        </p>
                    </div>
                </div>

                {/* Edit Profile Button (Desktop & Mobile) */}
                <div className="absolute -bottom-12 right-4 md:right-6">
                    <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 md:px-6 md:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-lg shadow-blue-500/30 transition-all active:scale-95 text-sm md:text-base"
                    >
                        <Edit2 size={16} className="md:w-[18px] md:h-[18px]" />
                        <span className="hidden sm:inline">Edit Profile</span>
                        <span className="sm:hidden">Edit</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
                {/* 👈 Left Column: Info & Stats */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {stats.map((stat, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center text-center hover:shadow-md transition-shadow"
                            >
                                <div className={`p-3 rounded-full mb-3 ${stat.bg} ${stat.color}`}>
                                    <stat.icon size={24} />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {stat.value}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {stat.label}
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Personal Info */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                Personal Information
                            </h3>
                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="text-blue-600 hover:text-blue-700 text-sm font-medium md:hidden"
                            >
                                Edit
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Full Name
                                </label>
                                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200 font-medium">
                                    <User size={18} className="text-gray-400" />
                                    {user?.name || "N/A"}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Email Address
                                </label>
                                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200 font-medium">
                                    <Mail size={18} className="text-gray-400" />
                                    {user?.email || "N/A"}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Location
                                </label>
                                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200 font-medium">
                                    <MapPin size={18} className="text-gray-400" />
                                    Phnom Penh, Cambodia
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Joined
                                </label>
                                <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200 font-medium">
                                    <Calendar size={18} className="text-gray-400" />
                                    November 2023
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 👉 Right Column: Activity */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <Activity size={20} className="text-blue-500" />
                            Recent Activity
                        </h3>

                        <div className="space-y-6">
                            {activities.map((activity, index) => (
                                <div key={activity.id} className="flex gap-4 relative">
                                    {/* Timeline Line */}
                                    {index !== activities.length - 1 && (
                                        <div className="absolute left-5 top-10 bottom-[-24px] w-0.5 bg-gray-100 dark:bg-gray-700" />
                                    )}

                                    <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center shrink-0 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-600">
                                        <activity.icon size={18} />
                                    </div>

                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
                                            {activity.action}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            {activity.time}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button className="w-full mt-6 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                            View All Activity
                        </button>
                    </div>
                </div>
            </div>

            {/* Edit Profile Modal */}
            <EditProfileModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
            />
        </DashboardLayout>
    );
}
