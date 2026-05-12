import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Facebook, Check, X, Link as LinkIcon, ExternalLink, ShieldCheck, Activity, ChevronRight, Globe, Lock, Zap, Shield, Share2 } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Settings as SettingsIcon, MessageSquare, Calendar, Radio, RefreshCw } from "lucide-react";
import EmptyState from "../components/ui/EmptyState";
import Button from "../components/ui/Button";
import { useAuth } from "../hooks/useAuth";
import apiUtils from "../utils/apiUtils";

export default function Connections() {
    const { user } = useAuth();
    const MotionDiv = motion.div;
    const MotionAnimatePresence = AnimatePresence;
    const [connections, setConnections] = useState({
        youtube: false,
        tiktok: false,
        instagram: false
    });
    const [loading, setLoading] = useState(true);
    const [pages, setPages] = useState([]);
    const [isLoadingPages, setIsLoadingPages] = useState(false);
    const [pageError, setPageError] = useState(null);
    const [expandedPageId, setExpandedPageId] = useState(null);

    useEffect(() => {
        if (user?.facebookId) {
            fetchPages();
        }
    }, [user?.facebookId]);

    const fetchPages = async () => {
        setIsLoadingPages(true);
        setPageError(null);
        try {
            const res = await apiUtils.retryRequest(() => apiUtils.getUserPages());
            if (res.data.success) {
                // ✅ Prevent duplicate pages using ID mapping
                const uniquePages = Array.from(new Map((res.data.accounts || []).map(p => [p.id, p])).values());
                setPages(uniquePages);
            }
        } catch (err) {
            apiUtils.logError("Connections.fetchPages", err);
            const message = apiUtils.getUserErrorMessage(err);
            setPageError(message);
            if (!apiUtils.isAuthError(err)) toast.error(message);
        } finally {
            setIsLoadingPages(false);
        }
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
            toast.success("Preferences updated");
        } catch (err) {
            fetchPages();
            toast.error("Sync failed");
        }
    };


    useEffect(() => {
        const fetchConnections = async () => {
            try {
                const res = await api.get("/user/connections");
                if (res.data.success) {
                    setConnections(res.data.connections);
                }
            } catch (err) {
                console.error("Failed to load connections:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchConnections();
    }, []);

    const handleConnect = async (platform) => {
        if (platform === 'facebook') {
            window.location.href = apiUtils.getAuthUrl("/auth/facebook");
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                    <div className="w-16 h-16 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin shadow-2xl shadow-blue-500/20" />
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-500 animate-pulse">Connecting...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            {/* Mesh Gradient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20 dark:opacity-40">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-600 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 relative z-10">
                {/* Header Section */}
                <div className="mb-10 md:mb-16">
                    <div className="flex items-center gap-2 mb-3 md:mb-4">
                        <div className="px-2.5 py-0.5 md:px-3 md:py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[11px] md:text-xs font-black text-emerald-500 uppercase tracking-[0.2em]">
                            Sync Now
                        </div>
                        <div className="h-px w-8 md:w-12 bg-emerald-500/20" />
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white tracking-tighter mb-3 md:mb-4 leading-none">
                        Sync <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Accounts.</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium text-base md:text-lg max-w-2xl leading-relaxed">
                        Connect your social accounts to auto post across all platforms.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    {[
                        { id: 'facebook', name: 'Facebook Network', icon: Facebook, color: 'from-blue-600 to-indigo-700', isConnected: !!user?.facebookId, desc: 'Connect to auto post and manage Facebook Pages.' }
                    ].map((platform, idx) => (
                        <MotionDiv
                            key={platform.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="group relative overflow-hidden bg-white/60 dark:bg-black/40 backdrop-blur-2xl border border-white/20 dark:border-white/5 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 shadow-2xl hover:shadow-emerald-500/5 transition-all duration-700"
                        >
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8 relative z-10">
                                <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6 md:gap-8">
                                    <div className={`w-16 h-16 md:w-24 md:h-24 shrink-0 rounded-2xl md:rounded-[2rem] flex items-center justify-center bg-gradient-to-br ${platform.color} text-white shadow-2xl transition-transform duration-700 group-hover:rotate-[5deg] group-hover:scale-110`}>
                                        <platform.icon size={platform.id === 'facebook' ? 32 : 48}  strokeWidth={1.5} />
                                    </div>
                                    <div className="max-w-md">
                                        <div className="flex flex-col sm:flex-row items-center gap-2 md:gap-4 mb-2">
                                            <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight">{platform.name}</h3>
                                            <div className={`px-2.5 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest border transition-colors duration-500 ${platform.isConnected ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-white/5 dark:border-white/10'}`}>
                                                {platform.isConnected ? 'Connected' : 'Offline'}
                                            </div>
                                        </div>
                                        <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-medium leading-relaxed">{platform.desc}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-center sm:justify-start gap-4">
                                    <MotionAnimatePresence mode="wait">
                                        {platform.isConnected ? (
                                            <MotionDiv
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                key="connected"
                                                className="w-full sm:w-auto"
                                            >
                                                <Button 
                                                    variant="secondary"
                                                    className="w-full sm:w-auto h-12 md:h-14 px-6 md:px-10 rounded-xl md:rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-widest border-rose-500/20 text-rose-500 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-xl hover:shadow-rose-600/20 group/btn"
                                                    onClick={() => handleConnect(platform.id)}
                                                >
                                                    <X size={14}  className="mr-2 group-hover/btn:rotate-90 transition-transform" />
                                                    Remove
                                                </Button>
                                            </MotionDiv>
                                        ) : (
                                            <MotionDiv
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                key="disconnected"
                                                className="w-full sm:w-auto"
                                            >
                                                <Button 
                                                    className="w-full sm:w-auto h-12 md:h-14 px-8 md:px-12 rounded-xl md:rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-2xl shadow-emerald-600/30 group/btn"
                                                    onClick={() => handleConnect(platform.id)}
                                                >
                                                    <Zap size={14}  className="mr-2 group-hover/btn:scale-125 transition-transform" />
                                                    Connect Now
                                                </Button>
                                            </MotionDiv>
                                        )}
                                    </MotionAnimatePresence>
                                </div>
                            </div>
                            
                            {/* Animated background decoration */}
                            <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${platform.color} opacity-[0.03] blur-[60px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:opacity-[0.07] transition-opacity duration-700`} />
                        </MotionDiv>
                    ))}
                </div>


                {user?.facebookId && (
                    <MotionDiv 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-12 bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/20 dark:border-white/5 overflow-hidden shadow-xl"
                    >
                        <div className="p-5 md:p-8 border-b border-white/10 dark:border-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2 md:gap-3">
                                    Your Facebook Pages
                                    <span className="px-2 py-0.5 md:px-3 md:py-1 bg-emerald-500/10 text-emerald-500 text-[10px] md:text-xs rounded-full font-black tracking-widest uppercase">
                                        {pages.length} Online
                                    </span>
                                </h3>
                            </div>
                            <button 
                                onClick={() => fetchPages(true)} 
                                className="w-9 h-9 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-emerald-500 transition-all border border-white/10 shadow-inner"
                            >
                                <RefreshCw size={16}  className={isLoadingPages ? "animate-spin text-emerald-500" : ""} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            {isLoadingPages ? (
                                [1, 2].map(i => <div key={i} className="h-28 bg-white/5 dark:bg-white/5 rounded-[2rem] animate-pulse" />)
                            ) : pages.length === 0 ? (
                                <EmptyState title="No Pages Found" description="We couldn't find any Facebook Pages connected to your account." actionLabel="Refresh" onAction={fetchPages} />
                            ) : (
                                pages.map((page, idx) => (
                                    <MotionDiv 
                                        key={page.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className={`group rounded-[2rem] border transition-all duration-500 ${page.isSelected ? "bg-emerald-600/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5" : "bg-white/40 dark:bg-white/5 border-white/10 hover:border-white/20 dark:hover:border-white/10"}`}
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
                                                        <span className="text-xs font-black uppercase tracking-widest text-gray-400 font-mono">ID: {page.id}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                                                <button
                                                    onClick={() => setExpandedPageId(expandedPageId === page.id ? null : page.id)}
                                                    className={`w-12 h-12 rounded-[1rem] transition-all flex items-center justify-center border ${expandedPageId === page.id ? "bg-emerald-600 text-white border-emerald-600 shadow-xl" : "bg-white/10 text-gray-400 border-white/10 hover:border-emerald-500/50 hover:text-emerald-500"}`}
                                                >
                                                    <SettingsIcon size={20} strokeWidth={expandedPageId === page.id ? 2.5 : 2} />
                                                </button>
                                                
                                                <button 
                                                    onClick={() => handleTogglePage(page.id, page.isSelected)}
                                                    className={`relative h-12 px-6 rounded-[1rem] flex items-center gap-3 transition-all font-black text-xs uppercase tracking-widest border ${page.isSelected ? "bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-600/20" : "bg-white/5 border-white/10 text-gray-400"}`}
                                                >
                                                    <Radio size={14} className={page.isSelected ? "animate-pulse" : ""} />
                                                    {page.isSelected ? "Connected" : "Off"}
                                                </button>
                                            </div>
                                        </div>

                                        <MotionAnimatePresence>
                                            {expandedPageId === page.id && (
                                                <MotionDiv
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="border-t border-white/10 dark:border-white/5 bg-black/5 dark:bg-black/20 p-5 md:p-8"
                                                >
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                                                        {[
                                                            { key: "enableBot", label: "Auto Reply", icon: MessageSquare, color: "blue", desc: "Auto reply to comments" },
                                                            { key: "enableSchedule", label: "Auto Time", icon: Calendar, color: "indigo", desc: "Best time to post" },
                                                            { key: "enableInbox", label: "Chat Sync", icon: Radio, color: "emerald", desc: "Sync messages and chat" }
                                                        ].map((setting) => (
                                                            <div key={setting.key} className="bg-white/40 dark:bg-white/5 p-5 md:p-6 rounded-2xl md:rounded-[1.8rem] border border-white/10 dark:border-white/5 shadow-sm flex flex-col justify-between gap-4 md:gap-6 hover:border-emerald-500/30 transition-all group/setting">
                                                                <div>
                                                                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-[1rem] flex items-center justify-center mb-3 md:mb-4 transition-all group-hover/setting:scale-110 ${setting.key === "enableBot" ? "bg-blue-500/10 text-blue-500" : setting.key === "enableSchedule" ? "bg-indigo-500/10 text-indigo-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                                                                        <setting.icon size={18}  />
                                                                    </div>
                                                                    <span className="font-black text-gray-900 dark:text-white text-xs md:text-sm uppercase tracking-widest">{setting.label}</span>
                                                                    <p className="text-[11px] md:text-xs text-gray-500 mt-1 font-medium">{setting.desc}</p>
                                                                </div>
                                                                <div className="flex justify-end">
                                                                    <button 
                                                                        onClick={() => handleUpdateSetting(page.id, setting.key, setting.key === "enableSchedule" ? page.settings?.enableSchedule === false : !page.settings?.[setting.key])}
                                                                        className={`w-12 h-7 md:w-14 md:h-8 rounded-full transition-all relative ${((setting.key === "enableSchedule" ? page.settings?.enableSchedule !== false : page.settings?.[setting.key])) ? "bg-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-gray-200 dark:bg-white/10"}`}
                                                                    >
                                                                        <div className={`absolute top-0.5 md:top-1 w-6 h-6 rounded-full bg-white transition-all shadow-md ${((setting.key === "enableSchedule" ? page.settings?.enableSchedule !== false : page.settings?.[setting.key])) ? "left-5.5 md:left-7" : "left-0.5 md:left-1"}`} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </MotionDiv>
                                            )}
                                        </MotionAnimatePresence>
                                    </MotionDiv>
                                ))
                            )}
                        </div>
                    </MotionDiv>
                )}

                {/* 🛡️ Secure Connection Status Card */}
                <MotionDiv
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mt-8 md:mt-12 p-6 md:p-8 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 backdrop-blur-2xl rounded-[2rem] md:rounded-[3rem] border border-emerald-500/20 shadow-2xl overflow-hidden relative group"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform hidden md:block">
                        <ShieldCheck size={120} className="text-emerald-500" />
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 relative z-10">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-500/10 rounded-2xl md:rounded-[1.8rem] flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-inner">
                            <ShieldCheck size={32}  />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <div className="flex items-center justify-center md:justify-start gap-2 md:gap-3 mb-2 md:mb-3">
                                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-ping" />
                                <span className="text-[8px] md:text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] md:tracking-[0.3em]">ប្រព័ន្ធការពារកម្រិតខ្ពស់</span>
                            </div>
                            <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-2">ការតភ្ជាប់ប្រកបដោយសុវត្ថិភាព</h3>
                            <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed max-w-3xl text-xs md:text-sm">
                                គណនីរបស់បងត្រូវបានការពារយ៉ាងតឹងរ៉ឹងបំផុត។ យើងខ្ញុំប្រើប្រាស់ប្រព័ន្ធតភ្ជាប់ផ្លូវការរបស់ Facebook និងមិនរក្សាទុកលេខសម្ងាត់របស់បងឡើយ។ រាល់ទិន្នន័យទាំងអស់ត្រូវបាន Encode យ៉ាងមានសុវត្ថិភាពបំផុត។
                            </p>
                        </div>
                    </div>
                </MotionDiv>
            </div>
        </DashboardLayout>
    );
}
