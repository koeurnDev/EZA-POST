import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { 
    Search, Download, Youtube, Loader2, CheckCircle, Video, 
    PlaySquare, CheckSquare, X, Music, Layers, Sparkles, 
    Zap, Trash2, ChevronRight
} from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

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

export default function YoutubeDownloader() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    
    // Single Video State
    const [videoData, setVideoData] = useState(null);
    const [progress, setProgress] = useState(0);
    const [progressStatus, setProgressStatus] = useState("");
    const [downloadingMp3, setDownloadingMp3] = useState(false);
    const [downloadingMp4, setDownloadingMp4] = useState(false);
    const [selectedQuality, setSelectedQuality] = useState(1080);
    const [selectedAudioQuality, setSelectedAudioQuality] = useState(320);

    // Playlist/Channel State
    const [isPlaylist, setIsPlaylist] = useState(false);
    const [playlistTitle, setPlaylistTitle] = useState("");
    const [playlistVideos, setPlaylistVideos] = useState([]);
    const [selectedVideoIds, setSelectedVideoIds] = useState(new Set());
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    // ⏳ Simulated Progress
    useEffect(() => {
        let interval;
        if (downloadingMp4 || downloadingMp3) {
            setProgress(0);
            setProgressStatus("Initializing...");
            interval = setInterval(() => {
                setProgress(old => {
                    const increment = selectedQuality <= 720 ? Math.random() * 8 : Math.random() * 2;
                    const newProgress = old + increment;
                    if (newProgress > 95) return 95;
                    if (newProgress < 20) setProgressStatus("Downloading from YouTube...");
                    else if (newProgress < 50) setProgressStatus("Extracting Streams...");
                    else if (newProgress < 80) setProgressStatus("Merging Assets (FFmpeg)...");
                    else setProgressStatus("Finalizing...");
                    return newProgress;
                });
            }, 800);
        } else {
            setProgress(0);
            setProgressStatus("");
        }
        return () => clearInterval(interval);
    }, [downloadingMp4, downloadingMp3, selectedQuality]);

    const handleLookup = async () => {
        if (!url.includes("youtube.com") && !url.includes("youtu.be")) return toast.error("Invalid YouTube URL");
        setLoading(true);
        setVideoData(null);
        setIsPlaylist(false);
        try {
            const res = await api.post("/tools/youtube/lookup", { url }, { timeout: 60000 });
            if (res.data.success) {
                if (res.data.isPlaylist) {
                    setIsPlaylist(true);
                    setPlaylistTitle(res.data.playlistTitle || "Channel Videos");
                    setPlaylistVideos(res.data.videos.map(v => ({ ...v, status: 'idle' })));
                    toast.success(`Found ${res.data.videos.length} videos!`);
                } else {
                    setVideoData(res.data.video);
                    if (res.data.video.resolutions?.length > 0) {
                        setSelectedQuality(res.data.video.resolutions.includes(1080) ? 1080 : res.data.video.resolutions[0]);
                    }
                    toast.success("Video found!", { icon: "✨" });
                }
            }
        } catch (err) {
            toast.error("Failed to find video");
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (format) => {
        if (format === 'mp3') setDownloadingMp3(true);
        else setDownloadingMp4(true);
        const toastId = toast.loading("Starting Process...");
        try {
            const res = await api.post("/tools/youtube/download", {
                url,
                quality: format === 'mp3' ? selectedAudioQuality : selectedQuality,
                format
            }, { timeout: 1800000 });

            if (res.data.success) {
                setProgress(100);
                toast.success("Ready! Download starting.", { id: toastId });
                const safeName = videoData?.title?.replace(/[^a-z0-9]/gi, '_').slice(0, 50) || `youtube-${Date.now()}`;
                triggerDownload(res.data.url, `${safeName}.${format}`);
            }
        } catch (err) {
            toast.error("Download failed or timed out.", { id: toastId });
        } finally {
            if (format === 'mp3') setDownloadingMp3(false);
            else setDownloadingMp4(false);
        }
    };

    const triggerDownload = (url, name) => {
        const filename = url.split('/').pop();
        const downloadUrl = `${api.defaults.baseURL}/download?file=${filename}`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const toggleSelect = (id) => {
        const newSet = new Set(selectedVideoIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedVideoIds(newSet);
    };

    const processBatch = async () => {
        if (selectedVideoIds.size === 0) return toast.error("Select videos first!");
        setIsBulkProcessing(true);
        const queue = playlistVideos.filter(v => selectedVideoIds.has(v.id));
        toast.success(`Processing ${queue.length} videos...`);
        
        for (const video of queue) {
            setPlaylistVideos(prev => prev.map(v => v.id === video.id ? { ...v, status: 'processing' } : v));
            try {
                const res = await api.post("/tools/youtube/download", { url: video.url, quality: 720, format: 'mp4' }, { timeout: 300000 });
                if (res.data.success) {
                    setPlaylistVideos(prev => prev.map(v => v.id === video.id ? { ...v, status: 'ready', downloadUrl: res.data.url } : v));
                    triggerDownload(res.data.url, `${video.title.replace(/[^a-z0-9]/gi, '_')}.mp4`);
                }
            } catch (err) {
                setPlaylistVideos(prev => prev.map(v => v.id === video.id ? { ...v, status: 'error' } : v));
            }
        }
        setIsBulkProcessing(false);
    };

    return (
        <DashboardLayout>
            {/* 🌈 Modern Background Mesh (YouTube Red) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-red-500/20 to-rose-500/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-orange-500/20 to-red-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
            </div>

            <motion.div initial="hidden" animate="visible" variants={containerVariants} className="relative z-10 p-4 md:p-8 max-w-6xl mx-auto space-y-8 pb-24">
                {/* 🏷️ Header */}
                <div className="text-center space-y-3">
                    <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider">
                        <Youtube size={14} /> YouTube Premium
                    </motion.div>
                    <motion.h1 variants={itemVariants} className="text-3xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white">
                        Tube <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-rose-600">Premium</span>
                    </motion.h1>
                    <motion.p variants={itemVariants} className="text-gray-500 dark:text-gray-400 max-w-md mx-auto text-sm md:text-base px-4">
                        Download single videos, playlists, or channels in 4K & HD quality.
                    </motion.p>
                </div>

                {/* 🔍 Search Input */}
                <div className="max-w-2xl mx-auto relative group px-2">
                    <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-rose-600 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-500" />
                    <div className="relative flex items-center bg-white dark:bg-gray-900/80 backdrop-blur-2xl rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden">
                        <div className="pl-4 md:pl-6 text-gray-400 shrink-0">
                            <Search size={20} className="group-focus-within:text-red-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => {
                                setUrl(e.target.value);
                                if (videoData || isPlaylist) { setVideoData(null); setIsPlaylist(false); }
                            }}
                            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                            placeholder="Paste YouTube Link or Playlist..."
                            className="w-full bg-transparent py-4 md:py-5 px-3 md:px-4 text-base md:text-lg border-none focus:ring-0 focus:outline-none focus-visible:outline-none outline-none text-gray-900 dark:text-white placeholder:text-gray-500 min-w-0"
                        />
                        <div className="flex items-center gap-1 md:gap-2 pr-2 md:pr-4 shrink-0">
                            {url && <button onClick={() => setUrl("")} className="p-1 md:p-2 text-gray-400 hover:text-red-500 transition-colors"><X size={18} /></button>}
                            <button 
                                onClick={handleLookup}
                                disabled={!url || loading}
                                className="px-4 md:px-6 py-2 md:py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 shadow-lg shadow-red-500/20"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : "Fetch"}
                            </button>
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* 🎥 Single Video View */}
                    {videoData && (
                        <motion.div key="single" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} className="max-w-5xl mx-auto px-2">
                            <div className="bg-white/70 dark:bg-gray-900/50 backdrop-blur-3xl rounded-3xl overflow-hidden border border-white/30 dark:border-white/10 shadow-2xl">
                                <div className="flex flex-col lg:flex-row">
                                    <div className="w-full lg:w-1/2 relative group">
                                        <img src={videoData.thumbnail} className="w-full h-full object-cover aspect-video lg:aspect-auto" alt="Thumb" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                        <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-black shadow-lg">Y</div>
                                                <div className="min-w-0"><p className="text-white font-bold text-sm truncate">{videoData.author || "YouTube Channel"}</p></div>
                                            </div>
                                            <span className="bg-black/40 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg border border-white/20 uppercase tracking-widest">
                                                {Math.floor(videoData.duration / 60)}:{(videoData.duration % 60).toString().padStart(2, '0')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="w-full lg:w-1/2 p-6 md:p-10 flex flex-col space-y-8">
                                        <div className="space-y-4">
                                            <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-tight line-clamp-2">{videoData.title}</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {['4K Support', 'Original Audio', 'High Bitrate'].map(tag => (
                                                    <span key={tag} className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wide border border-red-500/10">{tag}</span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Video Quality</label>
                                                    <select 
                                                        value={selectedQuality} 
                                                        onChange={(e) => setSelectedQuality(Number(e.target.value))}
                                                        className="w-full bg-gray-100 dark:bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/50"
                                                    >
                                                        {videoData.resolutions?.map(res => <option key={res} value={res}>{res}p {res >= 1080 ? 'HD' : ''}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Audio Bitrate</label>
                                                    <select 
                                                        value={selectedAudioQuality} 
                                                        onChange={(e) => setSelectedAudioQuality(Number(e.target.value))}
                                                        className="w-full bg-gray-100 dark:bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                                                    >
                                                        {[320, 192, 128].map(rate => <option key={rate} value={rate}>{rate}K</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
                                                <button onClick={() => handleDownload('mp4')} disabled={downloadingMp4 || downloadingMp3} className="h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-red-500/20 flex items-center justify-center gap-2">
                                                    {downloadingMp4 ? <Loader2 className="animate-spin" /> : <Video size={18} />} Save Video
                                                </button>
                                                <button onClick={() => handleDownload('mp3')} disabled={downloadingMp4 || downloadingMp3} className="h-14 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl font-black text-sm transition-all shadow-xl flex items-center justify-center gap-2">
                                                    {downloadingMp3 ? <Loader2 className="animate-spin" /> : <Music size={18} />} Extract Audio
                                                </button>
                                            </div>
                                        </div>

                                        {(downloadingMp4 || downloadingMp3) && (
                                            <div className="space-y-3 pt-4 border-t border-white/10 animate-pulse">
                                                <div className="flex justify-between text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest">
                                                    <span>{progressStatus}</span>
                                                    <span>{Math.round(progress)}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                                                    <motion.div className="bg-red-600 h-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* 📂 Playlist / Bulk View */}
                    {isPlaylist && (
                        <motion.div key="playlist" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 px-2">
                            <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-white/40 dark:bg-black/40 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-xl relative overflow-hidden">
                                <button onClick={() => setIsPlaylist(false)} className="absolute top-4 right-4 p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
                                <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-red-600 flex items-center justify-center text-white text-3xl font-black shadow-2xl shrink-0"><PlaySquare size={40} /></div>
                                <div className="text-center md:text-left flex-1 min-w-0">
                                    <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white truncate mb-1">{playlistTitle}</h2>
                                    <div className="flex items-center justify-center md:justify-start gap-4 text-xs font-bold text-gray-500">
                                        <span>{playlistVideos.length} Videos</span>
                                        <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                        <button onClick={() => selectedVideoIds.size === playlistVideos.length ? setSelectedVideoIds(new Set()) : setSelectedVideoIds(new Set(playlistVideos.map(v => v.id)))} className="text-red-600 hover:underline">
                                            {selectedVideoIds.size === playlistVideos.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {playlistVideos.map((video, idx) => (
                                    <motion.div 
                                        key={video.id} 
                                        initial={{ opacity: 0, y: 20 }} 
                                        animate={{ opacity: 1, y: 0, transition: { delay: Math.min(idx * 0.05, 1) } }}
                                        onClick={() => toggleSelect(video.id)}
                                        className={`group relative aspect-video rounded-2xl overflow-hidden cursor-pointer border-4 transition-all duration-300 hover:scale-[1.02] shadow-lg ${selectedVideoIds.has(video.id) ? 'border-red-500 ring-4 ring-red-500/20' : 'border-transparent'}`}
                                    >
                                        <img src={video.thumbnail} className="w-full h-full object-cover" loading="lazy" alt="thumb" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                                        {selectedVideoIds.has(video.id) && <div className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-2xl"><CheckSquare size={12} strokeWidth={4} /></div>}
                                        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white text-[9px] font-black uppercase tracking-widest drop-shadow-md">
                                            <span className="truncate max-w-[70%]">{video.title}</span>
                                            <span className="shrink-0">{video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : "LIVE"}</span>
                                        </div>
                                        {video.status === 'processing' && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>}
                                        {video.status === 'ready' && <div className="absolute inset-0 bg-green-500/40 backdrop-blur-sm flex items-center justify-center"><CheckCircle className="text-white" /></div>}
                                    </motion.div>
                                ))}
                            </div>

                            <AnimatePresence>
                                {selectedVideoIds.size > 0 && (
                                    <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-[100]">
                                        <div className="bg-gray-900/90 dark:bg-white/90 backdrop-blur-3xl p-4 rounded-3xl border border-white/20 shadow-2xl flex items-center justify-between gap-4 relative overflow-hidden">
                                            {isBulkProcessing && <motion.div className="absolute bottom-0 left-0 h-1 bg-red-600" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 30 }} />}
                                            <div className="flex flex-col min-w-0 ml-2">
                                                <span className="text-white dark:text-gray-900 text-lg font-black">{selectedVideoIds.size} Videos</span>
                                                <span className="text-red-500 dark:text-red-600 text-[10px] font-black uppercase tracking-widest">{isBulkProcessing ? 'Processing Playlist...' : 'Ready for Bulk Download'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setSelectedVideoIds(new Set())} className="p-3 text-gray-400 hover:text-white dark:hover:text-black transition-colors"><Trash2 size={20} /></button>
                                                <button onClick={processBatch} disabled={isBulkProcessing} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-sm transition-all shadow-xl disabled:opacity-50 flex items-center gap-2">
                                                    {isBulkProcessing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} <span>{isBulkProcessing ? 'Processing' : 'Bulk Save'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {/* Features Grid */}
                    {!videoData && !isPlaylist && !loading && (
                        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto pt-8">
                            {[
                                { title: "4K Support", desc: "Download in highest available resolution", icon: <Zap className="text-red-500" /> },
                                { title: "Playlist Master", desc: "Download entire playlists in one click", icon: <Layers className="text-orange-500" /> },
                                { title: "MP3 Extractor", desc: "Convert any video to high-quality audio", icon: <Music className="text-rose-500" /> }
                            ].map((item, i) => (
                                <div key={i} className="p-8 bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl text-center group hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-300 shadow-xl">
                                    <div className="w-14 h-14 mx-auto bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 group-hover:rotate-6 transition-all">{item.icon}</div>
                                    <h3 className="font-black text-gray-900 dark:text-white mb-2 uppercase tracking-wide text-sm">{item.title}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </DashboardLayout>
    );
}
