
import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Music, Play, Pause, Download, ExternalLink, RefreshCw, Copy, Search } from "lucide-react";
import apiUtils from "../../utils/apiUtils";
import toast from "react-hot-toast";

export default function TikTokTrends() {
    const [trends, setTrends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [playingId, setPlayingId] = useState(null);
    const audioRef = useRef(null);

    // Filter State
    const [region, setRegion] = useState("US");

    // 🔄 Fetch Trends
    const fetchTrends = async () => {
        setLoading(true);
        try {
            const res = await apiUtils.getTikTokTrending(region, 20, 'music');
            if (res.data.success) {
                setTrends(res.data.music);
                toast.success(`Loaded ${res.data.music.length} trending sounds`);
            }
        } catch (err) {
            console.error("Failed to load trends:", err);
            const msg = err.response?.data?.error || "Failed to load trending sounds";
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrends();
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

    const handleDownload = (url, title) => {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${title}.mp3`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-cyan-500">
                                Trending Sounds
                            </span>
                            <Music className="text-pink-500" />
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            Discover viral audio tracks currently trending on TikTok.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <select
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-pink-500"
                        >
                            <option value="US">🇺🇸 United States</option>
                            <option value="KH">🇰🇭 Cambodia</option>
                            <option value="TH">🇹🇭 Thailand</option>
                            <option value="VN">🇻🇳 Vietnam</option>
                            <option value="KR">🇰🇷 South Korea</option>
                        </select>
                        <button
                            onClick={fetchTrends}
                            disabled={loading}
                            className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                {/* Hidden Audio Player */}
                <audio ref={audioRef} onEnded={() => setPlayingId(null)} className="hidden" />

                {/* 🎶 List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        Array(6).fill(0).map((_, i) => (
                            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 animate-pulse">
                                <div className="flex gap-4 items-center">
                                    <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        trends.map((music, idx) => (
                            <div key={music.id || idx} className="bg-white dark:bg-gray-800 rounded-3xl p-4 md:p-5 border border-gray-100 dark:border-gray-700 hover:border-pink-200 dark:hover:border-pink-900 transition-all shadow-sm group relative overflow-hidden">

                                {/* Rank Badge */}
                                <div className="absolute top-0 right-0 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-xs font-bold px-3 py-1 rounded-bl-xl z-10">
                                    #{idx + 1}
                                </div>

                                <div className="flex items-center gap-4 relative z-10">
                                    {/* Cover / Play Btn */}
                                    <div className="relative w-24 h-24 flex-shrink-0">
                                        <img
                                            src={music.cover}
                                            alt={music.title}
                                            className="w-full h-full object-cover rounded-2xl shadow-md group-hover:scale-105 transition-transform duration-500"
                                        />
                                        <button
                                            onClick={() => togglePlay(music)}
                                            className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
                                        >
                                            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white border border-white/50">
                                                {playingId === music.id ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                                            </div>
                                        </button>

                                        {/* Equalizer Animation if playing */}
                                        {playingId === music.id && (
                                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 h-3 items-end">
                                                <div className="w-1 bg-pink-500 animate-[bounce_0.5s_infinite] rounded-full" />
                                                <div className="w-1 bg-cyan-500 animate-[bounce_0.7s_infinite] rounded-full" style={{ animationDelay: '0.1s' }} />
                                                <div className="w-1 bg-pink-500 animate-[bounce_0.6s_infinite] rounded-full" style={{ animationDelay: '0.2s' }} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-900 dark:text-white truncate text-lg" title={music.title}>
                                            {music.title}
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate mb-2">
                                            {music.author}
                                        </p>

                                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                                            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 font-medium">
                                                {music.duration}s
                                            </span>
                                            <span>
                                                {(music.originalVideo.likes / 1000).toFixed(1)}k likes
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleCopyLink(music.playUrl)}
                                                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title="Copy Audio Link"
                                            >
                                                <Copy size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDownload(music.playUrl, music.title)}
                                                className="p-2 text-gray-400 hover:text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-lg transition-colors"
                                                title="Download Audio"
                                            >
                                                <Download size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* BG Blurred Glow */}
                                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-br from-pink-500/10 to-transparent rounded-full blur-2xl group-hover:from-pink-500/20 transition-all pointer-events-none" />
                            </div>
                        ))
                    )}
                </div>

                {!loading && trends.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                            <Music size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">No Trends Found</h3>
                        <p className="text-gray-500">Try changing the region or refreshing.</p>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
