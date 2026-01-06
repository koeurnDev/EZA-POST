// ============================================================
// ⚙️ Settings.jsx — User Preferences
// ============================================================

import React, { useState, useEffect } from "react";
import axios from "axios";
import DashboardLayout from "../layouts/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { LogOut, Moon, Sun, Bell, CheckCircle2, RefreshCw, ExternalLink, AlertCircle, Settings as SettingsIcon, MessageSquare, Calendar, Radio, Shield } from "lucide-react";
import EditProfileModal from "../components/EditProfileModal";
import apiUtils from "../utils/apiUtils";
import toast from "react-hot-toast";
import EmptyState from "../components/ui/EmptyState";


export default function Settings() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // 📘 Facebook Pages State
    const [pages, setPages] = useState([]);
    const [isLoadingPages, setIsLoadingPages] = useState(false);
    const [pageError, setPageError] = useState(null);
    const [expandedPageId, setExpandedPageId] = useState(null); // For settings dropdown

    // 🔐 2FA State
    const [qrCode, setQrCode] = useState(null);
    const [verifyCode, setVerifyCode] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);

    // Fetch Pages on Mount if Connected
    useEffect(() => {
        if (user?.facebookId) {
            fetchPages();
        }
    }, [user?.facebookId]);

    // ✅ Auto-Refresh on Connect Success
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("success") === "facebook_connected") {
            toast.success("✅ Facebook Connected Successfully!");

            // 1. Clear URL param
            window.history.replaceState({}, document.title, window.location.pathname);

            // 2. Refresh Auth (Fetch updated user with FB ID)
            // This will trigger the useEffect above to fetch pages
            window.location.reload(); // Simple reload to ensure fresh state
        }
    }, []);

    const fetchPages = async () => {
        setIsLoadingPages(true);
        setPageError(null);
        try {
            // 🔄 Retry up to 3 times for network errors
            const res = await apiUtils.retryRequest(() => apiUtils.getUserPages());

            if (res.data.success) {
                setPages(res.data.accounts);
                if (res.data.accounts.length > 0) {
                    toast.success("Pages synced successfully!");
                }
            } else {
                throw new Error("Failed to load pages.");
            }
        } catch (err) {
            apiUtils.logError("Settings.fetchPages", err);
            const message = apiUtils.getUserErrorMessage(err);
            setPageError(message);

            // Only show toast if it's not a persistent UI error (avoid double noise)
            if (!apiUtils.isAuthError(err)) {
                toast.error(message);
            }
        } finally {
            setIsLoadingPages(false);
        }
    };

    const handleReRequest = () => {
        window.location.href = `${(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "")}/api/auth/facebook?rerequest=true`;
    };

    const handleTogglePage = async (pageId, currentStatus) => {
        // Optimistic Update
        setPages(prev => prev.map(p => p.id === pageId ? { ...p, isSelected: !currentStatus } : p));
        const toastId = toast.loading(currentStatus ? "Deactivating page..." : "Activating page...");

        try {
            await apiUtils.toggleUserPage(pageId, !currentStatus);
            toast.success(currentStatus ? "Page deactivated" : "Page activated", { id: toastId });
        } catch (err) {
            console.error("Failed to toggle page:", err);
            // Revert on error
            setPages(prev => prev.map(p => p.id === pageId ? { ...p, isSelected: currentStatus } : p));
            toast.error("Failed to update page status", { id: toastId });
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
            toast.success("Settings updated");
        } catch (err) {
            console.error("Failed to update setting:", err);
            // Revert (fetch pages again to be safe)
            fetchPages();
            toast.error("Failed to save settings");
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Settings</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Manage your connected accounts and application preferences.</p>
                </div>

                {!user?.facebookId ? (
                    <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ExternalLink size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Connect Your Account</h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto text-lg leading-relaxed">
                            Link your Facebook account to unlock page management, auto-scheduling, and powerful analytics.
                        </p>
                        <a
                            href={`${(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "")}/api/auth/facebook`}
                            className="inline-flex items-center gap-3 px-8 py-4 bg-[#1877f2] hover:bg-[#166fe5] text-white font-semibold rounded-2xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-1"
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                            Connect Facebook
                        </a>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* 👈 Left Column: Main Content (Pages) */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Connected Profile Card */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                                    <div className="relative">
                                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-2xl font-bold text-gray-500 dark:text-gray-400 border-4 border-white dark:border-gray-800 shadow-md">
                                            {user.facebookName?.[0] || "F"}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-1 rounded-full border-4 border-white dark:border-gray-800">
                                            <CheckCircle2 size={14} />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                            {user.facebookName || "Facebook User"}
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Connected via Facebook</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleReRequest}
                                    className="w-full sm:w-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-medium transition-colors"
                                >
                                    Reconnect
                                </button>
                            </div>

                            {/* Pages List */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                                <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        Your Pages
                                        <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded-full font-bold">
                                            {pages.length}
                                        </span>
                                    </h3>
                                    <button onClick={fetchPages} className="p-2 text-gray-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                        <RefreshCw size={18} />
                                    </button>
                                </div>

                                <div className="p-6 space-y-4">
                                    {isLoadingPages ? (
                                        [1, 2].map(i => <div key={i} className="h-24 bg-gray-50 dark:bg-gray-700/50 rounded-2xl animate-pulse" />)
                                    ) : pages.length === 0 ? (
                                        <EmptyState title="No Pages Found" description="We couldn't find any pages." actionLabel="Refresh" onAction={fetchPages} />
                                    ) : (
                                        pages.map(page => (
                                            <div key={page.id} className={`group border rounded-2xl transition-all duration-300 ${page.isSelected ? "bg-blue-50/30 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"}`}>
                                                <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                    <div className="flex items-center gap-4 w-full sm:w-auto">
                                                        <img
                                                            src={page.picture || "https://via.placeholder.com/50"}
                                                            alt={page.name}
                                                            className="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm shrink-0"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                        <div className="min-w-0">
                                                            <h4 className={`font-bold text-lg truncate ${page.isSelected ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>
                                                                {page.name}
                                                            </h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${page.isSelected ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${page.isSelected ? "bg-green-500" : "bg-gray-400"}`} />
                                                                    {page.isSelected ? "Active" : "Inactive"}
                                                                </span>
                                                                <span className="text-xs text-gray-400 font-mono">ID: {page.id}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                                        {page.isSelected && (
                                                            <button
                                                                onClick={() => setExpandedPageId(expandedPageId === page.id ? null : page.id)}
                                                                className={`p-2.5 rounded-xl transition-all ${expandedPageId === page.id ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"}`}
                                                            >
                                                                <SettingsIcon size={20} />
                                                            </button>
                                                        )}
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={page.isSelected}
                                                                onChange={() => handleTogglePage(page.id, page.isSelected)}
                                                            />
                                                            <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                                        </label>
                                                    </div>
                                                </div>

                                                <AnimatePresence>
                                                    {expandedPageId === page.id && page.isSelected && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/30 px-5 py-5"
                                                        >
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                                {[
                                                                    { key: "enableBot", label: "Auto-Reply", icon: MessageSquare, color: "purple" },
                                                                    { key: "enableSchedule", label: "Scheduling", icon: Calendar, color: "orange" },
                                                                    { key: "enableInbox", label: "Inbox Sync", icon: Radio, color: "blue" }
                                                                ].map((setting) => (
                                                                    <div key={setting.key} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between gap-3 hover:border-blue-200 dark:hover:border-blue-800 transition-colors">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`p-2 rounded-xl bg-${setting.color}-100 text-${setting.color}-600 dark:bg-${setting.color}-900/30 dark:text-${setting.color}-400`}>
                                                                                <setting.icon size={18} />
                                                                            </div>
                                                                            <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">{setting.label}</span>
                                                                        </div>
                                                                        <div className="flex justify-end">
                                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="sr-only peer"
                                                                                    checked={setting.key === "enableSchedule" ? page.settings?.enableSchedule !== false : page.settings?.[setting.key]}
                                                                                    onChange={(e) => handleUpdateSetting(page.id, setting.key, e.target.checked)}
                                                                                />
                                                                                <div className={`w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-${setting.color}-500`}></div>
                                                                            </label>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 👉 Right Column: Sidebar (Preferences) */}
                        <div className="space-y-6">
                            {/* Theme & Appearance */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Appearance</h3>
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl ${theme === "dark" ? "bg-indigo-500 text-white" : "bg-orange-500 text-white"}`}>
                                            {theme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-white">Dark Mode</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{theme === "dark" ? "On" : "Off"}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={toggleTheme}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${theme === "dark" ? "bg-indigo-600" : "bg-gray-300"}`}
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${theme === "dark" ? "translate-x-6" : "translate-x-1"}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Security & 2FA */}
                            <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Security</h3>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg dark:bg-indigo-900/30 dark:text-indigo-400">
                                                <Shield size={18} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Two-Factor Auth</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.twoFactorEnabled ? "Enabled" : "Disabled"}</p>
                                            </div>
                                        </div>

                                        {!user?.twoFactorEnabled ? (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const res = await axios.post(apiUtils.getFullUrl("/auth/2fa/setup"), {}, { withCredentials: true });
                                                        if (res.data.success) {
                                                            setQrCode(res.data.qrCode);
                                                            setIsVerifying(true);
                                                        }
                                                    } catch (err) {
                                                        console.error("❌ 2FA Setup Error:", err);
                                                        const msg = err.response?.data?.error || err.message || "Failed to start 2FA setup";
                                                        toast.error(msg);
                                                    }
                                                }}
                                                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                Enable
                                            </button>
                                        ) : (
                                            <button
                                                onClick={async () => {
                                                    if (!window.confirm("Are you sure you want to disable 2FA?")) return;
                                                    try {
                                                        await axios.post(apiUtils.getFullUrl("/auth/2fa/disable"), {}, { withCredentials: true });
                                                        window.location.reload();
                                                    } catch (err) {
                                                        console.error("❌ 2FA Disable Error:", err);
                                                        toast.error("Failed to disable 2FA");
                                                    }
                                                }}
                                                className="px-3 py-1.5 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 transition-colors"
                                            >
                                                Disable
                                            </button>
                                        )}
                                    </div>

                                    {/* QR Code & Verify Input */}
                                    {isVerifying && !user?.twoFactorEnabled && qrCode && (
                                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                                            <p className="text-xs text-center text-gray-500 mb-3">Scan with Google Authenticator</p>
                                            <img src={qrCode} alt="2FA QR" className="w-32 h-32 mx-auto rounded-lg mb-4" />

                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Enter Code (e.g. 123456)"
                                                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                    onChange={(e) => setVerifyCode(e.target.value)}
                                                />
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const res = await axios.post(apiUtils.getFullUrl("/auth/2fa/verify"), { token: verifyCode }, { withCredentials: true });
                                                            if (res.data.success) {
                                                                toast.success("2FA Enabled Successfully!");
                                                                window.location.reload();
                                                            }
                                                        } catch (err) {
                                                            console.error("❌ 2FA Verify Error:", err);
                                                            toast.error("Invalid Code");
                                                        }
                                                    }}
                                                    className="px-3 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                                                >
                                                    <CheckCircle2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Notifications */}
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Notifications</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg dark:bg-yellow-900/30 dark:text-yellow-400">
                                            <Bell size={18} />
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Alerts</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked />
                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Stealth Mode & Security */}
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Anti-Ban & Stealth 🥷</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex flex-col justify-between h-32">
                                    <div className="flex items-start justify-between">
                                        <div className="p-2.5 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.2-2.85.577-4.147" /></svg>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" defaultChecked onClick={() => toast.success("Stealth Mode: ON (Fingerprints Randomized)")} />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                                        </label>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">Fingerprint Spoofer</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Randomize Headers/UA</p>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex flex-col justify-between h-32">
                                    <div className="flex items-start justify-between">
                                        <div className="p-2.5 rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" defaultChecked onClick={() => toast.success("Action Randomizer: ON (Delays Active)")} />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
                                        </label>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">Action Randomizer</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Human-like Delays (Jitter)</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Google Drive Integration */}
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Cloud Backup</h3>
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                                        <svg className="w-5 h-5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="m6.6 66.85 25.3-43.8 25.3 43.8z" fill="#0066da" /><path d="m43.65 23.05-25.3 43.8h25.3z" fill="#43a047" /><path d="m73.55 66.85-6.35-10.95-18.95-32.9-6.35-10.95 25.3 43.8z" fill="#0066da" /><path d="m24.6 23.05 19.05 32.9h38.65l-19.05-32.9z" fill="#43a047" /><path d="m.25 66.85 19.05 32.9h65.8l-19.05-32.9z" fill="#cddca3" /><path d="m19.6 66.85 24.05-41.55 24.35 41.55z" fill="#00ad45" /><path d="m43.65 25.3-19.05 32.9h38.1z" fill="#ea4335" /><path d="m.25 66.85 6.35-10.95 6.35 11.05z" fill="#0066da" /><path d="m24.6 23.05-6.35-11.05-6.35 11.05z" fill="#ea4335" /><path d="m43.65 23.05-6.35-11.05 6.35-10.95 6.35 10.95 6.35 11.05z" fill="#ffd04b" /></svg>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">Google Drive</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Auto-backup edited videos</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toast.success("Feature coming soon: Please upload 'service_account_key.json' to server root manually for now.")}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-medium transition-colors"
                                >
                                    Configured
                                </button>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="bg-red-50 dark:bg-red-900/10 rounded-3xl p-4 md:p-6 border border-red-100 dark:border-red-900/30">
                            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4">Danger Zone</h3>
                            <button
                                onClick={logout}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-semibold border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shadow-sm"
                            >
                                <LogOut size={18} />
                                Sign Out
                            </button>
                        </div>
                    </div>
                )}

                <EditProfileModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                />
            </div>
        </DashboardLayout >
    );
}
