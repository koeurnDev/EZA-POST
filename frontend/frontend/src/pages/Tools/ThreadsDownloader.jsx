import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { 
    Search, Download, CheckCircle, X, Loader2, 
    Image as ImageIcon, Video, AtSign, ExternalLink, 
    Sparkles, Zap, ChevronRight
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../utils/api";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/api$/, "");

const getProxyUrl = (url, filename) => {
    return `${API_BASE}/api/tools/threads/proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
};

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

export default function ThreadsDownloader() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);

    const handleLookup = async () => {
        if (!url.match(/threads\.(net|com)/)) return toast.error("Please enter a valid Threads URL");
        setLoading(true);
        setData(null);
        try {
            const res = await api.post("/tools/threads/lookup", { url });
            if (res.data.success) {
                setData(res.data.media);
                toast.success("Threads post found!", { icon: "✨" });
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to find post");
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (mediaUrl, type, index = 0) => {
        const ext = type === 'video' ? 'mp4' : 'jpg';
        const safeTitle = (data.title || "threads_post").replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        const filename = `threads-${safeTitle}-${index + 1}.${ext}`;
        const proxyUrl = getProxyUrl(mediaUrl, filename);

        toast.promise(
            new Promise(resolve => {
                triggerDownload(proxyUrl, filename);
                setTimeout(resolve, 1000);
            }),
            {
                loading: 'Starting download...',
                success: 'Download started!',
                error: 'Download failed',
            }
        );
    };

    const clearResult = () => {
        setData(null);
        setUrl("");
    };

    return (
        <DashboardLayout>
            {/* 🌈 Modern Background Mesh (Threads Dark) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-gray-500/10 to-slate-500/10 rounded-full blur-[120px] animate-pulse delay-700" />
            </div>

            <motion.div 
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="relative z-10 p-4 md:p-8 max-w-6xl mx-auto space-y-8 pb-24"
            >
                {/* 🏷️ Header */}
                <div className="text-center space-y-3">
                    <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/10 dark:bg-white/10 border border-black/20 dark:border-white/20 text-black dark:text-white text-xs font-bold uppercase tracking-wider">
                        <AtSign size={14} /> Threads Premium
                    </motion.div>
                    <motion.h1 variants={itemVariants} className="text-3xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white">
                        At <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">Saver</span>
                    </motion.h1>
                    <motion.p variants={itemVariants} className="text-gray-500 dark:text-gray-400 max-w-md mx-auto text-sm md:text-base px-4">
                        Download high-fidelity carousels, videos, and images from the Threads app.
                    </motion.p>
                </div>

                {/* 🔍 Search Input */}
                <div className="max-w-2xl mx-auto relative group px-2">
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-500" />
                    <div className="relative flex items-center bg-white dark:bg-gray-900/80 backdrop-blur-2xl rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden">
                        <div className="pl-4 md:pl-6 text-gray-400 shrink-0">
                            <Search size={20} className="group-focus-within:text-purple-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => {
                                setUrl(e.target.value);
                                if (data) setData(null);
                            }}
                            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                            placeholder="Paste Threads link here..."
                            className="w-full bg-transparent py-4 md:py-5 px-3 md:px-4 text-base md:text-lg border-none focus:ring-0 focus:outline-none focus-visible:outline-none outline-none text-gray-900 dark:text-white placeholder:text-gray-500 min-w-0"
                        />
                        <div className="flex items-center gap-1 md:gap-2 pr-2 md:pr-4 shrink-0">
                            {url && (
                                <button onClick={() => setUrl("")} className="p-1 md:p-2 text-gray-400 hover:text-purple-500 transition-colors">
                                    <X size={18} />
                                </button>
                            )}
                            <button 
                                onClick={handleLookup}
                                disabled={!url || loading}
                                className="px-4 md:px-6 py-2 md:py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : "Fetch"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 🎥 Result View */}
                <AnimatePresence>
                    {data && (
                        <motion.div 
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="max-w-5xl mx-auto space-y-8 px-2"
                        >
                            {/* Author Card */}
                            <div className="bg-white/70 dark:bg-gray-900/50 backdrop-blur-3xl rounded-3xl p-6 border border-white/30 dark:border-white/10 shadow-xl flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 p-1">
                                        <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center border-2 border-white/20">
                                            <AtSign size={32} className="text-gray-900 dark:text-white" />
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">{data.author.fullname || "Threads User"}</h2>
                                        <p className="text-sm font-bold text-gray-500">@{data.author.username}</p>
                                    </div>
                                </div>
                                <button onClick={clearResult} className="p-3 text-gray-400 hover:text-red-500 transition-colors"><X size={24} /></button>
                            </div>

                            {/* Media Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Videos */}
                                {data.videos.map((vid, idx) => (
                                    <motion.div 
                                        key={`vid-${idx}`} 
                                        initial={{ opacity: 0, scale: 0.9 }} 
                                        animate={{ opacity: 1, scale: 1, transition: { delay: idx * 0.1 } }}
                                        className="group relative bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10"
                                    >
                                        <video src={getProxyUrl(vid.url, `preview.mp4`)} className="w-full aspect-[3/4] object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-6">
                                            <button 
                                                onClick={() => handleDownload(vid.url, 'video', idx)}
                                                className="w-full py-4 bg-white text-black rounded-2xl font-black flex items-center justify-center gap-2 shadow-2xl"
                                            >
                                                <Download size={20} /> Download MP4
                                            </button>
                                        </div>
                                        <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/20 text-[10px] font-black text-white flex items-center gap-1.5 shadow-lg tracking-tighter">
                                            <Video size={12} className="text-purple-400" /> VIDEO {idx + 1}
                                        </div>
                                    </motion.div>
                                ))}

                                {/* Images */}
                                {data.images.map((img, idx) => (
                                    <motion.div 
                                        key={`img-${idx}`} 
                                        initial={{ opacity: 0, scale: 0.9 }} 
                                        animate={{ opacity: 1, scale: 1, transition: { delay: idx * 0.1 } }}
                                        className="group relative bg-gray-100 dark:bg-white/5 rounded-3xl overflow-hidden shadow-2xl border border-white/10"
                                    >
                                        <img src={getProxyUrl(img, `preview.jpg`)} className="w-full aspect-[3/4] object-cover" alt="Threads Post" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-6">
                                            <button 
                                                onClick={() => handleDownload(img, 'image', idx)}
                                                className="w-full py-4 bg-white text-black rounded-2xl font-black flex items-center justify-center gap-2 shadow-2xl"
                                            >
                                                <Download size={20} /> Save Image
                                            </button>
                                        </div>
                                        <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/20 text-[10px] font-black text-white flex items-center gap-1.5 shadow-lg tracking-tighter">
                                            <ImageIcon size={12} className="text-blue-400" /> IMAGE {idx + 1}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Features Grid */}
                {!data && !loading && (
                    <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto pt-8">
                        {[
                            { title: "Carousel Saver", desc: "Download all items in a post at once", icon: <Layers size={18} className="text-purple-500" /> },
                            { title: "HD Resolution", desc: "Keep original quality for every file", icon: <Zap size={18} className="text-blue-500" /> },
                            { title: "Pure Privacy", desc: "No tracking, direct proxy delivery", icon: <Sparkles size={18} className="text-gray-500" /> }
                        ].map((item, i) => (
                            <div key={i} className="p-6 bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl text-center group hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-300 shadow-xl">
                                <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    {item.icon}
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-1 uppercase tracking-wide text-xs">{item.title}</h3>
                                <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                            </div>
                        ))}
                    </motion.div>
                )}
            </motion.div>
        </DashboardLayout>
    );
}

// Inline helper for Layers icon (if not imported)
function Layers({ size, className }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
        </svg>
    );
}
