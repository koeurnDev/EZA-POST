import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Music, Play, Pause, Download, ExternalLink, RefreshCw, Copy, Search, Sparkles, MapPin, Globe } from "lucide-react";
import apiUtils from "../../utils/apiUtils";
import toast from "react-hot-toast";

export default function TikTokTrends() {
    const [trends, setTrends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [playingId, setPlayingId] = useState(null);
    const audioRef = useRef(null);

    // 🏳️ Region Config (Synced with Viral Finder)
    const regions = [
        { code: 'KH', name: 'Cambodia', flag: '🇰🇭' },
        { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
        { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
        { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
        { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
        { code: 'CN', name: 'Douyin', flag: '🇨🇳' },
        { code: 'KR', name: 'Korea', flag: '🇰🇷' },
        { code: 'US', name: 'Global', flag: '🇺🇸' }
    ];

    const [region, setRegion] = useState("US");

    // 🔄 Fetch Trends
    const fetchTrends = async () => {
        setLoading(true);
        try {
            const res = await apiUtils.getTikTokTrending(region, 24, 'music');
            if (res.data.success) {
                setTrends(res.data.music || []);
            }
        } catch (err) {
            console.error("Failed to load trends:", err);
            toast.error("Failed to load trending sounds");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => fetchTrends(), 500);
        return () => clearTimeout(timer);
    }, [region]);

    // 🎵 Audio Player Control
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
        toast.success("Link copied!");
    };

    const handleDownload = (music) => {
        // Use Backend Proxy to bypass CORS and ensure reliable download
        const proxyUrl = apiUtils.getFullUrl(`/tools/tiktok/proxy?url=${encodeURIComponent(music.playUrl)}&filename=${encodeURIComponent(music.title)}&type=audio/mpeg`);

        const link = document.createElement('a');
        link.href = proxyUrl;
        link.setAttribute('download', `${music.title}.mp3`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success("Download started...");
    };

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-gray-50/50 dark:bg-[#0f1115]">
                <div className="max-w-[1400px] mx-auto px-4 py-6 md:px-6 md:py-10">

                    {/* ✨ Hero Header */}
                    <div className="mb-12 flex flex-col items-center text-center space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 text-cyan-500 text-sm font-bold border border-cyan-500/20 backdrop-blur-sm">
                            <Music size={14} />
                            <span>Discover Viral Audio</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
                            Trending <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-500">Sounds</span>
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 max-w-lg text-lg">
                            Find the perfect soundtrack for your next viral hit. Curated daily from TikTok's global trending charts.
                        </p>
                    </div>

                    {/* 🎛️ Controls Bar */}
                    <div className="sticky top-4 z-40 bg-white/80 dark:bg-[#1a1d24]/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800 rounded-3xl p-3 shadow-xl shadow-gray-200/20 dark:shadow-none mb-10 mx-auto max-w-4xl flex flex-col md:flex-row gap-4 items-center justify-between">

                        {/* Region Scroller */}
                        <div className="w-full overflow-x-auto no-scrollbar flex items-center gap-2 px-2">
                            {regions.map((r) => (
                                <button
                                    key={r.code}
                                    onClick={() => setRegion(r.code)}
                                    className={`relative group px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex-shrink-0 flex items-center gap-2 border ${region === r.code
                                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-lg transform scale-105'
                                        : 'bg-transparent border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'
                                        }`}
                                >
                                    <span className="text-lg">{r.flag}</span>
                                    <span>{r.name}</span>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={fetchTrends}
                            disabled={loading}
                            className="p-3 bg-gray-100 dark:bg-gray-800 rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
                        >
                            <RefreshCw size={20} className={loading ? "animate-spin text-cyan-500" : "text-gray-500"} />
                        </button>
                    </div>

                    {/* Hidden Audio Player */}
                    <audio ref={audioRef} onEnded={() => setPlayingId(null)} className="hidden" />

                    {/* 🎶 Grid Layout */}
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="bg-white dark:bg-gray-800 rounded-3xl p-4 h-32 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {trends.map((music, idx) => (
                                <div key={music.id} className="group relative bg-white dark:bg-gray-800 rounded-3xl p-4 border border-gray-100 dark:border-gray-800 hover:border-cyan-500/30 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all duration-300">

                                    {/* Rank Badge */}
                                    <div className="absolute top-0 right-0 bg-gray-100 dark:bg-black/40 text-gray-500 dark:text-gray-400 text-[10px] font-black px-3 py-1 rounded-bl-2xl rounded-tr-3xl z-10 uppercase tracking-widest border-l border-b border-gray-200/50 dark:border-white/5">
                                        Rank #{idx + 1}
                                    </div>

                                    <div className="flex items-center gap-4 relative z-10">
                                        {/* Cover / Play Btn */}
                                        <div className="relative w-20 h-20 flex-shrink-0 group/cover">
                                            <img
                                                src={music.cover}
                                                alt={music.title}
                                                className="w-full h-full object-cover rounded-2xl shadow-lg group-hover:scale-105 transition-transform duration-500"
                                            />
                                            <button
                                                onClick={() => togglePlay(music)}
                                                className={`absolute inset-0 flex items-center justify-center transition-all rounded-2xl ${playingId === music.id ? 'bg-cyan-500/40 opacity-100' : 'bg-black/40 opacity-0 group-hover/cover:opacity-100'}`}
                                            >
                                                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/40 shadow-xl">
                                                    {playingId === music.id ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                                                </div>
                                            </button>

                                            {/* Sound Wave Animation */}
                                            {playingId === music.id && (
                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 h-4 items-end pb-1">
                                                    <div className="w-1 bg-white animate-[bounce_0.5s_infinite] rounded-full" />
                                                    <div className="w-1 bg-white animate-[bounce_0.8s_infinite] rounded-full" style={{ animationDelay: '0.1s' }} />
                                                    <div className="w-1 bg-white animate-[bounce_0.6s_infinite] rounded-full" style={{ animationDelay: '0.2s' }} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-gray-900 dark:text-white truncate text-base mb-0.5" title={music.title}>
                                                {music.title}
                                            </h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2 flex items-center gap-1">
                                                <Music size={10} className="text-cyan-500" /> {music.author}
                                            </p>

                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                                                    {music.duration}s
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-medium">
                                                    🔥 {(music.originalVideo.likes / 1000).toFixed(1)}k
                                                </span>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleCopyLink(music.playUrl)}
                                                    className="p-1.5 text-gray-400 hover:text-cyan-500 hover:bg-cyan-500/10 rounded-lg transition-all"
                                                    title="Copy Link"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDownload(music)}
                                                    className="p-1.5 text-gray-400 hover:text-cyan-500 hover:bg-cyan-500/10 rounded-lg transition-all"
                                                    title="Download MP3"
                                                >
                                                    <Download size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Visual Detail */}
                                    <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all pointer-events-none" />
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && trends.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-32 text-center opacity-60">
                            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                                <Globe size={48} className="text-gray-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Music feed is empty</h3>
                            <p className="text-gray-500 mt-2">Try a different region or global feed.</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
