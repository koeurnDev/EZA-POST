// ============================================================
// ⚙️ Settings.jsx — Elite Command Center 2026
// ============================================================

import React, { useState, useEffect } from "react";
import axios from "axios";
import DashboardLayout from "../layouts/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { 
    LogOut, Moon, Sun, CheckCircle2, 
    Fingerprint, Zap, Cpu, Cloud, ShieldCheck
} from "lucide-react";
import EditProfileModal from "../components/EditProfileModal";
import apiUtils from "../utils/apiUtils";
import toast from "react-hot-toast";

export default function Settings() {
    const MotionDiv = motion.div;
    const MotionAnimatePresence = AnimatePresence;
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // 🔐 2FA State
    const [qrCode, setQrCode] = useState(null);
    const [verifyCode, setVerifyCode] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);

    // 📄 Facebook Pages State
    const [pages, setPages] = useState([]);
    const [loadingPages, setLoadingPages] = useState(true);

    useEffect(() => {
        const fetchPages = async () => {
            try {
                const res = await apiUtils.getUserPages();
                if (res.data.success) {
                    // Filter to only show selected/active pages in the hub
                    setPages(res.data.accounts.filter(p => p.isSelected) || []);
                }
            } catch (err) {
                console.error("Failed to fetch pages in settings", err);
            } finally {
                setLoadingPages(false);
            }
        };
        fetchPages();
    }, []);

    return (
        <DashboardLayout>
            {/* Mesh Gradient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20 dark:opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12 relative z-10">
                {/* Header */}
                <div className="mb-8 md:mb-12 px-1">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">
                            App Setup
                        </div>
                        <div className="h-px w-12 bg-blue-500/20" />
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white tracking-tighter mb-4">
                        Settings <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Hub.</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium text-sm md:text-lg max-w-2xl leading-relaxed">
                        Set up your account, security, and preferences from this simple page.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                    {/* 👈 Left Column: Profile Settings */}
                    <div className="lg:col-span-8 space-y-6 md:space-y-8">
                        <MotionDiv 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-white/20 dark:border-white/5 shadow-xl"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white tracking-tight">Profile Setup</h3>
                                <button 
                                    onClick={() => setIsEditModalOpen(true)}
                                    className="h-10 px-4 md:px-6 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/20"
                                >
                                    Edit Profile
                                </button>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6 mb-4 md:mb-8">
                                <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-2xl md:rounded-[1.8rem] flex items-center justify-center text-3xl md:text-4xl font-black text-white shadow-2xl">
                                    {user?.name?.[0] || "U"}
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight">{user?.name || "User"}</h4>
                                    <p className="text-gray-500 font-medium mt-1 text-sm md:text-base truncate max-w-[280px] md:max-w-none">{user?.email}</p>
                                    <div className="mt-3 px-3 py-1 bg-emerald-500/10 text-emerald-500 w-fit mx-auto sm:mx-0 rounded text-[10px] font-black uppercase tracking-widest">
                                        {user?.plan || "PRO"} PLAN
                                    </div>
                                </div>
                            </div>
                        </MotionDiv>
                    </div>

                    {/* 👉 Right Column: Preferences & Pages */}
                    <div className="lg:col-span-4 space-y-6 md:space-y-8">
                        {/* Facebook Pages Hub */}
                        <MotionDiv 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-white/20 dark:border-white/5 shadow-xl"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center">
                                        <CheckCircle2 size={18} />
                                    </div>
                                    Pages
                                </h3>
                                <button 
                                    onClick={() => window.location.href = "/connections"}
                                    className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline"
                                >
                                    Manage
                                </button>
                            </div>
                            
                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {loadingPages ? (
                                    <div className="flex justify-center py-8">
                                        <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                    </div>
                                ) : pages.length === 0 ? (
                                    <div className="p-6 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl md:rounded-3xl">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">No pages connected</p>
                                    </div>
                                ) : (
                                    pages.map(page => (
                                        <div key={page.id} className="flex items-center gap-4 p-3 md:p-4 bg-black/5 dark:bg-black/20 rounded-2xl border border-white/5">
                                            <img src={page.picture} alt="" className="w-10 h-10 rounded-xl object-cover" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-[11px] md:text-xs text-gray-900 dark:text-white truncate">{page.name}</p>
                                                <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">Connected</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </MotionDiv>
                        {/* Visual Appearance Protocol */}
                         <MotionDiv 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 border border-white/20 dark:border-white/5 shadow-xl"
                        >
                            <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white mb-8 tracking-tight flex items-center gap-3">
                                <div className="w-8 h-8 bg-orange-500/10 text-orange-500 rounded-lg flex items-center justify-center">
                                    <Zap size={18} />
                                </div>
                                Look
                            </h3>
                            <div className="p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] bg-black/5 dark:bg-black/20 border border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-[0.8rem] md:rounded-[1rem] flex items-center justify-center shadow-2xl transition-all ${theme === "dark" ? "bg-indigo-600 text-white" : "bg-orange-500 text-white"}`}>
                                        {theme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
                                    </div>
                                    <div>
                                        <p className="font-black text-[9px] md:text-[10px] uppercase tracking-widest text-gray-900 dark:text-white">Dark Mode</p>
                                        <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">{theme === "dark" ? "Active" : "Standby"}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={toggleTheme}
                                    className={`w-12 h-7 md:w-14 md:h-8 rounded-full transition-all relative ${theme === "dark" ? "bg-indigo-600 shadow-lg shadow-indigo-600/20" : "bg-gray-200"}`}
                                >
                                    <div className={`absolute top-1 w-5 h-5 md:w-6 md:h-6 rounded-full bg-white transition-all shadow-md ${theme === "dark" ? "left-6 md:left-7" : "left-1"}`} />
                                </button>
                            </div>
                        </MotionDiv>

                    </div>
                </div>

                <EditProfileModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                />
            </div>
        </DashboardLayout>
    );
}
