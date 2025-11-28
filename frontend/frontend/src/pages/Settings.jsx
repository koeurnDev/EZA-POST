// ============================================================
// ⚙️ Settings.jsx — User Preferences
// ============================================================

import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion"; // eslint-disable-line no-unused-vars
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { User, LogOut, Moon, Sun, Shield, Mail, Bell, CheckCircle2, Edit2, RefreshCw, ExternalLink, AlertCircle, Settings as SettingsIcon, MessageSquare, Calendar, Radio } from "lucide-react";
import EditProfileModal from "../components/EditProfileModal";
import apiUtils from "../utils/apiUtils";


export default function Settings() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // 📘 Facebook Pages State
    const [pages, setPages] = useState([]);
    const [isLoadingPages, setIsLoadingPages] = useState(false);
    const [pageError, setPageError] = useState(null);
    const [expandedPageId, setExpandedPageId] = useState(null); // For settings dropdown

    // Fetch Pages on Mount if Connected
    useEffect(() => {
        if (user?.facebookId) {
            fetchPages();
        }
    }, [user?.facebookId]);

    const fetchPages = async () => {
        setIsLoadingPages(true);
        setPageError(null);
        try {
            const res = await apiUtils.getUserPages();
            if (res.data.success) {
                setPages(res.data.accounts);
            } else {
                setPageError("Failed to load pages.");
            }
        } catch (err) {
            console.error("Failed to fetch pages:", err);
            setPageError("Could not load pages. Please try syncing again.");
        } finally {
            setIsLoadingPages(false);
        }
    };

    const handleTogglePage = async (pageId, currentStatus) => {
        // Optimistic Update
        setPages(prev => prev.map(p => p.id === pageId ? { ...p, isSelected: !currentStatus } : p));

        try {
            await apiUtils.toggleUserPage(pageId, !currentStatus);
        } catch (err) {
            console.error("Failed to toggle page:", err);
            // Revert on error
            setPages(prev => prev.map(p => p.id === pageId ? { ...p, isSelected: currentStatus } : p));
        }
    };

    const handleUpdateSetting = async (pageId, settingKey, newValue) => {
        // Optimistic Update
        setPages(prev => prev.map(p => {
            if (p.id === pageId) {
                return {
                    ...p,
                    settings: { ...p.settings, [settingKey]: newValue }
                };
            }
            return p;
        }));

        try {
            // Find current settings to merge
            const page = pages.find(p => p.id === pageId);
            const newSettings = { ...page.settings, [settingKey]: newValue };

            await apiUtils.updatePageSettings(pageId, newSettings);
        } catch (err) {
            console.error("Failed to update setting:", err);
            // Revert (fetch pages again to be safe)
            fetchPages();
        }
    };

    const handleReRequest = () => {
        const authUrl = `${(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "")}/api/auth/facebook?auth_type=rerequest`;
        window.location.href = authUrl;
    };

    return (
        <DashboardLayout>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Settings
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Manage your account and application preferences.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 👤 Profile Card */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <User className="text-blue-500" size={20} />
                                Profile Information
                            </h3>
                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            >
                                <Edit2 size={16} />
                                Edit
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xl font-bold overflow-hidden">
                                    {user?.avatar ? (
                                        <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        user?.name?.[0] || "U"
                                    )}
                                </div>
                                <div>
                                    <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {user?.name || "User Name"}
                                    </h4>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 mt-1">
                                        <Shield size={12} />
                                        {user?.role || "Admin"}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                                        Full Name
                                    </label>
                                    <div className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                                        {user?.name || "N/A"}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                                        Email Address
                                    </label>
                                    <div className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white flex items-center gap-2">
                                        <Mail size={16} className="text-gray-400" />
                                        {user?.email || "N/A"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 📘 Facebook Connection & Pages */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                            <div className="w-6 h-6 bg-[#1877f2] text-white rounded flex items-center justify-center text-sm font-bold">f</div>
                            Facebook Integration
                        </h3>

                        {!user?.facebookId ? (
                            <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                <p className="text-gray-500 dark:text-gray-400 mb-4">Connect your account to manage pages and schedule posts.</p>
                                <a
                                    href={`${(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "")}/api/auth/facebook`}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#1877f2] hover:bg-[#166fe5] text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/20"
                                >
                                    Connect Facebook
                                </a>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Connected Profile Header */}
                                <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-white rounded-full p-0.5 shadow-sm overflow-hidden">
                                            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 font-bold">
                                                {user.facebookName?.[0] || "F"}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">
                                                {user.facebookName || "Facebook User"}
                                            </p>
                                            <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                                <CheckCircle2 size={12} /> Connected
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={fetchPages}
                                            disabled={isLoadingPages}
                                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
                                            title="Sync Pages"
                                        >
                                            <RefreshCw size={18} className={isLoadingPages ? "animate-spin" : ""} />
                                        </button>
                                    </div>
                                </div>

                                {/* Page Selection List */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-medium text-gray-900 dark:text-white">Select Pages to Manage</h4>
                                        <button
                                            onClick={handleReRequest}
                                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                        >
                                            Can't find a page? <ExternalLink size={10} />
                                        </button>
                                    </div>

                                    {isLoadingPages ? (
                                        <div className="space-y-3">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                                            ))}
                                        </div>
                                    ) : pageError ? (
                                        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-2 text-sm">
                                            <AlertCircle size={16} />
                                            {pageError}
                                        </div>
                                    ) : pages.length === 0 ? (
                                        <div className="text-center py-6 text-gray-500 text-sm">
                                            No pages found. Try syncing or checking permissions.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {pages.map(page => (
                                                <div key={page.id} className="bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden transition-all">
                                                    <div className="flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-800/50">
                                                        <div className="flex items-center gap-3">
                                                            <img
                                                                src={page.picture || "https://via.placeholder.com/40"}
                                                                alt={page.name}
                                                                className="w-10 h-10 rounded-full bg-gray-200 object-cover"
                                                            />
                                                            <div>
                                                                <p className="font-medium text-gray-900 dark:text-white">{page.name}</p>
                                                                <p className="text-xs text-gray-500">ID: {page.id}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => setExpandedPageId(expandedPageId === page.id ? null : page.id)}
                                                                className={`p-2 rounded-lg transition-colors ${expandedPageId === page.id ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                                            >
                                                                <SettingsIcon size={18} />
                                                            </button>
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only peer"
                                                                    checked={page.isSelected}
                                                                    onChange={() => handleTogglePage(page.id, page.isSelected)}
                                                                />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                            </label>
                                                        </div>
                                                    </div>

                                                    {/* ⚙️ Page Settings Dropdown */}
                                                    <AnimatePresence>
                                                        {expandedPageId === page.id && page.isSelected && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: "auto", opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 space-y-3"
                                                            >
                                                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Page Configuration</p>

                                                                {/* Auto-Reply Bot */}
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                                        <MessageSquare size={16} className="text-purple-500" />
                                                                        <span>Auto-Reply Bot</span>
                                                                    </div>
                                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="sr-only peer"
                                                                            checked={page.settings?.enableBot}
                                                                            onChange={(e) => handleUpdateSetting(page.id, "enableBot", e.target.checked)}
                                                                        />
                                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                                                                    </label>
                                                                </div>

                                                                {/* Scheduled Posts */}
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                                        <Calendar size={16} className="text-orange-500" />
                                                                        <span>Scheduled Posts</span>
                                                                    </div>
                                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="sr-only peer"
                                                                            checked={page.settings?.enableSchedule !== false}
                                                                            onChange={(e) => handleUpdateSetting(page.id, "enableSchedule", e.target.checked)}
                                                                        />
                                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                                                                    </label>
                                                                </div>

                                                                {/* Inbox Listener */}
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                                        <Radio size={16} className="text-blue-500" />
                                                                        <span>Inbox Listener</span>
                                                                    </div>
                                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="sr-only peer"
                                                                            checked={page.settings?.enableInbox}
                                                                            onChange={(e) => handleUpdateSetting(page.id, "enableInbox", e.target.checked)}
                                                                        />
                                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                                    </label>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 🔔 Notifications (Existing) */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                            <Bell className="text-yellow-500" size={20} />
                            Notifications
                        </h3>
                        {/* ... Existing Notification Content ... */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">Email Notifications</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Receive updates about your scheduled posts.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" defaultChecked />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ⚙️ Preferences Column (Existing) */}
                <div className="space-y-6">
                    {/* Theme Preferences */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">
                            Preferences
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${theme === "dark" ? "bg-indigo-500 text-white" : "bg-orange-500 text-white"}`}>
                                        {theme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">Appearance</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {theme === "dark" ? "Dark Mode" : "Light Mode"}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={toggleTheme}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${theme === "dark" ? "bg-blue-600" : "bg-gray-300"}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === "dark" ? "translate-x-6" : "translate-x-1"}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 🚪 Danger Zone */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">
                            Danger Zone
                        </h3>
                        <button
                            onClick={logout}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium transition-colors"
                        >
                            <LogOut size={18} />
                            Sign Out
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
