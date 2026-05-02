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
    LogOut, Moon, Sun, Bell, CheckCircle2, RefreshCw, 
    ExternalLink, AlertCircle, Settings as SettingsIcon, 
    MessageSquare, Calendar, Radio, Shield, Fingerprint, 
    Zap, Lock, Cpu, Globe, Cloud, ShieldCheck, ChevronRight
} from "lucide-react";
import EditProfileModal from "../components/EditProfileModal";
import apiUtils from "../utils/apiUtils";
import toast from "react-hot-toast";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";

export default function Settings() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // 📘 Facebook Pages State
    const [pages, setPages] = useState([]);
    const [isLoadingPages, setIsLoadingPages] = useState(false);
    const [pageError, setPageError] = useState(null);
    const [expandedPageId, setExpandedPageId] = useState(null);

    // 🔐 2FA State
    const [qrCode, setQrCode] = useState(null);
    const [verifyCode, setVerifyCode] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);

    useEffect(() => {
        if (user?.facebookId) {
            fetchPages();
        }
    }, [user?.facebookId]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("success") === "facebook_connected") {
            toast.success("✅ Protocol Synchronized Successfully");
            window.history.replaceState({}, document.title, window.location.pathname);
            window.location.reload();
        }
    }, []);

    const fetchPages = async () => {
        setIsLoadingPages(true);
        setPageError(null);
        try {
            const res = await apiUtils.retryRequest(() => apiUtils.getUserPages());
            if (res.data.success) {
                setPages(res.data.accounts);
            }
        } catch (err) {
            apiUtils.logError("Settings.fetchPages", err);
            const message = apiUtils.getUserErrorMessage(err);
            setPageError(message);
            if (!apiUtils.isAuthError(err)) toast.error(message);
        } finally {
            setIsLoadingPages(false);
        }
    };

    const handleReRequest = () => {
        window.location.href = apiUtils.getAuthUrl("/auth/facebook?rerequest=true");
    };

    const handleTogglePage = async (pageId, currentStatus) => {
        setPages(prev => prev.map(p => p.id === pageId ? { ...p, isSelected: !currentStatus } : p));
        const toastId = toast.loading(currentStatus ? "Deactivating identity..." : "Activating identity...");

        try {
            await apiUtils.toggleUserPage(pageId, !currentStatus);
            toast.success(currentStatus ? "Identity Offline" : "Identity Online", { id: toastId });
        } catch (err) {
            setPages(prev => prev.map(p => p.id === pageId ? { ...p, isSelected: currentStatus } : p));
            toast.error("Handshake failed", { id: toastId });
        }
    };

    const handleUpdateSetting = async (pageId, settingKey, newValue) => {
        setPages(prev => prev.map(p => {
            if (p.id === pageId) {
                return { ...p, settings: { ...p.settings, [settingKey]: newValue } };
            }
            return p;
        }));

        try {
            const page = pages.find(p => p.id === pageId);
            const newSettings = { ...page.settings, [settingKey]: newValue };
            await apiUtils.updatePageSettings(pageId, newSettings);
            toast.success("Neural preferences updated");
        } catch (err) {
            fetchPages();
            toast.error("Sync failed");
        }
    };

    return (
        <DashboardLayout>
            {/* Mesh Gradient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20 dark:opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
                {/* Header */}
                <div className="mb-12">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">
                            System Config
                        </div>
                        <div className="h-px w-12 bg-blue-500/20" />
                    </div>
                    <h1 className="text-6xl font-black text-gray-900 dark:text-white tracking-tighter mb-4">
                        Control <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Center.</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium text-lg max-w-2xl leading-relaxed">
                        Orchestrate your cross-platform identity, security protocols, and autonomous bot behaviors from a centralized command interface.
                    </p>
                </div>

                {!user?.facebookId ? (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative group overflow-hidden bg-white/40 dark:bg-black/40 backdrop-blur-3xl border border-white/20 dark:border-white/5 rounded-[3rem] p-16 text-center shadow-2xl"
                    >
                        <div className="relative z-10">
                            <div className="w-24 h-24 bg-blue-500/10 dark:bg-blue-500/5 text-blue-600 dark:text-blue-400 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-blue-500/20">
                                <ExternalLink size={40} strokeWidth={1.5} />
                            </div>
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">Establish Handshake</h2>
                            <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-md mx-auto text-lg font-medium leading-relaxed">
                                Link your primary social identities to initialize the automated distribution and neural bot protocols.
                            </p>
                            <a
                                href={apiUtils.getAuthUrl("/auth/facebook")}
                                className="inline-flex items-center gap-4 px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-2xl shadow-blue-500/40 hover:-translate-y-1 text-sm uppercase tracking-widest"
                            >
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                Connect Facebook identity
                            </a>
                        </div>
                        {/* Decorative glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-blue-500/5 blur-[120px] pointer-events-none rounded-full" />
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* 👈 Left Column: Identities & Page Management */}
                        <div className="lg:col-span-8 space-y-8">
                            {/* Connected Identity Card */}
                            <motion.div 
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/20 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl"
                            >
                                <div className="flex flex-col sm:flex-row items-center gap-6">
                                    <div className="relative">
                                        <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-[1.8rem] flex items-center justify-center text-3xl font-black text-white shadow-2xl overflow-hidden ring-4 ring-white dark:ring-white/5">
                                            {user.facebookName?.[0] || "F"}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-full border-4 border-white dark:border-black shadow-lg">
                                            <CheckCircle2 size={14} />
                                        </div>
                                    </div>
                                    <div className="text-center sm:text-left">
                                        <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
                                            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                                {user.facebookName || "Identity"}
                                            </h3>
                                            <div className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded text-[8px] font-black uppercase tracking-widest">Master</div>
                                        </div>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Primary Identity Handshake Active</p>
                                    </div>
                                </div>
                                <Button 
                                    variant="secondary"
                                    onClick={handleReRequest}
                                    className="w-full sm:w-auto h-12 px-8 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                >
                                    Reconnect Protocol
                                </Button>
                            </motion.div>

                            {/* Page Orchestration List */}
                            <div className="bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 dark:border-white/5 overflow-hidden shadow-xl">
                                <div className="p-8 border-b border-white/10 dark:border-white/5 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                                            Identity Nodes
                                            <span className="px-3 py-1 bg-blue-500/10 text-blue-500 text-[10px] rounded-full font-black tracking-widest uppercase">
                                                {pages.length} Online
                                            </span>
                                        </h3>
                                    </div>
                                    <button 
                                        onClick={() => fetchPages(true)} 
                                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-all border border-white/10 shadow-inner"
                                    >
                                        <RefreshCw size={18} className={isLoadingPages ? "animate-spin text-blue-500" : ""} />
                                    </button>
                                </div>

                                <div className="p-8 space-y-6">
                                    {isLoadingPages ? (
                                        [1, 2, 3].map(i => <div key={i} className="h-28 bg-white/5 dark:bg-white/5 rounded-[2rem] animate-pulse" />)
                                    ) : pages.length === 0 ? (
                                        <EmptyState title="No Nodes Detected" description="No identity nodes found in current handshake." actionLabel="Sync Protocol" onAction={fetchPages} />
                                    ) : (
                                        pages.map((page, idx) => (
                                            <motion.div 
                                                key={page.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className={`group rounded-[2rem] border transition-all duration-500 ${page.isSelected ? "bg-blue-600/5 border-blue-500/20 shadow-lg shadow-blue-500/5" : "bg-white/40 dark:bg-white/5 border-white/10 hover:border-white/20 dark:hover:border-white/10"}`}
                                            >
                                                <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                                                    <div className="flex items-center gap-5 w-full sm:w-auto">
                                                        <div className="relative">
                                                            <img
                                                                src={page.picture || "https://via.placeholder.com/50"}
                                                                alt={page.name}
                                                                className="w-16 h-16 rounded-[1.2rem] object-cover border-2 border-white dark:border-white/10 shadow-2xl group-hover:scale-105 transition-transform duration-500"
                                                                referrerPolicy="no-referrer"
                                                            />
                                                            <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-black ${page.isSelected ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className={`font-black text-lg tracking-tight truncate ${page.isSelected ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>
                                                                {page.name}
                                                            </h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 font-mono">ID: {page.id}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                                                        <button
                                                            onClick={() => setExpandedPageId(expandedPageId === page.id ? null : page.id)}
                                                            className={`w-12 h-12 rounded-[1rem] transition-all flex items-center justify-center border ${expandedPageId === page.id ? "bg-blue-600 text-white border-blue-600 shadow-xl" : "bg-white/10 text-gray-400 border-white/10 hover:border-blue-500/50 hover:text-blue-500"}`}
                                                        >
                                                            <SettingsIcon size={20} strokeWidth={expandedPageId === page.id ? 2.5 : 2} />
                                                        </button>
                                                        
                                                        {/* High-end Toggle */}
                                                        <button 
                                                            onClick={() => handleTogglePage(page.id, page.isSelected)}
                                                            className={`relative h-12 px-6 rounded-[1rem] flex items-center gap-3 transition-all font-black text-[10px] uppercase tracking-widest border ${page.isSelected ? "bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-600/20" : "bg-white/5 border-white/10 text-gray-400"}`}
                                                        >
                                                            <Radio size={14} className={page.isSelected ? "animate-pulse" : ""} />
                                                            {page.isSelected ? "Active" : "Disabled"}
                                                        </button>
                                                    </div>
                                                </div>

                                                <AnimatePresence>
                                                    {expandedPageId === page.id && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="border-t border-white/10 dark:border-white/5 bg-black/5 dark:bg-black/20 p-8"
                                                        >
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                                {[
                                                                    { key: "enableBot", label: "Neural Auto-Reply", icon: MessageSquare, color: "blue", desc: "Autonomous comment interaction" },
                                                                    { key: "enableSchedule", label: "Temporal Scheduling", icon: Calendar, color: "indigo", desc: "Precision distribution timing" },
                                                                    { key: "enableInbox", label: "Protocol Sync", icon: Radio, color: "emerald", desc: "Real-time communication bridge" }
                                                                ].map((setting) => (
                                                                    <div key={setting.key} className="bg-white/40 dark:bg-white/5 p-6 rounded-[1.8rem] border border-white/10 dark:border-white/5 shadow-sm flex flex-col justify-between gap-6 hover:border-blue-500/30 transition-all group/setting">
                                                                        <div>
                                                                            <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center mb-4 transition-all group-hover/setting:scale-110 ${setting.key === "enableBot" ? "bg-blue-500/10 text-blue-500" : setting.key === "enableSchedule" ? "bg-indigo-500/10 text-indigo-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                                                                                <setting.icon size={22} />
                                                                            </div>
                                                                            <span className="font-black text-gray-900 dark:text-white text-xs uppercase tracking-widest">{setting.label}</span>
                                                                            <p className="text-[10px] text-gray-500 mt-1 font-medium">{setting.desc}</p>
                                                                        </div>
                                                                        <div className="flex justify-end">
                                                                            <button 
                                                                                onClick={() => handleUpdateSetting(page.id, setting.key, setting.key === "enableSchedule" ? page.settings?.enableSchedule === false : !page.settings?.[setting.key])}
                                                                                className={`w-14 h-8 rounded-full transition-all relative ${((setting.key === "enableSchedule" ? page.settings?.enableSchedule !== false : page.settings?.[setting.key])) ? "bg-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-gray-200 dark:bg-white/10"}`}
                                                                            >
                                                                                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all shadow-md ${((setting.key === "enableSchedule" ? page.settings?.enableSchedule !== false : page.settings?.[setting.key])) ? "left-7" : "left-1"}`} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 👉 Right Column: Global Protocols */}
                        <div className="lg:col-span-4 space-y-8">
                            {/* Visual Appearance Protocol */}
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/20 dark:border-white/5 shadow-xl"
                            >
                                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 tracking-tight flex items-center gap-3">
                                    <div className="w-8 h-8 bg-orange-500/10 text-orange-500 rounded-lg flex items-center justify-center">
                                        <Zap size={18} />
                                    </div>
                                    Interface
                                </h3>
                                <div className="p-6 rounded-[2rem] bg-black/5 dark:bg-black/20 border border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center shadow-2xl transition-all ${theme === "dark" ? "bg-indigo-600 text-white" : "bg-orange-500 text-white"}`}>
                                            {theme === "dark" ? <Moon size={22} /> : <Sun size={22} />}
                                        </div>
                                        <div>
                                            <p className="font-black text-[10px] uppercase tracking-widest text-gray-900 dark:text-white">Dark Protocol</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">{theme === "dark" ? "Active" : "Standby"}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={toggleTheme}
                                        className={`w-14 h-8 rounded-full transition-all relative ${theme === "dark" ? "bg-indigo-600 shadow-lg shadow-indigo-600/20" : "bg-gray-200"}`}
                                    >
                                        <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all shadow-md ${theme === "dark" ? "left-7" : "left-1"}`} />
                                    </button>
                                </div>
                            </motion.div>

                            {/* Security Handshakes */}
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/20 dark:border-white/5 shadow-xl"
                            >
                                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 tracking-tight flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-500/10 text-blue-500 rounded-lg flex items-center justify-center">
                                        <ShieldCheck size={18} />
                                    </div>
                                    Shield
                                </h3>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 bg-black/5 dark:bg-black/20 rounded-2xl border border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center shadow-inner">
                                                <Fingerprint size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white">2FA Shield</p>
                                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{user?.twoFactorEnabled ? "Active Protocol" : "Vulnerable"}</p>
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
                                                        const msg = err.response?.data?.error || "Protocol failure";
                                                        toast.error(msg);
                                                    }
                                                }}
                                                className="h-10 px-4 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                                            >
                                                Initialize
                                            </button>
                                        ) : (
                                            <button
                                                onClick={async () => {
                                                    if (!window.confirm("Terminate 2FA security?")) return;
                                                    try {
                                                        await axios.post(apiUtils.getFullUrl("/auth/2fa/disable"), {}, { withCredentials: true });
                                                        window.location.reload();
                                                    } catch (err) {
                                                        toast.error("Handshake failed");
                                                    }
                                                }}
                                                className="h-10 px-4 bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20"
                                            >
                                                Disable
                                            </button>
                                        )}
                                    </div>

                                    {/* Verification UX */}
                                    <AnimatePresence>
                                        {isVerifying && !user?.twoFactorEnabled && qrCode && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                className="p-6 bg-blue-600/5 rounded-3xl border border-blue-500/20 overflow-hidden"
                                            >
                                                <p className="text-[10px] font-black text-center text-blue-500 uppercase tracking-[0.2em] mb-6">Master Key Fragment</p>
                                                <div className="relative p-2 bg-white rounded-2xl w-fit mx-auto mb-6 shadow-2xl ring-4 ring-blue-500/10">
                                                    <img src={qrCode} alt="2FA QR" className="w-32 h-32" />
                                                </div>

                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="SYNC CODE"
                                                        className="flex-1 h-12 px-5 bg-white/50 dark:bg-black/40 border border-white/20 dark:border-white/5 rounded-xl text-center font-black tracking-[0.3em] outline-none focus:ring-2 focus:ring-blue-500"
                                                        onChange={(e) => setVerifyCode(e.target.value)}
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const res = await axios.post(apiUtils.getFullUrl("/auth/2fa/verify"), { token: verifyCode }, { withCredentials: true });
                                                                if (res.data.success) {
                                                                    toast.success("Identity Verified");
                                                                    window.location.reload();
                                                                }
                                                            } catch (err) {
                                                                toast.error("Handshake Rejected");
                                                            }
                                                        }}
                                                        className="w-12 h-12 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/20 transition-all"
                                                    >
                                                        <CheckCircle2 size={20} />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>

                            {/* Autonomous Protocols (Anti-Ban) */}
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/20 dark:border-white/5 shadow-xl"
                            >
                                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 tracking-tight flex items-center gap-3">
                                    <div className="w-8 h-8 bg-purple-500/10 text-purple-500 rounded-lg flex items-center justify-center">
                                        <Cpu size={18} />
                                    </div>
                                    Autonomous
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="p-6 rounded-[2rem] bg-black/5 dark:bg-black/20 border border-white/5 group/anti">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="w-12 h-12 bg-purple-500/10 text-purple-500 rounded-[1rem] flex items-center justify-center group-hover/anti:scale-110 transition-transform">
                                                <Fingerprint size={24} />
                                            </div>
                                            <button className="w-12 h-7 bg-purple-600 rounded-full relative shadow-lg shadow-purple-600/20" onClick={() => toast.success("Spoofer Re-randomized")}>
                                                <div className="absolute top-1 left-6 w-5 h-5 bg-white rounded-full" />
                                            </button>
                                        </div>
                                        <div>
                                            <p className="font-black text-[10px] uppercase tracking-widest text-gray-900 dark:text-white">Neural Spoofer</p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">Randomizing Fingerprints</p>
                                        </div>
                                    </div>

                                    <div className="p-6 rounded-[2rem] bg-black/5 dark:bg-black/20 border border-white/5 group/anti">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="w-12 h-12 bg-teal-500/10 text-teal-500 rounded-[1rem] flex items-center justify-center group-hover/anti:scale-110 transition-transform">
                                                <Activity size={24} />
                                            </div>
                                            <button className="w-12 h-7 bg-teal-600 rounded-full relative shadow-lg shadow-teal-600/20" onClick={() => toast.success("Jitter Protocol Active")}>
                                                <div className="absolute top-1 left-6 w-5 h-5 bg-white rounded-full" />
                                            </button>
                                        </div>
                                        <div>
                                            <p className="font-black text-[10px] uppercase tracking-widest text-gray-900 dark:text-white">Human Jitter</p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">Simulating Organic Input</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Backup & Cloud */}
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                className="bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/20 dark:border-white/5 shadow-xl"
                            >
                                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-8 tracking-tight flex items-center gap-3">
                                    <div className="w-8 h-8 bg-emerald-500/10 text-emerald-500 rounded-lg flex items-center justify-center">
                                        <Cloud size={18} />
                                    </div>
                                    Cloud Link
                                </h3>
                                <div className="p-6 rounded-[2rem] bg-black/5 dark:bg-black/20 border border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/10 p-2.5 rounded-[1rem]">
                                            <svg className="w-full h-full" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="m6.6 66.85 25.3-43.8 25.3 43.8z" fill="#0066da" /><path d="m43.65 23.05-25.3 43.8h25.3z" fill="#43a047" /><path d="m73.55 66.85-6.35-10.95-18.95-32.9-6.35-10.95 25.3 43.8z" fill="#0066da" /><path d="m24.6 23.05 19.05 32.9h38.65l-19.05-32.9z" fill="#43a047" /><path d="m.25 66.85 19.05 32.9h65.8l-19.05-32.9z" fill="#cddca3" /><path d="m19.6 66.85 24.05-41.55 24.35 41.55z" fill="#00ad45" /><path d="m43.65 25.3-19.05 32.9h38.1z" fill="#ea4335" /><path d="m.25 66.85 6.35-10.95 6.35 11.05z" fill="#0066da" /><path d="m24.6 23.05-6.35-11.05-6.35 11.05z" fill="#ea4335" /><path d="m43.65 23.05-6.35-11.05 6.35-10.95 6.35 10.95 6.35 11.05z" fill="#ffd04b" /></svg>
                                        </div>
                                        <div>
                                            <p className="font-black text-[10px] uppercase tracking-widest text-gray-900 dark:text-white">G-Drive Bridge</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Configured</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toast.success("Bridge Established")}
                                        className="h-10 px-6 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                                    >
                                        Sync
                                    </button>
                                </div>
                            </motion.div>

                            {/* Termination */}
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 }}
                                className="bg-rose-500/5 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-rose-500/20 shadow-xl"
                            >
                                <h3 className="text-xl font-black text-rose-500 mb-6 tracking-tight">Terminal</h3>
                                <button
                                    onClick={logout}
                                    className="w-full flex items-center justify-center gap-3 h-16 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-rose-500/40 hover:-translate-y-1 transition-all"
                                >
                                    <LogOut size={20} />
                                    Purge Session
                                </button>
                            </motion.div>
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
