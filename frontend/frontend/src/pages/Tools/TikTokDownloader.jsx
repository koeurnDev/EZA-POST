import React, { useState, useEffect, useMemo } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Search, Download, Check, Play, User, X, ChevronRight, Loader2, Image as ImageIcon, Video, Music, Layers } from "lucide-react";
import toast from "react-hot-toast";
import api, { API_CONFIG } from "../../utils/api";

// 🛠️ Helper for clean API URLs
// 🛠️ Helper for clean API URLs
const API_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.MODE === 'development' ? "http://localhost:5000" : "https://eza-post-backend.onrender.com")).replace(/\/api$/, "");

// 🛡️ Robust Proxy Helper
const getProxyUrl = (url, options = {}) => {
    if (!url) return "";
    const { filename = "file", type = "" } = options;
    let proxyUrl = `${API_BASE}/api/tools/tiktok/proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    if (type) proxyUrl += `&type=${encodeURIComponent(type)}`;
    if (options.web_url) proxyUrl += `&web_url=${encodeURIComponent(options.web_url)}`;
    return proxyUrl;
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
    const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

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
                setVideoData(res.data.video);
                setUrl(""); // Clear input for next download
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
                console.log("🔍 Check Data:", res.data.videos); // Debugging
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
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                        <div className="flex-shrink-0 pt-0.5">
                            <Download className="h-10 w-10 text-pink-500" />
                        </div>
                        <div className="ml-3 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                Starting {videosToDownload.length} items...
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                                Please click <span className="font-bold">"Allow"</span> if browser asks to download multiple files.
                            </p>
                        </div>
                    </div>
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
                // 📸 For Slideshows/Photos: Download images individually
                if (v.images && v.images.length > 0) {
                    for (let i = 0; i < v.images.length; i++) {
                        const imgUrl = v.images[i];
                        const safeFilename = `tiktok-${v.id}-${i + 1}.jpg`;
                        const proxyUrl = getProxyUrl(imgUrl, { filename: safeFilename, type: 'image/jpeg' });

                        const link = document.createElement('a');
                        link.href = proxyUrl;
                        link.setAttribute('download', safeFilename);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);

                        await delay(1000); // 1s between images
                    }
                } else {
                    console.warn("Slideshow missing images:", v.id);
                    toast.error(`Images missing for post ${v.id}. Skipping.`);
                }
            } else {
                // 🎬 For Video: Download MP4
                // Fallback to playUrl or regular url if no_watermark_url is missing
                let targetUrl = v.no_watermark_url || v.playUrl || v.url;

                // 🔄 Fallback: If no direct URL, try to resolve via web_url
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

                if (!targetUrl) {
                    console.error("❌ Skipping video due to missing URL:", v);
                    continue;
                }

                const rawTitle = v.title || v.desc || v.id || "tiktok_video";
                const title = String(rawTitle);
                const safeFilename = `tiktok-${title.replace(/[^a-z0-9\u0080-\uffff]/gi, '_').slice(0, 50)}.mp4`;

                // Use the robust /stream endpoint
                const videoId = v.id || `video_${Date.now()}`;
                const downloadUrl = `${API_BASE}/api/tools/tiktok/stream?id=${videoId}&url=${encodeURIComponent(targetUrl)}&filename=${encodeURIComponent(safeFilename)}`;

                const link = document.createElement('a');
                link.href = downloadUrl;
                link.setAttribute('download', safeFilename);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                await delay(1500); // 1.5s between videos
            }
        }

        toast.success("Bulk download finished!");
        setIsDownloading(false);
        setDownloadProgress({ current: 0, total: 0 });
    };

    const clearResult = () => {
        setVideoData(null);
        setUrl("");
    };

    return (
        <DashboardLayout>
            {/* Ambient Background Blobs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-500/30 rounded-full blur-[120px] opacity-50 animate-blob" />
                <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] bg-purple-500/30 rounded-full blur-[120px] opacity-50 animate-blob animation-delay-2000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-blue-500/30 rounded-full blur-[120px] opacity-50 animate-blob animation-delay-4000" />
            </div>

            <div className={`relative z-10 p-6 max-w-5xl mx-auto transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

                {/* Header */}
                <div className="text-center mb-6 space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                        TikTok <span className="text-pink-600">Saver</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-base">
                        Download videos and profiles without watermarks.
                    </p>
                </div>

                {/* Tabs */}
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

                {/* Content Area */}
                <div className="relative min-h-[400px]">

                    {/* === Single Video View === */}
                    {activeTab === "single" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">

                            {/* Input Field (Always Visible) */}
                            <div className="max-w-xl mx-auto space-y-4">
                                {/* Input Container */}
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
                                        className="w-full bg-transparent py-3 pr-4 text-sm md:text-base text-gray-900 dark:text-white placeholder:text-gray-400 border-none shadow-none appearance-none"
                                        style={{
                                            boxShadow: 'none',
                                            borderColor: 'transparent',
                                            outline: 'none',
                                            caretColor: '#ec4899'
                                        }}
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

                            {/* Result Card */}
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
                                        {/* Media Preview */}
                                        <div className="w-[35%] md:w-1/3 shrink-0 relative">
                                            {(videoData.type === 'slideshow' || videoData.type === 'photo' || (videoData.images && videoData.images.length > 0)) ? (
                                                <div className="aspect-[3/4] rounded-xl md:rounded-2xl overflow-hidden relative group bg-gray-100 dark:bg-gray-900 border border-white/10 shadow-lg">
                                                    <img src={videoData.images?.[0] || videoData.cover} alt="cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                    <div className="absolute top-2 left-2 right-2 md:top-3 md:left-3 md:right-auto px-1.5 py-0.5 md:px-3 md:py-1 bg-amber-500/90 backdrop-blur-md rounded md:rounded-lg text-black text-[8px] md:text-[10px] font-black border border-amber-400/50 shadow-xl tracking-tighter flex items-center justify-center md:justify-start gap-1">
                                                        {videoData.type === 'slideshow' ? <><Layers size={10} /> {videoData.images.length}</> : "PHOTO"}
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
                                                        MP4
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {/* Actions */}
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
                                                        (videoData.type === 'slideshow' || videoData.type === 'photo') ? 'រូប គុណភាពដើម 100%' : 'Video គុណភាពដើម 100%',
                                                        'Ultra Clear (ច្បាស់)',
                                                        'No Watermark (គ្មាន)'
                                                    ].map(tag => (
                                                        <span key={tag} className="px-2 py-0.5 md:px-3 md:py-1 rounded-lg bg-white/40 dark:bg-white/5 backdrop-blur-md text-gray-700 dark:text-gray-300 text-[9px] md:text-xs font-semibold border border-white/20 whitespace-nowrap">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="mt-auto space-y-3">
                                                {videoData.type === 'slideshow' || videoData.type === 'photo' ? (
                                                    <>
                                                        {videoData.images?.length > 0 ? (
                                                            <button
                                                                disabled={isDownloading}
                                                                onClick={async () => {
                                                                    const images = videoData.images;
                                                                    setIsDownloading(true);
                                                                    setDownloadProgress({ current: 0, total: images.length });

                                                                    toast.custom((t) => (
                                                                        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                                                                            <div className="flex-1 w-0 p-4">
                                                                                <div className="flex items-start">
                                                                                    <Download className="h-10 w-10 text-pink-500" />
                                                                                    <div className="ml-3 flex-1">
                                                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                                                            Downloading {images.length} photos...
                                                                                        </p>
                                                                                        <p className="mt-1 text-sm text-gray-500">
                                                                                            Please click <span className="font-bold text-gray-900 dark:text-white">"Allow"</span> if browser asks to download multiple files.
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ), { duration: 5000 });

                                                                    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

                                                                    for (let i = 0; i < images.length; i++) {
                                                                        try {
                                                                            const img = images[i];
                                                                            const safeFilename = `tiktok-${videoData.id}-${i + 1}.jpg`;
                                                                            const proxyUrl = getProxyUrl(img, { filename: safeFilename, type: 'image/jpeg' });

                                                                            const link = document.createElement('a');
                                                                            link.href = proxyUrl;
                                                                            link.setAttribute('download', safeFilename);
                                                                            document.body.appendChild(link);
                                                                            link.click();
                                                                            document.body.removeChild(link);

                                                                            setDownloadProgress(prev => ({ ...prev, current: i + 1 }));
                                                                            if (i < images.length - 1) await delay(1000);
                                                                        } catch (err) {
                                                                            console.error("Index failed:", i, err);
                                                                        }
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
                                                                    <><ImageIcon size={20} /> Download All Photos ({videoData.images.length})</>
                                                                )}
                                                            </button>
                                                        ) : (
                                                            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                                                                <p className="text-xs text-amber-800 dark:text-amber-400 font-medium text-center">
                                                                    ⚠️ HD Photos could not be extracted individually for this slideshow. You can still download the background video below.
                                                                </p>
                                                            </div>
                                                        )}
                                                        <button
                                                            onClick={async () => {
                                                                const targetUrl = videoData.no_watermark_url;
                                                                const safeFilename = `tiktok-slideshow-${videoData.id}`;
                                                                const proxyUrl = getProxyUrl(targetUrl, { filename: safeFilename, web_url: videoData.web_url });
                                                                window.open(proxyUrl, '_blank');
                                                            }}
                                                            className="w-full py-3 border-2 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 text-gray-600 dark:text-gray-300 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm"
                                                        >
                                                            <Music size={16} /> Download {videoData.type === 'slideshow' ? 'SlideShow' : 'Photo'} Background (MP4)
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            const rawTitle = videoData.title || videoData.desc || videoData.id || "tiktok_video";
                                                            const title = String(rawTitle);
                                                            // Sanitize filename for client download attrib
                                                            const safeFilename = title.replace(/[^a-z0-9\u0080-\uffff]/gi, '_').slice(0, 50);

                                                            // Use /stream endpoint with deleteAfter=true
                                                            // Note: We encodeURIComponent twice for the URL parameter to be safe, 
                                                            // but here just encoding the value is enough.
                                                            const videoId = videoData.id || `video_${Date.now()}`;
                                                            const downloadUrl = `${API_BASE}/api/tools/tiktok/stream?id=${videoId}&url=${encodeURIComponent(videoData.no_watermark_url)}&filename=${encodeURIComponent(safeFilename + '.mp4')}`;

                                                            const link = document.createElement('a');
                                                            link.href = downloadUrl;
                                                            link.setAttribute('download', `${safeFilename}.mp4`);
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            document.body.removeChild(link);
                                                            toast.success("Saved to device & Cleaned from server!");
                                                        }}
                                                        className="w-full py-2.5 md:py-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-lg md:rounded-xl font-bold transition-all duration-300 transform hover:-translate-y-0.5 hover:shadow-xl hover:shadow-pink-500/40 flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 active:scale-95 group/btn text-sm md:text-base"
                                                    >
                                                        <Download className="w-4 h-4 md:w-5 md:h-5 group-hover/btn:animate-bounce" />
                                                        <span>Download Full Video <span className="hidden md:inline">(HD - MP4)</span></span>
                                                    </button>
                                                )}

                                                {/* Save to Library - Disabled for now */}
                                                {/* {!videoData.images?.length && (
                                                    <button
                                                        onClick={handleSaveToApp}
                                                        disabled={saving}
                                                        className="w-full py-4 border-2 border-gray-200 dark:border-gray-700 hover:border-gray-900 dark:hover:border-white text-gray-700 dark:text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                                    >
                                                        {saving ? <Loader2 className="animate-spin" /> : <><Check size={20} /> Save to Library</>}
                                                    </button>
                                                )} */}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* === Profile View === */}
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
                                            className="w-full bg-transparent p-5 text-lg outline-none text-gray-900 dark:text-white placeholder:text-gray-400 border-none shadow-none appearance-none"
                                            style={{
                                                boxShadow: 'none',
                                                borderColor: 'transparent',
                                                outline: 'none',
                                                caretColor: '#ec4899'
                                            }}
                                        />
                                        <button
                                            onClick={handleProfileLookup}
                                            disabled={profileLoading || !profileInput}
                                            className="mr-2 px-6 py-2 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black rounded-lg font-bold transition-all disabled:opacity-50"
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                    <p className="text-center text-gray-500 mt-4 text-sm">Download all latest videos from a public profile.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {profileLoading ? (
                                        <div>
                                            {/* Skeleton Loader */}
                                            <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
                                                <div className="flex gap-3 animate-pulse">
                                                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                                                    <div className="space-y-2">
                                                        <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                                                        <div className="w-20 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 px-1">
                                                {[...Array(10)].map((_, i) => (
                                                    <div key={i} className="aspect-[3/4] bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 sticky top-4 z-20">
                                                <div className="flex items-center gap-4 mb-8 p-4 bg-white/40 dark:bg-black/40 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/10 shadow-lg">
                                                    <button onClick={() => setProfileData(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={20} /></button>
                                                    {profileData.profile.avatar && (
                                                        <img
                                                            src={getProxyUrl(profileData.profile.avatar, { filename: `avatar-${profileData.profile.username}`, type: 'image/jpeg' })}
                                                            alt={profileData.profile.username}
                                                            className="w-16 h-16 rounded-full border-2 border-white dark:border-gray-700 shadow-md"
                                                            referrerPolicy="no-referrer"
                                                            onError={(e) => {
                                                                console.error("Avatar Load Failed:", e.target.src);
                                                                e.target.onerror = null;
                                                                e.target.src = `https://ui-avatars.com/api/?name=${profileData.profile.username}&background=random`;
                                                            }}
                                                        />
                                                    )}
                                                    <div>
                                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">@{profileData.profile.username}</h2>
                                                        <p className="text-xs text-gray-500">{selectedVideos.size} selected</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-end sm:items-center">
                                                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                                                        <span className="text-xs font-bold text-gray-500 px-2">Select:</span>
                                                        <button onClick={() => selectTop(5)} className="px-2 py-1 text-xs font-bold hover:bg-white dark:hover:bg-gray-600 rounded">Top 5</button>
                                                        <button onClick={() => selectTop(10)} className="px-2 py-1 text-xs font-bold hover:bg-white dark:hover:bg-gray-600 rounded">Top 10</button>
                                                        <button onClick={toggleSelectAll} className="px-2 py-1 text-xs font-bold hover:bg-white dark:hover:bg-gray-600 rounded">All</button>
                                                    </div>

                                                    <select
                                                        value={sortMode}
                                                        onChange={(e) => setSortMode(e.target.value)}
                                                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-bold outline-none border-none cursor-pointer"
                                                    >
                                                        <option value="date">📅 Newest</option>
                                                        <option value="plays">🔥 Most Played</option>
                                                    </select>

                                                    <button
                                                        onClick={handleBulkDownload}
                                                        disabled={selectedVideos.size === 0 || isDownloading}
                                                        className="relative px-4 py-2 text-sm font-bold bg-pink-600 text-white hover:bg-pink-700 rounded-lg shadow-lg shadow-pink-500/20 transition-all disabled:opacity-50 disabled:shadow-none ml-2 overflow-hidden flex items-center justify-center min-w-[140px]"
                                                    >
                                                        {isDownloading ? (
                                                            <>
                                                                <div className="absolute inset-0 bg-green-500/30" style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%`, transition: 'width 0.5s ease' }} />
                                                                <span className="relative z-10 flex items-center gap-2">
                                                                    <Loader2 className="animate-spin" size={14} />
                                                                    {downloadProgress.current} / {downloadProgress.total}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>Download Selected ({selectedVideos.size})</>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 px-1">
                                                {sortedVideos.map((video) => {
                                                    const isSelected = selectedVideos.has(video.id);
                                                    return (
                                                        <div
                                                            key={video.id}
                                                            onClick={() => toggleSelect(video.id)}
                                                            className={`cursor-pointer group relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 transition-all duration-200 ${isSelected ? 'ring-4 ring-pink-500 ring-offset-2 dark:ring-offset-gray-900' : 'hover:opacity-90'}`}
                                                        >
                                                            {video.cover && (
                                                                <img
                                                                    src={getProxyUrl(video.cover, { filename: `cover-${video.id}`, type: 'image/jpeg' })}
                                                                    className="w-full h-full object-cover absolute inset-0 transition-opacity duration-300 group-hover:opacity-0"
                                                                    loading="lazy"
                                                                    referrerPolicy="no-referrer"
                                                                    onError={(e) => {
                                                                        console.error(`Cover Load Failed for ${video.id}:`, e.target.src);
                                                                        e.target.onerror = null;
                                                                        e.target.parentElement.classList.add('bg-gray-200');
                                                                    }}
                                                                />
                                                            )}
                                                            {video.dynamic_cover && (
                                                                <img
                                                                    src={getProxyUrl(video.dynamic_cover, { filename: `dynamic-${video.id}`, type: 'image/webp' })}
                                                                    className="w-full h-full object-cover absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                                                    loading="lazy"
                                                                    referrerPolicy="no-referrer"
                                                                    onError={(e) => {
                                                                        console.warn(`Dynamic cover failed for ${video.id}`);
                                                                        e.target.style.display = 'none';
                                                                    }}
                                                                />
                                                            )}
                                                            <div className={`absolute inset-0 bg-black/20 ${isSelected ? 'bg-pink-500/20' : ''}`} />

                                                            {/* Selection Circle */}
                                                            <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-pink-500 border-pink-500 scale-110' : 'border-white/80 bg-black/20'}`}>
                                                                {isSelected && <Check size={14} className="text-white" />}
                                                            </div>

                                                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent pt-8">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center text-white/90 text-[10px] md:text-xs">
                                                                        {video.type === 'slideshow' || video.type === 'photo' ? (
                                                                            <><ImageIcon size={12} className="mr-1" /> {video.images?.length || 1}</>
                                                                        ) : (
                                                                            <><Play size={12} className="mr-1 fill-white" /> {video.stats?.plays || 0}</>
                                                                        )}
                                                                    </div>
                                                                    <div className="px-2 py-0.5 bg-black/50 backdrop-blur-md rounded text-[9px] md:text-[10px] text-white font-medium">
                                                                        {formatTimeAgo(video.timestamp)}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none">
                                                                {(video.type === 'slideshow' || (video.images && video.images.length > 1)) ? (
                                                                    <span className="px-1.5 py-0.5 bg-yellow-500 text-black text-[9px] font-black rounded shadow-sm border border-yellow-400 flex items-center gap-1">
                                                                        <Layers size={10} /> SLIDESHOW
                                                                    </span>
                                                                ) : video.type === 'photo' ? (
                                                                    <span className="px-1.5 py-0.5 bg-amber-500 text-black text-[9px] font-black rounded shadow-sm border border-amber-400 flex items-center gap-1">
                                                                        <ImageIcon size={10} /> PHOTO
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-1.5 py-0.5 bg-sky-600 text-white text-[9px] font-black rounded shadow-sm border border-sky-400 flex items-center gap-1">
                                                                        <Video size={10} /> VIDEO
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout >
    );
}
