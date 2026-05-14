import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from '../../layouts/DashboardLayout';
import { 
    Play, Pause, Download, ExternalLink, Globe, TrendingUp, 
    RefreshCw, Send, Loader, AlertCircle, Scissors, Music2, 
    Sparkles, MapPin, Zap, X, ChevronRight, Share2, Flame
} from 'lucide-react';
import apiUtils from '../../utils/apiUtils';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

// ✨ Motion Variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
        opacity: 1,
        transition: { staggerChildren: 0.05 }
    }
};

const cardVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: { 
        opacity: 1, 
        scale: 1, 
        y: 0,
        transition: { duration: 0.4, ease: "easeOut" }
    }
};

export default function ViralFinder() {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [region, setRegion] = useState('TH');
    const [filterType, setFilterType] = useState('video');
    const [playingId, setPlayingId] = useState(null);
    const navigate = useNavigate();

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

    const fetchViralVideos = async () => {
        setLoading(true);
        try {
            const res = await apiUtils.getTikTokTrending(region, 20, filterType);
            if (res.data.success) {
                setVideos(res.data.videos || []);
            } else {
                toast.error(res.data.error || `Failed to load feed.`);
            }
        } catch (err) {
            toast.error("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchViralVideos();
    }, [region, filterType]);

    const handlePlayPause = (id) => {
        setPlayingId(playingId === id ? null : id);
    };

    const handleReUp = (video) => {
        navigate('/posts', { state: { tiktokUrl: video.playUrl, caption: video.title } });
    };

    return (
        <DashboardLayout>
            {/* 🌈 Optimized Background Mesh (Hidden on mobile for performance) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 hidden md:block">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-pink-500/10 to-violet-500/10 rounded-full blur-[60px] md:blur-[120px] md:animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-rose-500/10 to-purple-500/10 rounded-full blur-[60px] md:blur-[120px] md:animate-pulse delay-700" />
            </div>

            <motion.div 
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="relative z-10 p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 pb-32"
            >
                {/* 🏷️ Header */}
                <div className="text-center space-y-3">
                    <motion.div variants={cardVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-600 dark:text-pink-400 text-xs font-bold uppercase tracking-wider">
                        <TrendingUp size={14} /> Intelligence Feed
                    </motion.div>
                    <motion.h1 variants={cardVariants} className="text-3xl md:text-6xl font-black tracking-tight text-gray-900 dark:text-white">
                        Viral <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-violet-600">Finder</span>
                    </motion.h1>
                    <motion.p variants={cardVariants} className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto text-sm md:text-base px-4">
                        Real-time trending charts across the globe. Capture high-performance content before it peaks.
                    </motion.p>
                </div>

                {/* 🎛️ Controls (Optimized for Mobile Performance) */}
                <div className="sticky top-4 z-40 bg-white/90 dark:bg-black/90 md:bg-white/40 md:dark:bg-black/40 md:backdrop-blur-3xl border border-white/20 dark:border-white/10 rounded-[2rem] p-2 shadow-2xl flex flex-col md:flex-row gap-4 items-center justify-between max-w-5xl mx-auto">
                    <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-2xl w-full md:w-auto">
                        <button
                            onClick={() => setFilterType('video')}
                            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filterType === 'video' ? 'bg-white dark:bg-white/10 shadow-lg text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                        >
                            Videos
                        </button>
                        <button
                            onClick={() => setFilterType('capcut')}
                            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filterType === 'capcut' ? 'bg-white dark:bg-white/10 shadow-lg text-pink-500' : 'text-gray-500 hover:text-pink-500'}`}
                        >
                            CapCut
                        </button>
                    </div>

                    <div className="w-full md:w-auto overflow-x-auto no-scrollbar flex items-center gap-2 px-2">
                        {regions.map((r) => (
                            <button
                                key={r.code}
                                onClick={() => setRegion(r.code)}
                                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all border flex items-center gap-2 shrink-0 ${region === r.code 
                                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-xl' 
                                    : 'bg-white/40 dark:bg-white/5 backdrop-blur-xl border-white/10 text-gray-500 hover:border-pink-500/50'}`}
                            >
                                <span className="text-base">{r.flag}</span>
                                <span className="uppercase tracking-widest">{r.name}</span>
                            </button>
                        ))}
                    </div>

                    <button onClick={fetchViralVideos} className="hidden md:flex p-3 text-gray-400 hover:text-pink-500 transition-colors"><RefreshCw size={20} className={loading ? "animate-spin" : ""} /></button>
                </div>

                {/* 🎬 Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-8">
                    <AnimatePresence mode="popLayout">
                        {loading ? (
                            [...Array(12)].map((_, i) => (
                                <div key={`shimmer-${i}`} className="aspect-[9/16] bg-white/40 dark:bg-white/5 backdrop-blur-xl rounded-[2rem] animate-pulse border border-white/20" />
                            ))
                        ) : (
                            videos.map((video, idx) => (
                                <motion.div
                                    key={video.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="group relative bg-black rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 aspect-[9/16]"
                                >
                                    {playingId === video.id ? (
                                        <video src={video.playUrl} autoPlay controls loop className="w-full h-full object-cover" />
                                    ) : (
                                        <>
                                            <img src={video.cover} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-1000" alt="Video" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                            
                                            {/* Rank */}
                                            <div className="absolute top-6 left-6 flex items-center gap-2">
                                                <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/20 text-[10px] font-black text-white tracking-tighter shadow-xl">
                                                    #{idx + 1}
                                                </div>
                                                {video.stats.likes > 200000 && (
                                                    <div className="px-3 py-1 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg text-[10px] font-black text-white shadow-lg shadow-pink-500/40 animate-pulse uppercase tracking-widest">
                                                        Super Viral
                                                    </div>
                                                )}
                                            </div>

                                            {/* Play Overlay */}
                                            <button 
                                                onClick={() => handlePlayPause(video.id)}
                                                className="absolute inset-0 flex items-center justify-center group-hover:bg-pink-500/10 transition-all duration-500"
                                            >
                                                <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-2xl border border-white/30 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                                                    <Play size={32} fill="currentColor" className="ml-1" />
                                                </div>
                                            </button>

                                            {/* Meta & Stats */}
                                            <div className="absolute bottom-0 left-0 w-full p-6 space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full border-2 border-white/20 overflow-hidden shrink-0">
                                                        <img src={video.author.avatar} className="w-full h-full" alt="User" />
                                                    </div>
                                                    <p className="text-xs font-black text-white/90 truncate uppercase tracking-widest">@{video.author.nickname}</p>
                                                </div>
                                                <p className="text-sm font-bold text-white line-clamp-2 leading-snug drop-shadow-lg">{video.title || "Viral Content"}</p>
                                                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-1.5">
                                                            <Flame size={14} className="text-pink-500" />
                                                            <span className="text-[11px] font-black text-white uppercase">{(video.stats.likes / 1000).toFixed(1)}K</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Play size={14} className="text-gray-400" />
                                                            <span className="text-[11px] font-black text-white uppercase">{(video.stats.plays / 1000).toFixed(1)}K</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleReUp(video); }}
                                                            className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:bg-pink-500 hover:text-white transition-all shadow-xl"
                                                            title="Re-Up"
                                                        >
                                                            <Send size={18} />
                                                        </button>
                                                        <a 
                                                            href={apiUtils.getFullUrl(`/tools/tiktok/proxy?url=${encodeURIComponent(video.playUrl)}&web_url=${encodeURIComponent(video.web_url)}&filename=${encodeURIComponent(video.title)}&type=video/mp4`)}
                                                            download
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-10 h-10 bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-all shadow-xl"
                                                            title="Download"
                                                        >
                                                            <Download size={18} />
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>

                {!loading && videos.length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-40 space-y-6 text-center opacity-50">
                        <Globe size={48} className="text-gray-400" />
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-widest">Feed is currently empty</h3>
                        <p className="text-xs font-bold uppercase tracking-[0.1em] max-w-xs mx-auto">Switching regions or refreshing may resolve this. You can also paste a TikTok link directly in the search bar.</p>
                        <button onClick={fetchViralVideos} className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl">Refresh Feed</button>
                    </motion.div>
                )}
            </motion.div>
        </DashboardLayout>
    );
}
