import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import {
    Facebook,
    ShieldCheck,
    Zap,
    Sparkles,
    Loader2,
    Settings as SettingsIcon,
    MessageSquare,
    Calendar,
    Radio,
    RefreshCw,
    Download,
    Puzzle,
    CheckCircle2,
    Copy,
    Check,
    ExternalLink,
    FolderOpen,
    ToggleRight
} from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import EmptyState from "../components/ui/EmptyState";
import { useAuth } from "../hooks/useAuth";
import apiUtils from "../utils/apiUtils";

export default function Connections() {
    const { user } = useAuth();
    const MotionDiv = motion.div;
    const MotionAnimatePresence = AnimatePresence;

    const [loading, setLoading] = useState(true);
    const [pages, setPages] = useState([]);
    const [isLoadingPages, setIsLoadingPages] = useState(false);
    const [expandedPageId, setExpandedPageId] = useState(null);

    // 🧩 EZA-POST FB Extension Live Status
    const [extensionInstalled, setExtensionInstalled] = useState(false);
    const [fbBrowserLoggedIn, setFbBrowserLoggedIn] = useState(false);
    const [fbBrowserUserId, setFbBrowserUserId] = useState(null);
    const [isSyncingViaExt, setIsSyncingViaExt] = useState(false);
    const [copiedChromeUrl, setCopiedChromeUrl] = useState(false);

    const installGuideRef = useRef(null);
    const syncTimeoutRef = useRef(null);

    useEffect(() => {
        fetchPages().finally(() => setLoading(false));
    }, [user?.facebookId]);

    // Check & listen for EZA-POST Chrome Extension
    useEffect(() => {
        const checkDomAttr = () => {
            if (document.documentElement.getAttribute("data-eza-extension") === "installed") {
                setExtensionInstalled(true);
            }
        };
        checkDomAttr();

        const handleExtensionMessage = async (event) => {
            if (event.source !== window || !event.data || event.data.source !== "EZA_EXTENSION") {
                return;
            }

            const { action, installed, fbLoggedIn, fbUserId, ok, cookieString, error } = event.data;

            if (action === "EXTENSION_STATUS") {
                if (installed) setExtensionInstalled(true);
                setFbBrowserLoggedIn(Boolean(fbLoggedIn));
                setFbBrowserUserId(fbUserId || null);
            } else if (action === "FB_SYNC_PAYLOAD") {
                if (syncTimeoutRef.current) {
                    clearTimeout(syncTimeoutRef.current);
                    syncTimeoutRef.current = null;
                }

                if (!ok || !cookieString) {
                    setIsSyncingViaExt(false);
                    toast.error(error || "សូមបើក facebook.com និង Login គណនី Facebook លើ Browser ជាមុនសិន!");
                    return;
                }

                try {
                    const res = await apiUtils.connectFacebookCookie(cookieString);
                    if (res.data?.success) {
                        toast.success(`🎉 ភ្ជាប់ជោគជ័យ! បានទាញយកផេកចំនួន ${res.data.pagesCount || 0} តាមរយៈ Extension!`, {
                            duration: 5000
                        });
                        await fetchPages(true);
                    } else {
                        toast.error(res.data?.error || "មិនអាចទាញយកផេកពី Facebook បានទេ");
                    }
                } catch (err) {
                    toast.error("កំហុសក្នុងការ Sync ផេក: " + (err.response?.data?.error || err.message));
                } finally {
                    setIsSyncingViaExt(false);
                }
            }
        };

        window.addEventListener("message", handleExtensionMessage);
        window.postMessage({ source: "EZA_WEB_APP", action: "CHECK_EXTENSION" }, "*");

        const pollTimer = setInterval(() => {
            checkDomAttr();
            window.postMessage({ source: "EZA_WEB_APP", action: "CHECK_EXTENSION" }, "*");
        }, 3000);

        return () => {
            window.removeEventListener("message", handleExtensionMessage);
            clearInterval(pollTimer);
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        };
    }, []);

    const fetchPages = async (isManual = false) => {
        setIsLoadingPages(true);
        if (isManual) toast.loading("កំពុងទាញយកបញ្ជីផេក...", { id: "fetch-pages" });

        try {
            const res = await apiUtils.getUserPages();
            if (res.data.success) {
                const uniquePages = Array.from(new Map((res.data.accounts || []).map((p) => [p.id, p])).values());
                setPages(uniquePages);
                if (isManual) toast.success("បានធ្វើបច្ចុប្បន្នភាពបញ្ជីផេកជោគជ័យ!", { id: "fetch-pages" });
            }
        } catch (err) {
            apiUtils.logError("Connections.fetchPages", err);
            if (isManual) toast.error("មិនអាចទាញយកផេកបានទេ", { id: "fetch-pages" });
        } finally {
            setIsLoadingPages(false);
        }
    };

    // Trigger 1-Click Sync via EZA-POST FB Extension
    const handleExtensionOneClickSync = () => {
        const isDomInstalled =
            extensionInstalled || document.documentElement.getAttribute("data-eza-extension") === "installed";

        if (!isDomInstalled) {
            toast("សូមទាញយក និងដំឡើង EZA-POST Extension ជាមុនសិន (ឬចុច Refresh ប្រសិនបើទើបដំឡើងរួច)!", {
                icon: "🧩",
                duration: 4500
            });
            installGuideRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }

        setIsSyncingViaExt(true);
        window.postMessage({ source: "EZA_WEB_APP", action: "SYNC_FB_PAGES" }, "*");

        // Safety timeout if extension does not respond
        syncTimeoutRef.current = setTimeout(() => {
            setIsSyncingViaExt(false);
            toast.error("មិនអាចភ្ជាប់ទៅ Extension បានទេ។ សូមចុច Refresh ទំព័រ ឬចុចលើ Icon Extension ⚡ នៅលើ Browser!");
        }, 8000);
    };

    const handleCopyChromeExtensionsUrl = () => {
        navigator.clipboard.writeText("chrome://extensions");
        setCopiedChromeUrl(true);
        toast.success("បានចម្លង chrome://extensions រួចរាល់! សូមបិទភ្ជាប់ (Paste) ក្នុងរបារអាសយដ្ឋាន Chrome។");
        setTimeout(() => setCopiedChromeUrl(false), 2500);
    };

    const handleTogglePage = async (pageId, currentStatus) => {
        setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, isSelected: !currentStatus } : p)));
        const toastId = toast.loading(currentStatus ? "កំពុងបិទផេក..." : "កំពុងបើកផេក...");

        try {
            await apiUtils.toggleUserPage(pageId, !currentStatus);
            toast.success(currentStatus ? "បានបិទផេក" : "បានបើកផេកឱ្យដំណើរការ", { id: toastId });
        } catch (err) {
            setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, isSelected: currentStatus } : p)));
            toast.error("មិនអាចកែប្រែស្ថានភាពផេកបានទេ", { id: toastId });
        }
    };

    const handleUpdateSetting = async (pageId, settingKey, newValue) => {
        setPages((prev) =>
            prev.map((p) => {
                if (p.id === pageId) {
                    return { ...p, settings: { ...p.settings, [settingKey]: newValue } };
                }
                return p;
            })
        );

        try {
            const page = pages.find((p) => p.id === pageId);
            const newSettings = { ...page.settings, [settingKey]: newValue };
            await apiUtils.updatePageSettings(pageId, newSettings);
            toast.success("បានរក្សាទុកការកំណត់ផេក");
        } catch (err) {
            fetchPages();
            toast.error("មិនអាចរក្សាទុកការកំណត់បានទេ");
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 font-khmer">កំពុងផ្ទុកទំព័រភ្ជាប់ផេក...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto py-2 sm:py-4 space-y-5">
                {/* 1. Header & Extension Hero Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                        <div className="space-y-2.5 max-w-2xl">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-khmer">
                                    <Puzzle size={13} />
                                    <span>វិធីសាស្ត្រភ្ជាប់ផ្លូវការ៖ EZA-POST FB Extension</span>
                                </span>

                                <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border font-khmer ${
                                        extensionInstalled
                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
                                    }`}
                                >
                                    <span
                                        className={`w-2 h-2 rounded-full ${
                                            extensionInstalled ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                                        }`}
                                    />
                                    <span>
                                        {extensionInstalled
                                            ? "បានដំឡើង Extension រួចរាល់"
                                            : "មិនទាន់ដំឡើង Extension"}
                                    </span>
                                </span>

                                {extensionInstalled && (
                                    <span
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border font-khmer ${
                                            fbBrowserLoggedIn
                                                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                                        }`}
                                    >
                                        <Facebook size={12} />
                                        <span>
                                            {fbBrowserLoggedIn
                                                ? `FB Online (${fbBrowserUserId})`
                                                : "មិនទាន់ Login FB លើ Browser"}
                                        </span>
                                    </span>
                                )}
                            </div>

                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-khmer">
                                ភ្ជាប់ផេក <span className="text-blue-600 dark:text-blue-400">Facebook</span> តាមរយៈ Extension (1-Click Sync)
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-khmer leading-relaxed">
                                យើងប្រើប្រាស់តែវិធីសាស្ត្រ <strong>EZA-POST Facebook Extension</strong> តែមួយគត់ — មិនបាច់បញ្ចូល Token ដោយដៃ មិនបាច់ Copy/Paste និងមានសុវត្ថិភាពខ្ពស់បំផុត 100%។
                            </p>
                        </div>

                        {/* Primary Extension Action Buttons */}
                        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                            <a
                                href="/eza-post-fb-extension.zip"
                                download="EZA-POST-FB-Extension.zip"
                                className="h-11 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all font-khmer shadow-2xs"
                            >
                                <Download size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                <span>ទាញយក Extension (.ZIP)</span>
                            </a>

                            <button
                                type="button"
                                onClick={handleExtensionOneClickSync}
                                disabled={isSyncingViaExt}
                                className="h-11 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 font-khmer cursor-pointer"
                            >
                                {isSyncingViaExt ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin shrink-0" />
                                        <span>កំពុង Sync ផេកពី Extension...</span>
                                    </>
                                ) : (
                                    <>
                                        <Zap size={16} className="text-yellow-300 fill-yellow-300 shrink-0" />
                                        <span>ភ្ជាប់ផេកតាម Extension (1-Click)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Step-by-Step Extension Download & Installation Guide */}
                <div
                    ref={installGuideRef}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4"
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                <Puzzle size={20} />
                            </div>
                            <div>
                                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-khmer">
                                    របៀបទាញយក និងដំឡើង EZA-POST FB Extension (៣ ជំហានងាយៗ)
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-khmer">
                                    ដំឡើងតែម្តងគត់លើ Google Chrome / Edge / Brave រួចចុច 1-Click Sync ដើម្បីទាញយកផេកទាំងអស់ស្វ័យប្រវត្តិ
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleCopyChromeExtensionsUrl}
                                className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-all font-khmer shrink-0 cursor-pointer"
                            >
                                {copiedChromeUrl ? (
                                    <>
                                        <Check size={14} className="text-emerald-500" />
                                        <span>បាន Copy chrome://extensions</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={14} className="text-indigo-500" />
                                        <span>Copy: chrome://extensions</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        {/* Step 1 */}
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-3">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white text-xs font-bold font-khmer">
                                        ជំហានទី ១
                                    </span>
                                    <Download size={18} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-khmer">
                                    ទាញយក និងពន្លាឯកសារ (Unzip)
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-400 font-khmer leading-relaxed">
                                    ចុចប៊ូតុងខាងក្រោមដើម្បីទាញយក <code>EZA-POST-FB-Extension.zip</code> រួចចុចម៉ៅស្តាំលើឯកសារ ជ្រើសរើស <strong>Extract All (ពន្លាឯកសារ)</strong>។
                                </p>
                            </div>
                            <a
                                href="/eza-post-fb-extension.zip"
                                download="EZA-POST-FB-Extension.zip"
                                className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all font-khmer shadow-xs"
                            >
                                <Download size={14} />
                                <span>ទាញយក Extension (.ZIP)</span>
                            </a>
                        </div>

                        {/* Step 2 */}
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-3">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-xs font-bold font-khmer">
                                        ជំហានទី ២
                                    </span>
                                    <ToggleRight size={18} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-khmer">
                                    បើក Developer Mode & Load Unpacked
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-400 font-khmer leading-relaxed">
                                    បើកផ្ទាំងថ្មីក្នុង Chrome ចូលទៅ <code>chrome://extensions</code> បើកកុងតាក់ <strong>Developer mode</strong> (ជ្រុងស្តាំលើ) រួចចុច <strong>Load unpacked</strong> ជ្រើសរើស Folder ដែលបានពន្លា។
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyChromeExtensionsUrl}
                                className="w-full py-2 px-3 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all font-khmer cursor-pointer"
                            >
                                <FolderOpen size={14} className="text-indigo-500" />
                                <span>ចម្លងតំណ chrome://extensions</span>
                            </button>
                        </div>

                        {/* Step 3 */}
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-3">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white text-xs font-bold font-khmer">
                                        ជំហានទី ៣
                                    </span>
                                    <Zap size={18} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-khmer">
                                    ចុច 1-Click Sync ផេក Facebook
                                </h3>
                                <p className="text-xs text-slate-600 dark:text-slate-400 font-khmer leading-relaxed">
                                    ប្រាកដថាអ្នកបាន Login គណនី Facebook លើ Browser រួចចុចប៊ូតុង <strong>ភ្ជាប់ផេកតាម Extension (1-Click)</strong> ឬចុចលើ Icon ⚡ នៃ Extension។
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleExtensionOneClickSync}
                                disabled={isSyncingViaExt}
                                className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all font-khmer shadow-xs cursor-pointer disabled:opacity-60"
                            >
                                <Zap size={14} />
                                <span>ចុច Sync ផេកឥឡូវនេះ</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3. Connected Facebook Pages List */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                    <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5 font-khmer">
                                <span>បញ្ជីផេក Facebook ដែលបានភ្ជាប់</span>
                                <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs rounded-full font-bold">
                                    {pages.length} ផេក
                                </span>
                            </h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleExtensionOneClickSync}
                                disabled={isSyncingViaExt}
                                className="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition font-khmer cursor-pointer disabled:opacity-60"
                            >
                                <Zap size={14} className="text-yellow-300 fill-yellow-300" />
                                <span>Sync ផេកតាម Extension</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => fetchPages(true)}
                                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
                                title="Refresh Pages"
                            >
                                <RefreshCw size={15} className={isLoadingPages ? "animate-spin text-emerald-500" : ""} />
                            </button>
                        </div>
                    </div>

                    <div className="p-4 sm:p-6 space-y-3">
                        {isLoadingPages ? (
                            [1, 2].map((i) => (
                                <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
                            ))
                        ) : pages.length === 0 ? (
                            <EmptyState
                                title="មិនទាន់មានផេក Facebook ត្រូវបានភ្ជាប់ទេ"
                                description="សូមទាញយក និងដំឡើង EZA-POST FB Extension ខាងលើ រួចចុច 'ភ្ជាប់ផេកតាម Extension (1-Click)'។"
                                actionLabel="Sync តាម Extension"
                                onAction={handleExtensionOneClickSync}
                            />
                        ) : (
                            pages.map((page, idx) => (
                                <MotionDiv
                                    key={page.id}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className={`group rounded-2xl border transition-all ${
                                        page.isSelected
                                            ? "bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] border-emerald-500/30"
                                            : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                                    }`}
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
                                                <div
                                                    className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                                        page.isSelected ? "bg-emerald-500" : "bg-slate-400"
                                                    }`}
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <h4
                                                    className={`font-bold text-sm sm:text-base truncate font-khmer ${
                                                        page.isSelected
                                                            ? "text-slate-900 dark:text-white"
                                                            : "text-slate-500 dark:text-slate-400"
                                                    }`}
                                                >
                                                    {page.name}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[11px] font-medium text-slate-400 font-mono">
                                                        ID: {page.id}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExpandedPageId(expandedPageId === page.id ? null : page.id)
                                                }
                                                className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center border cursor-pointer ${
                                                    expandedPageId === page.id
                                                        ? "bg-emerald-600 text-white border-emerald-600"
                                                        : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 hover:text-emerald-500"
                                                }`}
                                            >
                                                <SettingsIcon size={18} strokeWidth={2} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleTogglePage(page.id, page.isSelected)}
                                                className={`h-10 px-4 rounded-xl flex items-center gap-2 transition-all font-bold text-xs border font-khmer cursor-pointer ${
                                                    page.isSelected
                                                        ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500"
                                                }`}
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
                                                        {
                                                            key: "enableBot",
                                                            label: "Auto Reply Comment",
                                                            icon: MessageSquare,
                                                            desc: "ឆ្លើយតប Comment ស្វ័យប្រវត្តិ"
                                                        },
                                                        {
                                                            key: "enableSchedule",
                                                            label: "Auto Schedule",
                                                            icon: Calendar,
                                                            desc: "កំណត់ម៉ោងផុសស្វ័យប្រវត្តិ"
                                                        },
                                                        {
                                                            key: "enableInbox",
                                                            label: "Chat Sync",
                                                            icon: Radio,
                                                            desc: "ភ្ជាប់ប្រអប់សារផេក"
                                                        }
                                                    ].map((setting) => (
                                                        <div
                                                            key={setting.key}
                                                            className="bg-white dark:bg-slate-800/90 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3"
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div
                                                                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                                                        setting.key === "enableBot"
                                                                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                                                            : setting.key === "enableSchedule"
                                                                            ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                                                                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                                    }`}
                                                                >
                                                                    <setting.icon size={17} />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <span className="font-bold text-slate-900 dark:text-white text-xs block truncate">
                                                                        {setting.label}
                                                                    </span>
                                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-khmer truncate">
                                                                        {setting.desc}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleUpdateSetting(
                                                                        page.id,
                                                                        setting.key,
                                                                        setting.key === "enableSchedule"
                                                                            ? page.settings?.enableSchedule === false
                                                                            : !page.settings?.[setting.key]
                                                                    )
                                                                }
                                                                className={`w-11 h-6 rounded-full transition-all relative shrink-0 cursor-pointer ${
                                                                    (
                                                                        setting.key === "enableSchedule"
                                                                            ? page.settings?.enableSchedule !== false
                                                                            : page.settings?.[setting.key]
                                                                    )
                                                                        ? "bg-emerald-500"
                                                                        : "bg-slate-300 dark:bg-slate-700"
                                                                }`}
                                                            >
                                                                <div
                                                                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-xs ${
                                                                        (
                                                                            setting.key === "enableSchedule"
                                                                                ? page.settings?.enableSchedule !== false
                                                                                : page.settings?.[setting.key]
                                                                        )
                                                                            ? "left-5.5"
                                                                            : "left-0.5"
                                                                    }`}
                                                                />
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

                {/* 4. Security Assurance Card */}
                <div className="p-4 sm:p-5 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] rounded-2xl border border-emerald-500/20 flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-11 h-11 bg-emerald-500/15 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                        <ShieldCheck size={24} />
                    </div>
                    <div className="text-center sm:text-left">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white font-khmer">
                            ប្រព័ន្ធតភ្ជាប់តាម Extension ប្រកបដោយសុវត្ថិភាពខ្ពស់បំផុត
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-khmer mt-0.5">
                            មិនមានការបញ្ចូល Token ដោយដៃ ឬរក្សាទុកពាក្យសម្ងាត់ឡើយ។ រាល់ការភ្ជាប់ផេកទាំងអស់ធ្វើឡើងដោយស្វ័យប្រវត្តិតាមរយៈ EZA-POST FB Extension ផ្លូវការ។
                        </p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
