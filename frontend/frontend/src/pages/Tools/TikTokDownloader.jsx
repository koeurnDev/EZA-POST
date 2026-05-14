import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { 
    Search, Download, Check, Play, X, ChevronRight, Loader2, 
    Image as ImageIcon, Video, Music, Layers, Sparkles, 
    Zap, Trash2
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../utils/api";

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
    if (url.startsWith('/api/') || url.includes(API_BASE + '/api/')) return url;
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

// ✨ Motion Variants
const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.1 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
};

export default function TikTokDownloader() {
    const [activeTab, setActiveTab] = useState("single");
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [videoData, setVideoData] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isCombining, setIsCombining] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
    const [profileInput, setProfileInput] = useState("");
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileData, setProfileData] = useState(null);
    const [selectedVideos, setSelectedVideos] = useState(new Set());
    const [sortMode, setSortMode] = useState("date");
    const [forceCompatible, setForceCompatible] = useState(false);
    const [videoError, setVideoError] = useState(false);
    const location = useLocation();

    // 🚀 Auto-Lookup on Paste
    useEffect(() => {
        const detectAndLookup = async () => {
            if (url.trim() && (url.includes('tiktok.com') || url.includes('vt.tiktok.com'))) {
                if (!loading && (!videoData || videoData.originalUrl !== url)) {
                    handleLookup();
                }
            }
        };
        const timer = setTimeout(detectAndLookup, 800);
        return () => clearTimeout(timer);
    }, [url]);

    // 🔗 Auto-load from Home Page TikTok Link
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const initialUrl = params.get("url");
        if (initialUrl && initialUrl !== url && (initialUrl.includes("tiktok.com") || initialUrl.includes("vt.tiktok.com"))) {
            setUrl(initialUrl);
            handleLookup(initialUrl);
        }
    }, [location.search]);

    const sortedVideos = useMemo(() => {
        if (!profileData?.videos) return [];
        const videos = [...profileData.videos];
        return sortMode === "date" 
            ? videos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            : videos.sort((a, b) => b.stats.plays - a.stats.plays);
    }, [profileData, sortMode]);

    const handleFixH265 = async () => {
        const targetUrl = videoData?.originalUrl || videoData?.web_url || videoData?.no_watermark_url;
        if (!targetUrl) return;
        if (!videoData?.isH265) {
            toast.success("This video is already H.264 compatible. No conversion needed.");
            return;
        }

        setIsFixing(true);
        const tId = toast.loading("Optimizing video for your browser... this may take a moment.");
        try {
            const res = await api.post('/tools/tiktok/compatible', { url: targetUrl });
            if (res.data.success) {
                setVideoData(prev => ({
                    ...prev,
                    playUrl: res.data.url,
                    no_watermark_url: res.data.url,
                    isFixed: true,
                    isH265: false
                }));
                setVideoError(false);
                toast.success("Ready! You can play it now.", { id: tId });
            } else {
                toast.error(res.data.error || "Failed to convert video.", { id: tId });
            }
        } catch (err) {
            toast.error("Failed to convert video.", { id: tId });
        } finally {
            setIsFixing(false);
        }
    };

    const handleLookup = async (targetUrl = url) => {
        if (typeof targetUrl !== 'string') {
            targetUrl = url;
        }

        if (!targetUrl || (typeof targetUrl === 'string' && !targetUrl.includes("tiktok.com") && !targetUrl.includes("vt.tiktok.com"))) {
            return toast.error("Please enter a valid TikTok URL");
        }
        setLoading(true);
        setVideoData(null);
        setVideoError(false);
        try {
            const res = await api.post("/tools/tiktok/lookup", { url: targetUrl });
            if (res.data.success) {
                const data = res.data.video;
                data.originalUrl = targetUrl;
                setUrl(targetUrl);
                setVideoData(data);
                toast.success("Video Found!", { icon: "✨" });
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to find video");
        } finally {
            setLoading(false);
        }
    };

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
            toast.error(err.response?.data?.error || "Failed to fetch profile");
        } finally {
            setProfileLoading(false);
        }
    };

    const toggleSelect = (id) => {
        const newSet = new Set(selectedVideos);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedVideos(newSet);
    };

    const handleBulkDownload = async () => {
        const videosToDownload = profileData.videos.filter(v => selectedVideos.has(v.id));
        if (videosToDownload.length === 0) return toast.error("Select videos first");
        setIsDownloading(true);
        setDownloadProgress({ current: 0, total: videosToDownload.length });
        
        toast.loading(`Starting batch download of ${videosToDownload.length} items...`, { duration: 3000 });
        
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        let currentCount = 0;
        for (const v of videosToDownload) {
            currentCount++;
            setDownloadProgress(prev => ({ ...prev, current: currentCount }));
            const isMedia = v.type === 'slideshow' || v.type === 'photo';
            if (isMedia && v.images?.length > 0) {
                for (let i = 0; i < v.images.length; i++) {
                    const safeFilename = `tiktok-${v.id}-${i + 1}.jpg`;
                    triggerDownload(getProxyUrl(v.images[i], { filename: safeFilename, type: 'image/jpeg' }), safeFilename);
                    await delay(800);
                }
            } else {
                const targetUrl = v.no_watermark_url || v.playUrl;
                if (!targetUrl) continue;
                const safeFilename = `tiktok-${String(v.title || v.id).replace(/[^a-z0-9]/gi, '_').slice(0, 40)}.mp4`;
                let finalUrl = `${API_BASE}/api/tools/tiktok/stream?id=${v.id}&url=${encodeURIComponent(targetUrl)}&filename=${encodeURIComponent(safeFilename)}`;
                if (forceCompatible) {
                    try {
                        const compRes = await api.post('/tools/tiktok/compatible', { url: v.web_url || targetUrl });
                        if (compRes.data.success) finalUrl = compRes.data.url;
                    } catch (e) {}
                }
                triggerDownload(finalUrl, safeFilename);
                await delay(forceCompatible ? 3500 : 1800);
            }
        }
        toast.success("Batch download complete!");
        setIsDownloading(false);
    };

    const handleCombine = async () => {
        if (!videoData || !videoData.music) return toast.error("Audio is required to combine.");
        setIsCombining(true);
        const tId = toast.loading("Generating HD Video... This takes about 10-20 seconds.");
        try {
            const res = await api.post("/tools/tiktok/combine", {
                images: videoData.images?.length > 0 ? videoData.images : [videoData.cover],
                audio: videoData.music,
                id: videoData.id,
                title: videoData.title
            });
            if (res.data.success && res.data.url) {
                triggerDownload(res.data.url, `tiktok-hd-${videoData.id}.mp4`);
                toast.success("HD Video Generated!", { id: tId });
            }
        } catch (err) {
            toast.error("Generation failed.", { id: tId });
        } finally {
            setIsCombining(false);
        }
    };

    return (
        <DashboardLayout>
            {/* 🌈 Modern Background Mesh - Hidden on mobile for performance */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 hidden md:block">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-blue-500/20 to-emerald-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
            </div>

            <motion.div 
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="relative z-10 p-4 md:p-8 max-w-6xl mx-auto space-y-8 pb-24"
            >
                {/* 🏷️ Header */}
                <div className="text-center space-y-3">
                    <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-600 dark:text-pink-400 text-xs font-bold uppercase tracking-wider">
                        <Sparkles size={14} /> Premium Downloader
                    </motion.div>
                    <motion.h1 variants={itemVariants} className="text-3xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white">
                        TikTok <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-purple-600">Saver</span>
                    </motion.h1>
                    <motion.p variants={itemVariants} className="text-gray-500 dark:text-gray-400 max-w-md mx-auto text-sm md:text-base px-4">
                        Get high-quality content without watermarks. Pro-level tools for creators.
                    </motion.p>
                </div>

                {/* 📑 Tabs */}
                <motion.div variants={itemVariants} className="flex justify-center">
                    <div className="inline-flex p-1 bg-gray-200/50 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20">
                        {['single', 'profile'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`relative px-4 md:px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                                    activeTab === tab ? "text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                                }`}
                            >
                                {activeTab === tab && (
                                    <motion.div 
                                        layoutId="activeTab"
                                        className="absolute inset-0 bg-white dark:bg-white/10 shadow-lg rounded-xl z-0"
                                    />
                                )}
                                <span className="relative z-10 capitalize">{tab === 'single' ? 'Single Video' : 'Profile & Bulk'}</span>
                            </button>
                        ))}
                    </div>
                </motion.div>

                <AnimatePresence mode="wait">
                    {activeTab === "single" ? (
                        <motion.div 
                            key="single"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="space-y-8"
                        >
                            {/* 🔍 Search Input */}
                            <div className="max-w-2xl mx-auto relative group px-2">
                                <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-purple-600 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-500" />
                                <div className="relative flex items-center bg-white dark:bg-gray-900/80 backdrop-blur-2xl rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden">
                                    <div className="pl-4 md:pl-6 text-gray-400 shrink-0">
                                        <Search size={20} className="group-focus-within:text-pink-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        value={url}
                                        onChange={(e) => {
                                            setUrl(e.target.value);
                                            if (videoData) setVideoData(null);
                                        }}
                                        onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                                        placeholder="Paste Link here..."
                                        className="w-full bg-transparent py-4 md:py-5 px-3 md:px-4 text-base md:text-lg border-none focus:ring-0 focus:outline-none focus-visible:outline-none outline-none text-gray-900 dark:text-white placeholder:text-gray-500 min-w-0"
                                    />
                                    <div className="flex items-center gap-1 md:gap-2 pr-2 md:pr-4 shrink-0">
                                        {url && (
                                            <button onClick={() => setUrl("")} className="p-1 md:p-2 text-gray-400 hover:text-pink-500 transition-colors">
                                                <X size={18} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleLookup()}
                                            disabled={!url || loading}
                                            className="px-4 md:px-6 py-2 md:py-2.5 bg-gray-900 dark:bg-white/10 hover:bg-black dark:hover:bg-white/20 text-white rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {loading ? <Loader2 size={16} className="animate-spin" /> : "Fetch"}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 🎥 Result Card */}
                            <AnimatePresence>
                                {videoData && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 40 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="max-w-4xl mx-auto px-2"
                                    >
                                        <div className="bg-white/70 dark:bg-gray-900/50 backdrop-blur-3xl rounded-3xl p-4 md:p-8 border border-white/30 dark:border-white/10 shadow-2xl relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-[80px] -mr-32 -mt-32 transition-transform group-hover:scale-110 duration-1000" />
                                            
                                            <div className="flex flex-col md:flex-row gap-6 md:gap-8 relative z-10">
                                                {/* Preview Section */}
                                                <div className="w-full md:w-80 shrink-0">
                                                    <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-black shadow-2xl relative border border-white/20">
                                                        {(videoData.type === 'slideshow' || videoData.images?.length > 0) ? (
                                                            <img 
                                                                src={videoData.images?.[0] || videoData.cover} 
                                                                className="w-full h-full object-cover" 
                                                                referrerPolicy="no-referrer"
                                                                alt="Preview"
                                                            />
                                                        ) : (
                                                            <video
                                                                src={`${API_BASE}/api/tools/tiktok/stream?id=${videoData.id}&url=${encodeURIComponent(videoData.no_watermark_url || videoData.playUrl)}`}
                                                                className="w-full h-full object-cover"
                                                                controls
                                                                autoPlay
                                                                muted
                                                                loop
                                                                playsInline
                                                                onError={() => setVideoError(true)}
                                                            />
                                                        )}
                                                        <div className="absolute top-4 left-4">
                                                            <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/20 text-[10px] font-black text-white flex items-center gap-1.5 shadow-lg">
                                                                <Zap size={12} className="text-yellow-400 fill-yellow-400" />
                                                                {videoData.type?.toUpperCase() || 'VIDEO'}
                                                            </div>
                                                        </div>
                                                        {videoError && !videoData.isFixed && (
                                                            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 md:p-8 text-center animate-pulse">
                                                                <Loader2 size={32} className="text-pink-500 animate-spin mb-4" />
                                                                <p className="text-white font-bold mb-1 text-sm md:text-base">Optimizing playback...</p>
                                                                <p className="text-[10px] md:text-xs text-gray-400 px-4">TikTok video is being converted to H.264 for your device.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Info Section */}
                                                <div className="flex-1 flex flex-col min-w-0 py-2">
                                                    <div className="space-y-4 mb-6 md:mb-8">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0">
                                                                {videoData.author?.nickname?.[0]?.toUpperCase() || "T"}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h3 className="font-bold text-gray-900 dark:text-white truncate text-sm md:text-base">@{videoData.author?.nickname || videoData.author?.unique_id}</h3>
                                                                <p className="text-[10px] md:text-xs text-gray-500">TikTok Creator</p>
                                                            </div>
                                                        </div>
                                                        <h2 className="text-lg md:text-2xl font-black text-gray-900 dark:text-white leading-tight line-clamp-2 md:line-clamp-3">
                                                            {videoData.title || "Untitled Masterpiece"}
                                                        </h2>
                                                        <div className="flex flex-wrap gap-2">
                                                            {['No Watermark', 'HD Quality', 'Original Audio'].map(tag => (
                                                                <span key={tag} className="px-2.5 py-1 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[9px] md:text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="mt-auto grid grid-cols-1 gap-3">
                                                        {videoData.type === 'slideshow' ? (
                                                            <button
                                                                onClick={handleCombine}
                                                                disabled={isCombining}
                                                                className="group relative h-12 md:h-14 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white rounded-2xl font-black text-sm md:text-base shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 overflow-hidden"
                                                            >
                                                                {isCombining ? <Loader2 className="animate-spin" /> : <Video size={18} />}
                                                                Generate HD Video Slideshow
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => {
                                                                    const name = `${String(videoData.title || videoData.id).replace(/[^a-z0-9]/gi, '_').slice(0, 30)}.mp4`;
                                                                    triggerDownload(`${API_BASE}/api/tools/tiktok/stream?id=${videoData.id}&url=${encodeURIComponent(videoData.no_watermark_url)}&filename=${encodeURIComponent(name)}`, name);
                                                                }}
                                                                className="h-12 md:h-14 bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-gray-100 rounded-2xl font-black text-sm md:text-base shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                                            >
                                                                <Download size={18} /> Download HD Video
                                                            </button>
                                                        )}

                                                        <div className="grid grid-cols-2 gap-2 md:gap-3">
                                                            {videoData.images?.length > 0 && (
                                                                <button
                                                                    onClick={() => {
                                                                        videoData.images.forEach((img, i) => {
                                                                            setTimeout(() => {
                                                                                triggerDownload(getProxyUrl(img, { filename: `photo_${i+1}.jpg` }), `photo_${i+1}.jpg`);
                                                                            }, i * 800);
                                                                        });
                                                                        toast.success(`Downloading ${videoData.images.length} photos...`);
                                                                    }}
                                                                    className="h-10 md:h-12 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-[10px] md:text-xs hover:bg-gray-50 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                                                >
                                                                    <ImageIcon size={14} /> All Photos
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    if (!videoData.music) return toast.error("No audio found.");
                                                                    triggerDownload(getProxyUrl(videoData.music, { filename: "audio.mp3", type: "audio/mpeg" }), "audio.mp3");
                                                                }}
                                                                className="h-10 md:h-12 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-[10px] md:text-xs hover:bg-gray-50 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                                            >
                                                                <Music size={14} /> Save Audio
                                                            </button>
                                                        </div>

                                                        {videoData.isH265 && !videoData.isFixed && !videoData.type?.includes('slide') && (
                                                            <button
                                                                onClick={handleFixH265}
                                                                disabled={isFixing}
                                                                className="h-10 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-xl font-bold text-[9px] md:text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <Zap size={12} /> {isFixing ? 'Converting...' : 'Fix Compatibility (H.264)'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="profile"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8 pb-32"
                        >
                            {/* 👤 Profile Search */}
                            {!profileData && (
                                <div className="max-w-xl mx-auto relative group px-2">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-500" />
                                    <div className="relative flex items-center bg-white dark:bg-gray-900/80 backdrop-blur-2xl rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden">
                                        <div className="pl-4 md:pl-6 text-gray-500 font-black text-lg md:text-xl shrink-0">@</div>
                                        <input
                                            type="text"
                                            value={profileInput}
                                            onChange={(e) => setProfileInput(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleProfileLookup()}
                                            placeholder="Enter username..."
                                            className="w-full bg-transparent py-4 md:py-5 px-3 md:px-4 text-base md:text-lg border-none focus:ring-0 focus:outline-none focus-visible:outline-none outline-none text-gray-900 dark:text-white placeholder:text-gray-500 min-w-0"
                                        />
                                        <button 
                                            onClick={handleProfileLookup}
                                            disabled={profileLoading || !profileInput}
                                            className="mr-2 md:mr-4 p-2.5 md:p-3 bg-gray-900 dark:bg-white/10 text-white rounded-xl hover:scale-105 transition-all disabled:opacity-50"
                                        >
                                            {profileLoading ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 📱 Profile Content */}
                            {profileData && (
                                <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 px-2 md:px-0">
                                    {/* Profile Summary Bar */}
                                    <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-white/40 dark:bg-black/40 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-xl relative overflow-hidden">
                                        <button 
                                            onClick={() => setProfileData(null)}
                                            className="absolute top-4 right-4 p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                        
                                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white/50 shadow-2xl overflow-hidden shrink-0 bg-gray-200">
                                            {profileData.profile.avatar ? (
                                                <img src={getProxyUrl(profileData.profile.avatar)} className="w-full h-full object-cover" alt="avatar" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-pink-500 text-white text-2xl md:text-3xl font-black">
                                                    {profileData.profile.username[0].toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-center md:text-left flex-1 min-w-0">
                                            <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white truncate mb-1">@{profileData.profile.username}</h2>
                                            <div className="flex items-center justify-center md:justify-start gap-4 text-xs md:text-sm text-gray-500 font-bold">
                                                <span>{profileData.videos.length} Videos</span>
                                                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                                <button onClick={() => {
                                                    if (selectedVideos.size === profileData.videos.length) setSelectedVideos(new Set());
                                                    else setSelectedVideos(new Set(profileData.videos.map(v => v.id)));
                                                }} className="text-pink-600 hover:underline">
                                                    {selectedVideos.size === profileData.videos.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 bg-white/20 dark:bg-white/5 rounded-2xl border border-white/10 shrink-0">
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <div className={`w-9 h-5 md:w-10 md:h-6 rounded-full transition-colors relative ${forceCompatible ? 'bg-pink-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${forceCompatible ? 'left-4.5 md:left-5' : 'left-0.5 md:left-1'}`} />
                                                </div>
                                                <input type="checkbox" className="hidden" checked={forceCompatible} onChange={(e) => setForceCompatible(e.target.checked)} />
                                                <span className="text-[9px] md:text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-tighter">Force H.264</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Video Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                                        {sortedVideos.map((video, idx) => (
                                            <motion.div 
                                                key={video.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(idx * 0.05, 1) } }}
                                                onClick={() => toggleSelect(video.id)}
                                                className={`group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer border-2 md:border-4 transition-all duration-300 hover:scale-[1.02] shadow-lg ${
                                                    selectedVideos.has(video.id) ? 'border-pink-500 ring-2 md:ring-4 ring-pink-500/20' : 'border-transparent'
                                                }`}
                                            >
                                                <img src={getProxyUrl(video.cover)} className="w-full h-full object-cover" loading="lazy" alt="thumb" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                                                {selectedVideos.has(video.id) && (
                                                    <div className="absolute top-2 right-2 md:top-3 md:right-3 bg-pink-500 text-white p-1 md:p-1.5 rounded-full shadow-2xl">
                                                        <Check size={12}  strokeWidth={4} />
                                                    </div>
                                                )}
                                                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest drop-shadow-md">
                                                    <div className="flex items-center gap-1">
                                                        <Play size={8}  fill="white" stroke="none" />
                                                        {video.stats?.plays > 1000 ? (video.stats.plays / 1000).toFixed(1) + 'K' : (video.stats?.plays || 0)}
                                                    </div>
                                                    {video.type === 'slideshow' && <Layers size={10}  />}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* Floating Bulk Action Bar */}
                                    <AnimatePresence>
                                        {selectedVideos.size > 0 && (
                                            <motion.div 
                                                initial={{ y: 100, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                exit={{ y: 100, opacity: 0 }}
                                                className="fixed bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-[100]"
                                            >
                                                <div className="bg-gray-900/90 dark:bg-white/90 backdrop-blur-3xl p-3 md:p-4 rounded-3xl border border-white/20 shadow-2xl flex items-center justify-between gap-3 md:gap-4 overflow-hidden relative">
                                                    {isDownloading && (
                                                        <motion.div className="absolute bottom-0 left-0 h-1 bg-pink-500" initial={{ width: 0 }} animate={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }} />
                                                    )}
                                                    <div className="flex flex-col min-w-0 ml-1 md:ml-2">
                                                        <span className="text-white dark:text-gray-900 text-base md:text-lg font-black">{selectedVideos.size} Items</span>
                                                        <span className="text-pink-500 dark:text-pink-600 text-[9px] md:text-[10px] font-black uppercase tracking-widest truncate">
                                                            {isDownloading ? `Downloading ${downloadProgress.current}/${downloadProgress.total}` : 'Ready'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 md:gap-2 shrink-0">
                                                        <button onClick={() => setSelectedVideos(new Set())} className="p-2 md:p-3 text-gray-400 hover:text-white dark:hover:text-black transition-colors"><Trash2 size={18}  /></button>
                                                        <button onClick={handleBulkDownload} disabled={isDownloading} className="px-4 md:px-6 py-2.5 md:py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-2xl font-black text-xs md:text-sm transition-all shadow-xl disabled:opacity-50 flex items-center gap-2">
                                                            {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                                            <span className="hidden sm:inline">{isDownloading ? 'Processing' : 'Download'}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </DashboardLayout>
    );
}
