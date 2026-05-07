import React, { useState, useEffect, useMemo } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Search, Download, Check, Play, User, X, ChevronRight, Loader2, Image as ImageIcon, Video, Music, Layers, Info } from "lucide-react";
import toast from "react-hot-toast";
import api, { API_CONFIG } from "../../utils/api";

// 🛠️ Helper for clean API URLs
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/api$/, "");

const safeEncode = (str) => {
    try {
        return encodeURIComponent(str);
    } catch {
        return encodeURIComponent(String(str).replace(/[\uD800-\uDFFF]/g, ''));
    }
};

// 🛡️ Robust Proxy Helper
const getProxyUrl = (url, options = {}) => {
    if (!url) return "";
    const { filename = "file", type = "" } = options;
    let proxyUrl = `${API_BASE}/api/tools/tiktok/proxy?url=${safeEncode(url)}&filename=${safeEncode(filename)}`;
    if (type) proxyUrl += `&type=${safeEncode(type)}`;
    if (options.web_url) proxyUrl += `&web_url=${safeEncode(options.web_url)}`;
    return proxyUrl;
};

// ⬇️ Generic Trigger Download
const triggerDownload = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export default function TikTokDownloader() {
    const [activeTab, setActiveTab] = useState("single"); // 'single' | 'profile'

    // Single Video State
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [videoData, setVideoData] = useState(null);
    const [saving, setSaving] = useState(false);

    // Download Progress State
    const [isDownloading, setIsDownloading] = useState(false);
    const [isCombining, setIsCombining] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

    // 🚀 Auto-Lookup on Paste
    useEffect(() => {
        const detectAndLookup = async () => {
            if (url.trim() && (url.includes('tiktok.com') || url.includes('vt.tiktok.com'))) {
                // Only lookup if not already loading and if url changed
                if (!loading && (!videoData || videoData.originalUrl !== url)) {
                    handleLookup();
                }
            }
        };
        
        // Debounce slightly to wait for paste to finish
        const timer = setTimeout(detectAndLookup, 500);
        return () => clearTimeout(timer);
    }, [url]);

    // Profile Bulk State
    const [profileInput, setProfileInput] = useState("");
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileData, setProfileData] = useState(null);
    const [selectedVideos, setSelectedVideos] = useState(new Set());
    const [sortMode, setSortMode] = useState("date"); // 'date' | 'plays'

    // Sort Videos
    const sortedVideos = React.useMemo(() => {
        if (!profileData?.videos) return [];
        const videos = [...profileData.videos];
        if (sortMode === "date") {
            return videos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        } else {
            return videos.sort((a, b) => b.stats.plays - a.stats.plays);
        }
    }, [profileData, sortMode]);

    // Helper: Select Top N
    const selectTop = (n) => {
        const newSet = new Set();
        sortedVideos.slice(0, n).forEach(v => newSet.add(v.id));
        setSelectedVideos(newSet);
    };

    // Helper: Format Date
    const formatTimeAgo = (ts) => {
        if (!ts) return "";
        const diff = Date.now() - (ts * 1000);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        if (days < 30) return `${days} days ago`;
        return new Date(ts * 1000).toLocaleDateString();
    };

    // Animation trigger
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // 🔍 Single Video Lookup
    const handleLookup = async () => {
        if (!url.includes("tiktok.com")) return toast.error("Please enter a valid TikTok URL");
        setLoading(true);
        setVideoData(null);
        try {
            const res = await api.post("/tools/tiktok/lookup", { url });
            if (res.data.success) {
                const data = res.data.video;
                setVideoData(data);
                setUrl(""); // Clear input
                toast.success("Video found!");
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to find video");
        } finally {
            setLoading(false);
        }
    };

    // 👤 Profile Lookup
    const handleProfileLookup = async () => {
        if (!profileInput) return toast.error("Enter a username");
        setProfileLoading(true);
        setProfileData(null);
        setSelectedVideos(new Set());
        try {
            const res = await api.post("/tools/tiktok/profile", { username: profileInput }, { timeout: 90000 });
            if (res.data.success) {
                setProfileData(res.data);
                toast.success(`Found ${res.data.videos.length} videos`);
            }
        } catch (err) {
            console.error("Profile Lookp Error:", err);
            const msg = err.message?.includes("timeout")
                ? "Profile lookup took too long. TikTok might be slow, please try again."
                : (err.response?.data?.error || err.message || "Failed to fetch profile");
            toast.error(msg);
        } finally {
            setProfileLoading(false);
        }
    };

    // 📥 Download to App
    const handleSaveToApp = async () => {
        if (!videoData) return;
        setSaving(true);
        try {
            const res = await api.post("/tools/tiktok/download", {
                url: videoData.no_watermark_url,
                title: videoData.title
            });
            if (res.data.success) toast.success("Saved to Library!");
        } catch (err) {
            toast.error("Failed to save video");
        } finally {
            setSaving(false);
        }
    };

    // 📦 Bulk Logic
    const toggleSelect = (id) => {
        const newSet = new Set(selectedVideos);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedVideos(newSet);
    };

    const toggleSelectAll = () => {
        if (!profileData) return;
        if (selectedVideos.size === profileData.videos.length) {
            setSelectedVideos(new Set());
        } else {
            setSelectedVideos(new Set(profileData.videos.map(v => v.id)));
        }
    };

    const handleBulkDownload = async () => {
        const videosToDownload = profileData.videos.filter(v => selectedVideos.has(v.id));
        if (videosToDownload.length === 0) return toast.error("Select videos first");

        setIsDownloading(true);
        setDownloadProgress({ current: 0, total: videosToDownload.length });

        toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl pointer-events-auto flex flex-col overflow-hidden ring-1 ring-black/5`}>
                <div className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center shrink-0">
                        <Download className="h-6 w-6 text-pink-600 dark:text-pink-400 animate-bounce" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-white">Downloading {videosToDownload.length} Items</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Starting batch download...
                        </p>
                    </div>
                </div>
                <div className="bg-pink-50 dark:bg-pink-900/20 px-4 py-2.5 text-xs text-pink-700 dark:text-pink-300 flex items-start gap-2 border-t border-pink-100 dark:border-pink-900/30">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    <span>If prompted, please click <b>Allow</b> to save all files automatically.</span>
                </div>
            </div>
        ), { duration: 5000 });

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        let currentCount = 0;
        for (const v of videosToDownload) {
            currentCount++;
            setDownloadProgress(prev => ({ ...prev, current: currentCount }));

            const isSlideshow = v.type === 'slideshow';
            const isPhoto = v.type === 'photo';

            if (isSlideshow || isPhoto) {
                if (v.images && v.images.length > 0) {
                    for (let i = 0; i < v.images.length; i++) {
                        const imgUrl = v.images[i];
                        const safeFilename = `tiktok-${v.id}-${i + 1}.jpg`;
                        const proxyUrl = getProxyUrl(imgUrl, { filename: safeFilename, type: 'image/jpeg' });
                        triggerDownload(proxyUrl, safeFilename);
                        await delay(1000);
                    }
                }
            } else {
                let targetUrl = v.no_watermark_url || v.playUrl || v.url;
                if (!targetUrl && v.web_url) {
                    try {
                        const res = await api.post("/tools/tiktok/lookup", { url: v.web_url });
                        if (res.data.success && res.data.video?.no_watermark_url) {
                            targetUrl = res.data.video.no_watermark_url;
                        }
                    } catch (err) {
                        console.error("❌ Failed to resolve missing URL for:", v.id);
                    }
                }

                if (!targetUrl) continue;

                const rawTitle = v.title || v.desc || v.id || "tiktok_video";
                const title = String(rawTitle);
                const safeFilename = `tiktok-${title.replace(/[^a-z0-9\u0080-\uffff]/gi, '_').slice(0, 50)}.mp4`;
                const videoId = v.id || `video_${Date.now()}`;
                const downloadUrl = `${API_BASE}/api/tools/tiktok/stream?id=${videoId}&url=${encodeURIComponent(targetUrl)}&filename=${encodeURIComponent(safeFilename)}`;
                triggerDownload(downloadUrl, safeFilename);
                await delay(1500);
            }
        }

        toast.success("Bulk download finished!");
        setIsDownloading(false);
        setDownloadProgress({ current: 0, total: 0 });
    };

    const handleCombine = async () => {
        if (!videoData || !videoData.music) return toast.error("Audio is required to combine.");
        setIsCombining(true);
        const tId = toast.loading("កំពុងបញ្ចូលរូបភាព និងសំឡេង (សូមរង់ចាំ)...");
        try {
            const res = await api.post("/tools/tiktok/combine", {
                images: videoData.images && videoData.images.length > 0 ? videoData.images : [videoData.cover],
                audio: videoData.music,
                id: videoData.id,
                title: videoData.title
            });
            if (res.data.success && res.data.url) {
                const safeFilename = `tiktok-combined-${videoData.id}.mp4`;
                triggerDownload(res.data.url, safeFilename);
                toast.success("បញ្ចូលគ្នាជោគជ័យ!", { id: tId });
            } else {
                toast.error("បរាជ័យក្នុងការបញ្ចូលគ្នា", { id: tId });
            }
        } catch (err) {
            console.error("Combine error:", err);
            toast.error(err.response?.data?.error || "Failed to combine video", { id: tId });
        } finally {
            setIsCombining(false);
        }
    };

    const clearResult = () => {
        setVideoData(null);
        setUrl("");
    };

    return (
        <DashboardLayout>
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-500/30 rounded-full blur-[120px] opacity-50 animate-blob" />
                <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] bg-purple-500/30 rounded-full blur-[120px] opacity-50 animate-blob animation-delay-2000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-blue-500/30 rounded-full blur-[120px] opacity-50 animate-blob animation-delay-4000" />
            </div>

            <div className={`relative z-10 p-6 max-w-5xl mx-auto transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
                <div className="text-center mb-6 space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                        TikTok <span className="text-pink-600">Saver</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-base">
                        Download videos and profiles without watermarks.
                    </p>
                </div>

                <div className="flex justify-center mb-8 gap-2 p-1.5 bg-gray-100/50 dark:bg-gray-800/50 backdrop-blur-md rounded-2xl mx-auto w-fit border border-white/20">
                    <button
                        onClick={() => setActiveTab("single")}
                        className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === "single"
                            ? "bg-white dark:bg-white/10 shadow-sm text-gray-900 dark:text-white backdrop-blur-sm"
                            : "text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 dark:text-gray-400"}`}
                    >
                        Single Video
                    </button>
                    <button
                        onClick={() => setActiveTab("profile")}
                        className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === "profile"
                            ? "bg-white dark:bg-white/10 shadow-sm text-gray-900 dark:text-white backdrop-blur-sm"
                            : "text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 dark:text-gray-400"}`}
                    >
                        Profile & Bulk
                    </button>
                </div>

                <div className="relative min-h-[400px]">
                    {activeTab === "single" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                            <div className="max-w-xl mx-auto space-y-4">
                                <div className="relative flex items-center bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-xl border border-white/20 dark:border-white/10 shadow-xl shadow-black/5 overflow-hidden transition-all">
                                    <div className="pl-5 pr-3 text-gray-400">
                                        <Search size={22} />
                                    </div>
                                    <input
                                        type="text"
                                        value={url}
                                        onChange={(e) => {
                                            setUrl(e.target.value);
                                            if (videoData) setVideoData(null);
                                        }}
                                        onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                                        placeholder="Paste TikTok Link..."
                                        className="w-full bg-transparent py-3 pr-4 text-sm md:text-base text-gray-900 dark:text-white placeholder:text-gray-400 border-none shadow-none appearance-none outline-none"
                                    />
                                    {url && (
                                        <button onClick={() => setUrl("")} className="p-2 mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                            <X size={20} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            {!videoData && (
                                <button
                                    onClick={handleLookup}
                                    disabled={!url || loading}
                                    className={`w-full md:w-auto md:px-12 md:min-w-[200px] mx-auto block py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-pink-500/20 flex items-center justify-center gap-2 ${loading ? 'animate-pulse' : ''}`}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            <span>Processing...</span>
                                        </>
                                    ) : "Download Video"}
                                </button>
                            )}

                            {videoData && (
                                <div className="max-w-4xl mx-auto bg-white/40 dark:bg-black/40 backdrop-blur-2xl rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-2xl shadow-black/5 animate-in fade-in zoom-in-95 duration-200 relative">
                                    <button
                                        onClick={clearResult}
                                        className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        title="Clear Result"
                                    >
                                        <X size={20} className="text-gray-500 dark:text-gray-300" />
                                    </button>

                                    <div className="flex flex-row gap-3 md:gap-8">
                                        <div className="w-[35%] md:w-1/3 shrink-0 relative">
                                            {(videoData.type === 'slideshow' || videoData.type === 'photo' || (videoData.images && videoData.images.length > 0)) ? (
                                                <div className="aspect-[3/4] rounded-xl md:rounded-2xl overflow-hidden relative group bg-gray-100 dark:bg-gray-900 border border-white/10 shadow-lg">
                                                    <img src={videoData.images?.[0] || videoData.cover} alt="cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                    <div className="absolute top-2 left-2 right-2 md:top-3 md:left-3 md:right-auto px-1.5 py-0.5 md:px-3 md:py-1 bg-amber-500/90 backdrop-blur-md rounded md:rounded-lg text-black text-[8px] md:text-[10px] font-black border border-amber-400/50 shadow-xl tracking-tighter flex items-center justify-center md:justify-start gap-1">
                                                        {videoData.type === 'slideshow' || (videoData.images && videoData.images.length > 0) ? <><Layers size={10} /> {videoData.images.length} PHOTOS (LIVE)</> : "LIVE PHOTO"}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="aspect-[3/4] rounded-xl md:rounded-2xl overflow-hidden relative bg-black shadow-lg border border-white/10 group">
                                                    <video
                                                        src={`${API_BASE}/api/tools/tiktok/stream?id=${videoData.id || 'preview'}&url=${encodeURIComponent(videoData.no_watermark_url)}`}
                                                        className="w-full h-full object-cover"
                                                        controls
                                                        autoPlay
                                                        muted
                                                        loop
                                                        playsInline
                                                    />
                                                    <div className="absolute top-2 left-2 right-2 md:top-3 md:left-3 md:right-auto px-1.5 py-0.5 md:px-3 md:py-1 bg-sky-500/90 backdrop-blur-md rounded md:rounded-lg text-white text-[8px] md:text-[10px] font-black border border-sky-400/50 shadow-xl tracking-tighter text-center md:text-left">
                                                        NORMAL VIDEO (MP4)
                                                    </div>
                                                </div>
                                            )}
                                            {videoData.type === 'video' && (
                                                <div className="mt-2 text-center text-[10px] md:text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                                                    ⚠️ បើវីដេអូលោតពណ៌ខ្មៅ (ឭតែសំឡេង) មកពី Browser អត់ស្គាល់កូដិក <strong>H.265</strong>។<br />
                                                    សូមទាញយកធម្មតា វាអត់ខូចទេ (អាចមើលក្នុង VLC ឯកសារដើម)។
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 flex flex-col min-w-0">
                                            <div className="mb-2 md:mb-6">
                                                <span className="inline-block px-2 py-0.5 md:px-3 md:py-1 rounded-full bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 text-[10px] md:text-xs font-bold mb-1 md:mb-2 tracking-wide uppercase truncate max-w-full">
                                                    @{videoData.author.nickname || videoData.author.unique_id}
                                                </span>
                                                <h2 className="text-sm md:text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-2 md:mb-4 line-clamp-2 md:line-clamp-none">
                                                    {videoData.title || "Untitled Video"}
                                                </h2>
                                                <div className="flex flex-wrap gap-1.5 md:gap-2 items-center">
                                                    {[
                                                        (videoData.type === 'slideshow' || videoData.type === 'photo' || (videoData.images && videoData.images.length > 0)) ? 'Live Photo (រូបសន្លឹក)' : 'Normal Video (វីដេអូធម្មតា)',
                                                        'គុណភាពដើម (Original Quality)',
                                                        'No Watermark (គ្មានឡូហ្កូ)'
                                                    ].map(tag => (
                                                        <span key={tag} className="px-2 py-0.5 md:px-3 md:py-1 rounded-lg bg-white/40 dark:bg-white/5 backdrop-blur-md text-gray-700 dark:text-gray-300 text-[9px] md:text-xs font-semibold border border-white/20 whitespace-nowrap">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="mt-auto space-y-3">
                                                {(videoData.type === 'slideshow' || videoData.type === 'photo' || (videoData.images && videoData.images.length > 0)) ? (
                                                    <>
                                                        {videoData.images?.length > 0 ? (
                                                            <button
                                                                disabled={isDownloading}
                                                                onClick={async () => {
                                                                    const images = videoData.images;
                                                                    setIsDownloading(true);
                                                                    setDownloadProgress({ current: 0, total: images.length });
                                                                    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
                                                                    for (let i = 0; i < images.length; i++) {
                                                                        try {
                                                                            const img = images[i];
                                                                            const safeFilename = `tiktok-${videoData.id}-${i + 1}.jpg`;
                                                                            const proxyUrl = getProxyUrl(img, { filename: safeFilename, type: 'image/jpeg' });
                                                                            triggerDownload(proxyUrl, safeFilename);
                                                                            setDownloadProgress(prev => ({ ...prev, current: i + 1 }));
                                                                            if (i < images.length - 1) await delay(1000);
                                                                        } catch (err) { console.error(err); }
                                                                    }
                                                                    toast.success("All photos downloaded!");
                                                                    setIsDownloading(false);
                                                                    setDownloadProgress({ current: 0, total: 0 });
                                                                }}
                                                                className="relative w-full py-4 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 overflow-hidden shadow-lg shadow-pink-500/20"
                                                            >
                                                                {isDownloading ? (
                                                                    <>
                                                                        <div className="absolute inset-0 bg-white/20" style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%`, transition: 'width 0.5s ease' }} />
                                                                        <span className="relative z-10 flex items-center gap-2">
                                                                            <Loader2 className="animate-spin" size={20} />
                                                                            {downloadProgress.current} / {downloadProgress.total} Photos
                                                                        </span>
                                                                    </>
                                                                ) : (
                                                                    <><ImageIcon size={20} /> {videoData.images.length === 1 ? 'Download Photo' : `Download All Photos (${videoData.images.length})`}</>
                                                                )}
                                                            </button>
                                                        ) : (
                                                            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl text-center">
                                                                <p className="text-xs text-amber-800 dark:text-amber-400 font-medium">
                                                                    ⚠️ HD Photos not available individually.
                                                                </p>
                                                            </div>
                                                        )}

                                                        {videoData.music && (
                                                            <button
                                                                disabled={isCombining}
                                                                onClick={handleCombine}
                                                                className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 mt-2"
                                                            >
                                                                {isCombining ? (
                                                                    <><Loader2 className="animate-spin" size={20} /> Processing Video...</>
                                                                ) : (
                                                                    <><Video size={20} /> Combine to Video (HD .MP4)</>
                                                                )}
                                                            </button>
                                                        )}

                                                        <div className="flex flex-col gap-2">
                                                            {videoData.no_watermark_url && (
                                                                <button
                                                                    onClick={async () => {
                                                                        const targetUrl = videoData.no_watermark_url;
                                                                        const safeFilename = `tiktok-slideshow-video-${videoData.id}.mp4`;
                                                                        const proxyUrl = getProxyUrl(targetUrl, { filename: safeFilename, web_url: videoData.web_url, type: 'video/mp4' });
                                                                        triggerDownload(proxyUrl, safeFilename);
                                                                    }}
                                                                    className="w-full py-3 border-2 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 text-gray-600 dark:text-gray-300 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm"
                                                                >
                                                                    <Video size={16} /> Download Slideshow Video (MP4)
                                                                </button>
                                                            )}
                                                            {videoData.music && (
                                                                <button
                                                                    onClick={async () => {
                                                                        const targetUrl = videoData.music;
                                                                        const safeFilename = `tiktok-audio-${videoData.id}.mp3`;
                                                                        const proxyUrl = getProxyUrl(targetUrl, { filename: safeFilename, web_url: videoData.web_url, type: 'audio/mpeg' });
                                                                        triggerDownload(proxyUrl, safeFilename);
                                                                    }}
                                                                    className="w-full py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm"
                                                                >
                                                                    <Music size={16} /> Download Audio (MP3)
                                                                </button>
                                                            )}
                                                        </div>
                                                    </>
                                                ) : (
                                                    videoData.no_watermark_url ? (
                                                        <div className="flex flex-col gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    const rawTitle = videoData.title || videoData.desc || videoData.id || "tiktok_video";
                                                                    const title = String(rawTitle);
                                                                    const safeFilename = title.replace(/[^a-z0-9\u0080-\uffff]/gi, '_').slice(0, 50);
                                                                    const videoId = videoData.id || `video_${Date.now()}`;
                                                                    const targetUrl = videoData.no_watermark_url;
                                                                    const downloadUrl = `${API_BASE}/api/tools/tiktok/stream?id=${videoId}&url=${safeEncode(targetUrl)}&filename=${safeEncode(safeFilename + '.mp4')}`;
                                                                    triggerDownload(downloadUrl, `${safeFilename}.mp4`);
                                                                }}
                                                                className="w-full py-4 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20"
                                                            >
                                                                <Video size={20} /> Download Full Video (HD)
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    const tId = toast.loading("បម្លែងវីដេអូ...");
                                                                    try {
                                                                        const res = await api.post('/tools/tiktok/compatible', { url: videoData.web_url || url });
                                                                        if (res.data.success) {
                                                                            const proxyUrl = getProxyUrl(res.data.url, { filename: 'compatible.mp4', type: 'video/mp4' });
                                                                            triggerDownload(proxyUrl, 'compatible.mp4');
                                                                            toast.success("រួចរាល់!", { id: tId });
                                                                        }
                                                                    } catch { toast.error("Error", { id: tId }); }
                                                                }}
                                                                className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
                                                            >
                                                                <Play size={20} /> Fix Black Screen
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="p-4 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-center">
                                                            <p className="text-gray-500 dark:text-gray-400 font-medium">Video Not Available</p>
                                                        </div>
                                                    )
                                                )}
                                                <button onClick={clearResult} className="w-full py-4 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-900 dark:text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                                                    <Search size={20} /> Download Another
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "profile" && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            {!profileData && !profileLoading ? (
                                <div className="max-w-xl mx-auto">
                                    <div className="relative flex items-center bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-xl border border-white/20 dark:border-white/10 shadow-xl shadow-black/5 overflow-hidden transition-all">
                                        <span className="pl-5 text-gray-400 font-bold text-lg select-none">@</span>
                                        <input
                                            type="text"
                                            value={profileInput}
                                            onChange={(e) => setProfileInput(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleProfileLookup()}
                                            placeholder="username (e.g. khabylame)"
                                            className="w-full bg-transparent p-5 text-lg outline-none text-gray-900 dark:text-white border-none shadow-none"
                                        />
                                        <button onClick={handleProfileLookup} disabled={profileLoading || !profileInput} className="mr-2 px-6 py-2 bg-gray-900 text-white rounded-lg font-bold">
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                profileLoading ? <div className="text-center p-12"><Loader2 className="animate-spin mx-auto mb-4" /> Loading Profile...</div> : (
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4 p-4 bg-white/40 dark:bg-black/40 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg">
                                            <button onClick={() => setProfileData(null)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                                            {profileData.profile.avatar && <img src={getProxyUrl(profileData.profile.avatar)} className="w-16 h-16 rounded-full" />}
                                            <div>
                                                <h2 className="text-2xl font-bold">@{profileData.profile.username}</h2>
                                                <p className="text-xs text-gray-500">{selectedVideos.size} selected</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            {sortedVideos.map(video => (
                                                <div key={video.id} onClick={() => toggleSelect(video.id)} className={`cursor-pointer relative aspect-[3/4] rounded-xl overflow-hidden border-2 ${selectedVideos.has(video.id) ? 'border-pink-500' : 'border-transparent'}`}>
                                                    <img src={getProxyUrl(video.cover)} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/20" />
                                                    {selectedVideos.has(video.id) && <div className="absolute top-2 right-2 bg-pink-500 rounded-full p-1"><Check size={12} className="text-white" /></div>}
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={handleBulkDownload} disabled={isDownloading || selectedVideos.size === 0} className="fixed bottom-8 right-8 px-8 py-4 bg-pink-600 text-white rounded-full font-bold shadow-2xl">
                                            {isDownloading ? `Downloading ${downloadProgress.current}/${downloadProgress.total}` : `Download Selected (${selectedVideos.size})`}
                                        </button>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
