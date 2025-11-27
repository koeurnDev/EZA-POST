// ============================================================
// ⚙️ Settings.jsx — User Preferences
// ============================================================

import React, { useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { User, LogOut, Moon, Sun, Shield, Mail, Bell, CheckCircle2, Edit2 } from "lucide-react";
import EditProfileModal from "../components/EditProfileModal";

export default function Settings() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

                    {/* 🔔 Notifications */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                            <Bell className="text-yellow-500" size={20} />
                            Notifications
                        </h3>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">Email Notifications</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Receive updates about your scheduled posts.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" defaultChecked />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">Push Notifications</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Get notified when a post is published.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" defaultChecked />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ⚙️ Preferences Column */}
                <div className="space-y-6">
                    {/* Theme Preferences */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">
                            Preferences
                        </h3>

                        <div className="space-y-4">
                            {/* Theme Toggle */}
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
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${theme === "dark" ? "bg-blue-600" : "bg-gray-300"
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === "dark" ? "translate-x-6" : "translate-x-1"
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 🔗 Connected Accounts */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">
                            Connected Accounts
                        </h3>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-[#1877f2] text-white rounded-lg flex items-center justify-center text-xl font-bold">
                                        f
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">Facebook</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {user?.facebookId ? "Connected" : "Not connected"}
                                        </p>
                                    </div>
                                </div>
                                {user?.facebookId ? (
                                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg text-sm font-medium">
                                        <CheckCircle2 size={16} />
                                        <span>Linked</span>
                                    </div>
                                ) : (
                                    <a
                                        href={`${(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "")}/api/auth/facebook`}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        Connect
                                    </a>
                                )}
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
