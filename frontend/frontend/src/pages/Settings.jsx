// ============================================================
// ⚙️ Settings.jsx — User Preferences
// ============================================================

import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { LogOut, Moon, Sun, Bell, CheckCircle2, RefreshCw, ExternalLink, AlertCircle, Settings as SettingsIcon, MessageSquare, Calendar, Radio } from "lucide-react";
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
            <div className="p-6">
                {!user?.facebookId ? (
                    <div className="text-center py-10 bg-gray-50 dark:bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ExternalLink size={24} />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Connect Your Account</h4>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
                            Link your Facebook account to manage pages, schedule posts, and view analytics.
                        </p>
                        <a
                            href={`${(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "")}/api/auth/facebook`}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1877f2] hover:bg-[#166fe5] text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:-translate-y-0.5"
                        >
                            Connect Facebook
                        </a>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Connected Profile */}
                        <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl">
                            <div className="w-12 h-12 bg-white p-0.5 rounded-full shadow-sm">
                                <div className="w-full h-full bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold text-lg">
                                    {user.facebookName?.[0] || "F"}
                                </div>
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 dark:text-white text-lg">
                                    {user.facebookName || "Facebook User"}
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
                                    <CheckCircle2 size={12} /> Account Connected
                                </p>
                            </div>
                        </div>

                        {/* Page Selection List */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    Select Pages to Manage
                                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                                        {pages.length}
                                    </span>
                                </h4>
                                <button
                                    onClick={handleReRequest}
                                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                                >
                                    Missing pages? Click here to reconnect
                                </button>
                            </div>

                            {isLoadingPages ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                                    ))}
                                </div>
                            ) : pageError ? (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm border border-red-100 dark:border-red-900/30">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle size={16} />
                                        <span>{pageError}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {pageError.includes("session") || pageError.includes("token") ? (
                                            <button
                                                onClick={handleReRequest}
                                                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-700 dark:text-red-200 rounded-lg text-xs font-medium transition-colors"
                                            >
                                                Reconnect Facebook
                                            </button>
                                        ) : (
                                            <button
                                                onClick={fetchPages}
                                                className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                                            >
                                                <RefreshCw size={12} /> Retry
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : pages.length === 0 ? (
                                <EmptyState
                                    title="No Pages Found"
                                    description="We couldn't find any Facebook Pages linked to your account."
                                    actionLabel="Check Permissions"
                                    onAction={handleReRequest}
                                />
                            ) : (
                                <div className="space-y-3">
                                    {pages.map(page => (
                                        <div key={page.id} className={`group border rounded-xl overflow-hidden transition-all ${page.isSelected ? "bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-900 shadow-sm" : "bg-gray-50 dark:bg-gray-900/30 border-gray-100 dark:border-gray-800 opacity-70 hover:opacity-100"}`}>
                                            {/* ... Page Item Content ... */}
                                            <div className="flex items-center justify-between p-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative">
                                                        <img
                                                            src={page.picture || "https://via.placeholder.com/40"}
                                                            alt={page.name}
                                                            className={`w-12 h-12 rounded-full object-cover border-2 ${page.isSelected ? "border-blue-500" : "border-gray-200 dark:border-gray-700"}`}
                                                        />
                                                        {page.isSelected && (
                                                            <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-0.5 rounded-full border-2 border-white dark:border-gray-800">
                                                                <CheckCircle2 size={10} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className={`font-bold ${page.isSelected ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>
                                                            {page.name}
                                                        </p>
                                                        <p className="text-xs text-gray-400 font-mono">ID: {page.id}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    {page.isSelected && (
                                                        <button
                                                            onClick={() => setExpandedPageId(expandedPageId === page.id ? null : page.id)}
                                                            className={`p-2 rounded-lg transition-colors ${expandedPageId === page.id ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                                            title="Page Settings"
                                                        >
                                                            <SettingsIcon size={20} />
                                                        </button>
                                                    )}

                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-xs font-medium ${page.isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`}>
                                                            {page.isSelected ? "Active" : "Inactive"}
                                                        </span>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={page.isSelected}
                                                                onChange={() => handleTogglePage(page.id, page.isSelected)}
                                                            />
                                                            <div className="w-12 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 shadow-inner"></div>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ⚙️ Page Settings Dropdown */}
                                            <AnimatePresence>
                                                {expandedPageId === page.id && page.isSelected && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 px-4 py-4 space-y-4"
                                                    >
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            {/* Auto-Reply Bot */}
                                                            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                                    <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                                                                        <MessageSquare size={16} />
                                                                    </div>
                                                                    Auto-Reply
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
                                                            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                                    <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg">
                                                                        <Calendar size={16} />
                                                                    </div>
                                                                    Scheduling
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
                                                            <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                                                                        <Radio size={16} />
                                                                    </div>
                                                                    Inbox Sync
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

                {/* 🔔 Notifications (Existing) */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mt-6">
                    <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                        <Bell className="text-yellow-500" size={20} />
                        Notifications
                    </h3>
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

                {/* ⚙️ Preferences Column (Existing) */}
                <div className="space-y-6 mt-6">
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
