import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { 
    Facebook, Check, X, Link as LinkIcon, ExternalLink, ShieldCheck, Activity, ChevronRight, 
    Globe, Lock, Zap, Shield, Share2, Key, Sparkles, HelpCircle, Info, Loader2 
} from "lucide-react";
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

    // 🍪 Cookie / Token Import State
    const [showCookieModal, setShowCookieModal] = useState(false);
    const [cookieOrTokenInput, setCookieOrTokenInput] = useState("");
    const [importingCookie, setImportingCookie] = useState(false);

    useEffect(() => {
        fetchPages();
    }, [user?.facebookId]);

    const fetchPages = async (isManual = false) => {
        setIsLoadingPages(true);
        setPageError(null);
        if (isManual) toast.loading("កំពុងទាញយកផេក...", { id: "fetch-pages" });

        try {
            const res = await apiUtils.getUserPages();
            if (res.data.success) {
                const uniquePages = Array.from(new Map((res.data.accounts || []).map(p => [p.id, p])).values());
                setPages(uniquePages);
                if (isManual) toast.success("ទាញយកផេកបានជោគជ័យ", { id: "fetch-pages" });
            }
        } catch (err) {
            apiUtils.logError("Connections.fetchPages", err);
            const message = apiUtils.getUserErrorMessage(err);
            setPageError(message);
            if (isManual) toast.error("មិនអាចទាញយកផេកបានទេ", { id: "fetch-pages" });
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

    const handleImportCookieOrToken = async (e) => {
        if (e) e.preventDefault();
        const input = cookieOrTokenInput.trim();
        if (!input) {
            return toast.error("សូមបញ្ចូល Facebook Cookie ឬ Access Token");
        }

        try {
            setImportingCookie(true);
            const res = await apiUtils.connectFacebookCookie(input);
            if (res.data?.success) {
                toast.success(`🎉 បានទាញយក ${res.data.pagesCount || 0} Pages ដោយជោគជ័យ!`, {
                    duration: 5000,
                    icon: "🚀",
                });
                setShowCookieModal(false);
                setCookieOrTokenInput("");
                await fetchPages(true);
            } else {
                toast.error(res.data?.error || "មិនអាចទាញយក Pages បានទេ");
            }
        } catch (err) {
            toast.error("កំហុស: " + (err.response?.data?.error || err.message));
        } finally {
            setImportingCookie(false);
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
            <div className="max-w-5xl mx-auto py-2 sm:py-4 relative z-10 space-y-6">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs">
                    <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-2 font-khmer">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>ការភ្ជាប់គណនី (Account Sync)</span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-khmer">
                            ភ្ជាប់គណនី និងគ្រប់គ្រងផេក <span className="text-blue-600 dark:text-blue-400">Facebook</span>
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 font-khmer">
                            ភ្ជាប់គណនី Facebook របស់អ្នក ដើម្បីផុសវីដេអូ រូបភាព និងឆ្លើយតប Comment ស្វ័យប្រវត្តិទៅកាន់គ្រប់ផេកក្នុងពេលតែមួយ។
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {[
                        { id: 'facebook', name: 'បណ្តាញ Facebook Pages', icon: Facebook, color: 'from-blue-600 to-indigo-600', isConnected: (!!user?.facebookId || pages.length > 0), desc: 'ភ្ជាប់តាមរយៈ Cookie / Token (MMO) ឬ OAuth ដើម្បីគ្រប់គ្រងផេកទាំងអស់។' }
                    ].map((platform) => (
                        <div
                            key={platform.id}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs transition-all"
                        >
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
                                <div className="flex items-start sm:items-center gap-4">
                                    <div className={`w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-2xl flex items-center justify-center bg-gradient-to-br ${platform.color} text-white shadow-md`}>
                                        <platform.icon size={26} strokeWidth={1.8} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-khmer">{platform.name}</h3>
                                            <div className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${platform.isConnected ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}>
                                                {platform.isConnected ? 'បានភ្ជាប់ (Connected)' : 'មិនទាន់ភ្ជាប់'}
                                            </div>
                                        </div>
                                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-khmer">{platform.desc}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2.5">
                                    {platform.isConnected ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setShowCookieModal(true)}
                                                className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all flex items-center justify-center gap-2 font-khmer"
                                            >
                                                <Sparkles size={15} className="text-yellow-300" />
                                                <span>+ បន្ថែមផេកតាម Cookie</span>
                                            </button>
                                            <Button 
                                                variant="secondary"
                                                className="h-10 sm:h-11 px-4 rounded-xl text-xs font-bold border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition-all font-khmer"
                                                onClick={() => handleConnect(platform.id)}
                                            >
                                                <X size={14} className="mr-1.5" />
                                                <span>ផ្តាច់គណនី</span>
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setShowCookieModal(true)}
                                                className="w-full sm:w-auto h-11 px-5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 font-khmer"
                                            >
                                                <Sparkles size={15} className="text-yellow-300" />
                                                <span>ភ្ជាប់តាម Cookie / Token (MMO)</span>
                                            </button>
                                            <Button 
                                                variant="secondary"
                                                className="w-full sm:w-auto h-11 px-4 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                                onClick={() => handleConnect(platform.id)}
                                            >
                                                <Zap size={14} className="mr-1.5" />
                                                OAuth Login
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>


                {(user?.facebookId || pages.length > 0) && (
                    <div 
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs"
                    >
                        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5 font-khmer">
                                    <span>បញ្ជីផេក Facebook របស់អ្នក</span>
                                    <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs rounded-full font-bold">
                                        {pages.length} ផេក
                                    </span>
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowCookieModal(true)}
                                    className="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition font-khmer"
                                >
                                    <Key size={14} />
                                    <span>+ បញ្ចូល Cookie/Token</span>
                                </button>
                                <button 
                                    onClick={() => fetchPages(true)} 
                                    className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all border border-slate-200 dark:border-slate-700"
                                    title="Refresh Pages"
                                >
                                    <RefreshCw size={15} className={isLoadingPages ? "animate-spin text-emerald-500" : ""} />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 sm:p-6 space-y-3">
                            {isLoadingPages ? (
                                [1, 2].map(i => <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)
                            ) : pages.length === 0 ? (
                                <EmptyState title="មិនទាន់មានផេក Facebook" description="សូមភ្ជាប់តាមរយៈ Cookie ឬចុច Refresh ដើម្បីទាញយកផេករបស់អ្នក។" actionLabel="Refresh" onAction={fetchPages} />
                            ) : (
                                pages.map((page, idx) => (
                                    <MotionDiv 
                                        key={page.id}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className={`group rounded-2xl border transition-all ${page.isSelected ? "bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] border-emerald-500/30" : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"}`}
                                    >
                                        <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                            <div className="flex items-center gap-3.5 w-full sm:w-auto min-w-0">
                                                <div className="relative shrink-0">
                                                    <img
                                                        src={page.picture || "https://via.placeholder.com/50"}
                                                        alt={page.name}
                                                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${page.isSelected ? "bg-emerald-500" : "bg-slate-400"}`} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className={`font-bold text-sm sm:text-base truncate font-khmer ${page.isSelected ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>
                                                        {page.name}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[11px] font-medium text-slate-400 font-mono">ID: {page.id}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                                                <button
                                                    onClick={() => setExpandedPageId(expandedPageId === page.id ? null : page.id)}
                                                    className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center border ${expandedPageId === page.id ? "bg-emerald-600 text-white border-emerald-600" : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 hover:text-emerald-500"}`}
                                                >
                                                    <SettingsIcon size={18} strokeWidth={2} />
                                                </button>
                                                
                                                <button 
                                                    onClick={() => handleTogglePage(page.id, page.isSelected)}
                                                    className={`h-10 px-4 rounded-xl flex items-center gap-2 transition-all font-bold text-xs border font-khmer ${page.isSelected ? "bg-emerald-600 border-emerald-600 text-white shadow-xs" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"}`}
                                                >
                                                    <Radio size={14} />
                                                    <span>{page.isSelected ? "កំពុងប្រើ (Active)" : "បិទ (Off)"}</span>
                                                </button>
                                            </div>
                                        </div>

                                        <MotionAnimatePresence>
                                            {expandedPageId === page.id && (
                                                <MotionDiv
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="border-t border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 p-4"
                                                >
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        {[
                                                            { key: "enableBot", label: "Auto Reply Comment", icon: MessageSquare, color: "blue", desc: "ឆ្លើយតប Comment ស្វ័យប្រវត្តិ" },
                                                            { key: "enableSchedule", label: "Auto Schedule", icon: Calendar, color: "indigo", desc: "កំណត់ម៉ោងផុសស្វ័យប្រវត្តិ" },
                                                            { key: "enableInbox", label: "Chat Sync", icon: Radio, color: "emerald", desc: "ភ្ជាប់ប្រអប់សារផេក" }
                                                        ].map((setting) => (
                                                            <div key={setting.key} className="bg-white dark:bg-slate-800/90 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${setting.key === "enableBot" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : setting.key === "enableSchedule" ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                                                                        <setting.icon size={17} />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <span className="font-bold text-slate-900 dark:text-white text-xs block truncate">{setting.label}</span>
                                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-khmer truncate">{setting.desc}</p>
                                                                    </div>
                                                                </div>
                                                                <button 
                                                                    onClick={() => handleUpdateSetting(page.id, setting.key, setting.key === "enableSchedule" ? page.settings?.enableSchedule === false : !page.settings?.[setting.key])}
                                                                    className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${((setting.key === "enableSchedule" ? page.settings?.enableSchedule !== false : page.settings?.[setting.key])) ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`}
                                                                >
                                                                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-xs ${((setting.key === "enableSchedule" ? page.settings?.enableSchedule !== false : page.settings?.[setting.key])) ? "left-5.5" : "left-0.5"}`} />
                                                                </button>
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
                    </div>
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

            {/* 🍪 Cookie / Token Import Modal (MMO Bypass) */}
            <AnimatePresence>
                {showCookieModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-gray-900 border border-indigo-500/30 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative"
                        >
                            <button
                                onClick={() => {
                                    setShowCookieModal(false);
                                    setCookieOrTokenInput("");
                                }}
                                disabled={importingCookie}
                                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition"
                            >
                                <X size={16} />
                            </button>

                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
                                    <Sparkles size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white">ភ្ជាប់ Pages តាម Cookie ឬ Token</h3>
                                    <p className="text-xs text-indigo-300">Bypass Facebook Developer App (MMO Mode)</p>
                                </div>
                            </div>

                            <form onSubmit={handleImportCookieOrToken} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                                        <span>បញ្ចូល Facebook Cookie ឬ Access Token៖</span>
                                        <span className="text-[10px] text-blue-400 font-normal">គាំទ្រ Cookie / EAAG / EAAB</span>
                                    </label>
                                    <textarea
                                        rows={4}
                                        placeholder={`បិទភ្ជាប់ (Paste) ត្រង់នេះ៖\n• Cookie: c_user=1000...; xs=...; datr=...\n• ឬ Access Token: EAAG... / EAAB...`}
                                        value={cookieOrTokenInput}
                                        onChange={(e) => setCookieOrTokenInput(e.target.value)}
                                        disabled={importingCookie}
                                        className="w-full bg-black/50 border border-white/10 rounded-2xl p-3.5 text-xs font-mono text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none leading-relaxed"
                                    />
                                </div>

                                {/* ⚡ Official EZA-POST Extension Helper */}
                                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-transparent border border-purple-500/30 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-purple-600/30 text-purple-300 flex items-center justify-center font-bold text-sm">
                                            ⚡
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-white leading-tight">EZA-POST Chrome Extension</p>
                                            <p className="text-[10px] text-purple-300">Sync ផេកអូតូតាម ១ ឃ្លីក (Folder: <code>extension/</code>)</p>
                                        </div>
                                    </div>
                                    <span className="text-[9px] font-bold text-purple-300 px-2 py-1 rounded-md bg-purple-500/20 border border-purple-500/30">
                                        1-Click Sync
                                    </span>
                                </div>

                                {/* Tips Box */}
                                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-200 space-y-1.5 leading-relaxed">
                                    <div className="flex items-center gap-1.5 font-bold text-blue-300">
                                        <Info size={14} />
                                        <span>របៀបយក Cookie ឬ Token ងាយៗ៖</span>
                                    </div>
                                    <p>• <strong>Cookie</strong>: បើក Facebook លើ Chrome &rarr; ប្រើ Extension <em>"Cookie-Editor"</em> ចុច <strong>Export</strong> &rarr; ជ្រើសរើស <strong>Header String</strong> (ឬ <strong>JSON</strong>) រួច Paste ទីនេះ។</p>
                                    <p>• <strong>Token</strong>: ចូល <a href="https://business.facebook.com" target="_blank" rel="noreferrer" className="underline text-blue-300">business.facebook.com</a> ឬ Ads Manager រួច Copy Token ផ្តើមដោយ <code>EAAG...</code> ឬ <code>EAAB...</code>។</p>
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowCookieModal(false);
                                            setCookieOrTokenInput("");
                                        }}
                                        disabled={importingCookie}
                                        className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold transition"
                                    >
                                        បោះបង់
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={importingCookie || !cookieOrTokenInput.trim()}
                                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-bold shadow-lg shadow-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                                    >
                                        {importingCookie ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                កំពុងទាញយក Pages...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={16} />
                                                ទាញយក Pages ទាំងអស់
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
}
