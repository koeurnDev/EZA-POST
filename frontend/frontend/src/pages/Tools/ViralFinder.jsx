import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Play, Pause, Download, ExternalLink, Globe, TrendingUp, RefreshCw, Send, Loader, AlertCircle, Scissors, Music2, Sparkles, MapPin } from 'lucide-react';
import apiUtils from '../../utils/apiUtils';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function ViralFinder() {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [region, setRegion] = useState('TH');
    const [filterType, setFilterType] = useState('video'); // 'video' | 'capcut'
    const [playingId, setPlayingId] = useState(null);
    const navigate = useNavigate();

    // 🏳️ Region Config (Simplified)
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
            console.error(err);
            toast.error("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => fetchViralVideos(), 800);
        return () => clearTimeout(timer);
    }, [region, filterType]);

    const handlePlayPause = (id) => {
        setPlayingId(playingId === id ? null : id);
    };

    const handleReUp = (video) => {
        navigate('/posts', { state: { tiktokUrl: video.playUrl, caption: video.title } });
    };

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-gray-50/50 dark:bg-[#0f1115]">
                <div className="max-w-[1400px] mx-auto px-4 py-6 md:px-6 md:py-10">

                    {/* ✨ Hero Header */}
                    <div className="mb-12 flex flex-col items-center text-center space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/10 text-pink-500 text-sm font-bold border border-pink-500/20 backdrop-blur-sm">
                            <Sparkles size={14} />
                            <span>Discover What's Hot</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
                            Viral <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-600">Finder</span>
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 max-w-lg text-lg">
                            Curated trending content from across the globe. Find your next viral hit before it explodes.
                        </p>
                    </div>

                    {/* 🎛️ Controls Bar */}
                    <div className="sticky top-4 z-40 bg-white/80 dark:bg-[#1a1d24]/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800 rounded-3xl p-2 shadow-xl shadow-gray-200/20 dark:shadow-none mb-10 mx-auto max-w-4xl flex flex-col md:flex-row gap-4 items-center justify-between transition-all duration-300">

                        {/* Type Switcher */}
                        <div className="flex bg-gray-100 dark:bg-black/20 p-1.5 rounded-2xl w-full md:w-auto">
                            <button
                                onClick={() => setFilterType('video')}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${filterType === 'video' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                <Play size={16} className={filterType === 'video' ? 'fill-current' : ''} /> Videos
                            </button>
                            <button
                                onClick={() => setFilterType('capcut')}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${filterType === 'capcut' ? 'bg-white dark:bg-gray-800 shadow-sm text-pink-500 dark:text-pink-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                <Scissors size={16} /> CapCut
                            </button>
                        </div>

                        {/* Region Scroller */}
                        <div className="w-full md:w-auto overflow-x-auto no-scrollbar flex items-center gap-2 px-2 pb-2 md:pb-0">
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
                                    {region === r.code && (
                                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-current rounded-full mb-1"></span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 🎬 Grid Layout */}
                    {loading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="aspect-[9/14] bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-8">
                            {videos.map((video, idx) => (
                                <div key={video.id} className="group relative bg-white dark:bg-gray-800 rounded-3xl overflow-hidden hover:shadow-2xl hover:shadow-pink-500/10 transition-all duration-500 border border-gray-100 dark:border-gray-800 hover:-translate-y-2">

                                    {/* Video Container */}
                                    <div className="aspect-[9/14] relative bg-black cursor-pointer overflow-hidden" onClick={() => handlePlayPause(video.id)}>
                                        {/* Badge */}
                                        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                                            <div className="bg-black/40 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold border border-white/10">
                                                #{idx + 1}
                                            </div>
                                            {video.stats.likes > 100000 && (
                                                <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg animate-pulse">
                                                    🔥 Hot
                                                </div>
                                            )}
                                        </div>

                                        {playingId === video.id ? (
                                            <video
                                                src={video.playUrl}
                                                autoPlay
                                                controls
                                                loop
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <>
                                                <img
                                                    src={video.cover}
                                                    alt={video.title}
                                                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-60 group-hover:opacity-40 transition-opacity" />

                                                {/* Play Button Center */}
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-50 group-hover:scale-100">
                                                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center text-white hover:bg-white hover:text-pink-500 transition-colors shadow-2xl">
                                                        <Play size={32} fill="currentColor" className="ml-1" />
                                                    </div>
                                                </div>

                                                {/* Stats Overlay */}
                                                <div className="absolute bottom-4 left-4 right-4 text-white z-10">
                                                    <div className="flex items-center gap-2 mb-2 opacity-90">
                                                        <div className="w-6 h-6 rounded-full bg-white/20 overflow-hidden backdrop-blur-sm border border-white/20">
                                                            <img src={video.author.avatar || "https://ui-avatars.com/api/?name=User"} className="w-full h-full" alt="" />
                                                        </div>
                                                        <span className="text-xs font-medium truncate drop-shadow-md">{video.author.nickname}</span>
                                                    </div>
                                                    <p className="text-sm font-bold line-clamp-2 leading-tight drop-shadow-md mb-3">
                                                        {video.title || "No Title"}
                                                    </p>
                                                    <div className="flex items-center justify-between text-xs font-medium opacity-80 backdrop-blur-sm bg-black/20 p-2 rounded-lg border border-white/10">
                                                        <span className="flex items-center gap-1">❤️ {(video.stats.likes / 1000).toFixed(1)}K</span>
                                                        <span className="flex items-center gap-1">▶️ {(video.stats.plays / 1000).toFixed(1)}K</span>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Quick Actions (Slide Up on Hover) */}
                                    <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 translate-x-10 group-hover:translate-x-0 transition-transform duration-300">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleReUp(video); }}
                                            className="w-10 h-10 rounded-full bg-white text-pink-500 shadow-lg flex items-center justify-center hover:bg-pink-500 hover:text-white transition-colors"
                                            title="Re-Up Video"
                                        >
                                            <Send size={18} />
                                        </button>
                                        <a
                                            href={apiUtils.getFullUrl(`/tools/tiktok/proxy?url=${encodeURIComponent(video.playUrl)}&web_url=${encodeURIComponent(video.web_url)}&filename=${encodeURIComponent(video.title)}&type=video/mp4`)}
                                            download={`${video.title}.mp4`}
                                            target="_blank"
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur text-gray-700 shadow-lg flex items-center justify-center hover:bg-gray-900 hover:text-white transition-colors"
                                            title="Download"
                                        >
                                            <Download size={18} />
                                        </a>
                                    </div>

                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && videos.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-32 text-center opacity-60">
                            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 animate-bounce">
                                <Globe size={48} className="text-gray-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Nothing viral right now</h3>
                            <p className="text-gray-500 mt-2">Try switching regions or checking back later.</p>
                            <button onClick={fetchViralVideos} className="mt-8 px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold hover:opacity-80 transition-opacity">
                                Refresh Feed
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </DashboardLayout>
    );
}
