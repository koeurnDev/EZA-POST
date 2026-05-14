import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { 
    Music, Play, Pause, Download, ExternalLink, RefreshCw, 
    Copy, Search, Sparkles, MapPin, Globe, Zap, X, ChevronRight
} from "lucide-react";
import apiUtils from "../../utils/apiUtils";
import toast from "react-hot-toast";

// ✨ Motion Variants
const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.05 }
    }
};

const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 }
};

export default function TikTokTrends() {
    const [trends, setTrends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [playingId, setPlayingId] = useState(null);
    const audioRef = useRef(null);

    const regions = [
        { code: 'US', name: 'Global', flag: '🌍' },
        { code: 'KH', name: 'Cambodia', flag: '🇰🇭' },
        { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
        { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
        { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
        { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
        { code: 'CN', name: 'Douyin', flag: '🇨🇳' },
        { code: 'KR', name: 'Korea', flag: '🇰🇷' }
    ];

    const [region, setRegion] = useState("US");

    const fetchTrends = async () => {
        setLoading(true);
        try {
            const res = await apiUtils.getTikTokTrending(region, 24, 'music');
            if (res.data.success) {
                setTrends(res.data.videos || []);
            }
        } catch (err) {
            toast.error("Failed to load trending sounds");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrends();
    }, [region]);

    const togglePlay = (music) => {
        if (playingId === music.id) {
            audioRef.current.pause();
            setPlayingId(null);
        } else {
            if (audioRef.current) {
                audioRef.current.src = music.playUrl;
                audioRef.current.play();
                setPlayingId(music.id);
            }
        }
    };

    const handleCopyLink = (url) => {
        navigator.clipboard.writeText(url);
        toast.success("Link copied!", { icon: "📎" });
    };

    const handleDownload = (music) => {
        const proxyUrl = apiUtils.getFullUrl(`/tools/tiktok/proxy?url=${encodeURIComponent(music.playUrl)}&filename=${encodeURIComponent(music.title)}&type=audio/mpeg`);
        const link = document.createElement('a');
        link.href = proxyUrl;
        link.setAttribute('download', `${music.title}.mp3`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success("Download started...", { icon: "🎵" });
    };

    return (
        <DashboardLayout>
            {/* 🌈 Optimized Background Mesh (Hidden on mobile for performance) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 hidden md:block">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 rounded-full blur-[60px] md:blur-[120px] md:animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-blue-500/10 to-cyan-500/10 rounded-full blur-[60px] md:blur-[120px] md:animate-pulse delay-700" />
            </div>

            <motion.div 
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="relative z-10 p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 pb-32"
            >
                {/* 🏷️ Header */}
                <div className="text-center space-y-3">
                    <motion.div variants={cardVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider">
                        <Sparkles size={14} /> Viral Charts
                    </motion.div>
                    <motion.h1 variants={cardVariants} className="text-3xl md:text-6xl font-black tracking-tight text-gray-900 dark:text-white">
                        Trending <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600">Audio</span>
                    </motion.h1>
                    <motion.p variants={cardVariants} className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto text-sm md:text-base px-4">
                        Discover the soundtracks driving TikTok's viral trends worldwide.
                    </motion.p>
                </div>

                {/* 🎛️ Region Selector */}
                <div className="flex flex-wrap justify-center gap-2 md:gap-3">
                    {regions.map((r) => (
                        <button
                            key={r.code}
                            onClick={() => setRegion(r.code)}
                            className={`px-4 py-2.5 md:px-6 md:py-3 rounded-2xl text-xs md:text-sm font-black transition-all border flex items-center gap-2 ${region === r.code 
                                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-xl scale-105' 
                                : 'bg-white/90 dark:bg-white/10 md:bg-white/40 md:dark:bg-white/5 md:backdrop-blur-xl border-white/20 text-gray-500 hover:border-cyan-500/50'}`}
                        >
                            <span className="text-base md:text-lg">{r.flag}</span>
                            <span className="uppercase tracking-widest">{r.name}</span>
                        </button>
                    ))}
                </div>

                <audio ref={audioRef} onEnded={() => setPlayingId(null)} className="hidden" />

                {/* 🎶 Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                    <AnimatePresence mode="popLayout">
                        {loading ? (
                            [...Array(10)].map((_, i) => (
                                <div key={`shimmer-${i}`} className="h-32 bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-3xl animate-pulse border border-white/20" />
                            ))
                        ) : (
                            trends.map((music, idx) => (
                                <motion.div
                                    key={music.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="group relative bg-white/60 dark:bg-gray-900/40 backdrop-blur-3xl rounded-[2rem] p-4 border border-white/20 dark:border-white/5 hover:border-cyan-500/50 transition-all duration-500 shadow-xl"
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Cover */}
                                        <div className="relative w-20 h-20 shrink-0">
                                            <img src={music.cover} className="w-full h-full object-cover rounded-2xl shadow-lg" alt="Sound" />
                                            <button 
                                                onClick={() => togglePlay(music)}
                                                className={`absolute inset-0 flex items-center justify-center rounded-2xl backdrop-blur-[2px] transition-all ${playingId === music.id ? 'bg-cyan-500/30' : 'bg-black/20 opacity-0 group-hover:opacity-100'}`}
                                            >
                                                {playingId === music.id ? <Pause size={24} className="text-white fill-current" /> : <Play size={24} className="text-white fill-current ml-1" />}
                                            </button>
                                            
                                            {/* Visualizer */}
                                            {playingId === music.id && (
                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-end gap-0.5 h-6 pb-1">
                                                    {[0.5, 0.8, 0.6, 0.9].map((s, i) => (
                                                        <motion.div 
                                                            key={i}
                                                            animate={{ height: [8, 16, 8] }}
                                                            transition={{ repeat: Infinity, duration: s, delay: i * 0.1 }}
                                                            className="w-1 bg-white rounded-full shadow-[0_0_8px_cyan]"
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Meta */}
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-sm md:text-base font-black text-gray-900 dark:text-white truncate uppercase tracking-tight">{music.title}</h3>
                                            <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 truncate mb-2">@{music.author}</p>
                                            
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-black px-2 py-0.5 bg-gray-100 dark:bg-white/5 rounded-full text-gray-500">{music.duration}s</span>
                                                <span className="text-[10px] font-black text-pink-500 flex items-center gap-1">
                                                    <Zap size={10} /> {(music.originalVideo.likes / 1000).toFixed(1)}K
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Bar */}
                                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                                        <div className="flex gap-1">
                                            <button onClick={() => handleCopyLink(music.playUrl)} className="p-2 text-gray-400 hover:text-cyan-500 transition-colors"><Copy size={18} /></button>
                                            <button onClick={() => handleDownload(music)} className="p-2 text-gray-400 hover:text-cyan-500 transition-colors"><Download size={18} /></button>
                                        </div>
                                        <div className="px-3 py-1 bg-gray-100 dark:bg-white/5 rounded-lg text-[9px] font-black text-gray-400 uppercase tracking-widest border border-white/5">
                                            Rank #{idx + 1}
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>

                {!loading && trends.length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-40 space-y-4 text-center opacity-50">
                        <Globe size={48} className="text-gray-400" />
                        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest">No Trends Found</h3>
                        <p className="text-xs font-bold uppercase tracking-widest max-w-xs mx-auto">Try switching the region above to discover viral sounds from other countries.</p>
                    </motion.div>
                )}
            </motion.div>
        </DashboardLayout>
    );
}
