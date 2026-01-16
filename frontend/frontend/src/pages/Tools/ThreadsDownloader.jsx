import React, { useState, useEffect } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Search, Download, CheckCircle, X, Loader2, Image as ImageIcon, Video, AtSign, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../utils/api";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.MODE === 'development' ? "http://localhost:5000" : "https://eza-post-backend.onrender.com")).replace(/\/api$/, "");

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

export default function ThreadsDownloader() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const handleLookup = async () => {
        if (!url.match(/threads\.(net|com)/)) return toast.error("Please enter a valid Threads URL");

        setLoading(true);
        setData(null);

        try {
            const res = await api.post("/tools/threads/lookup", { url });
            if (res.data.success) {
                setData(res.data.media);
                toast.success("Threads post found!");
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
            {/* Ambient Background Blobs (Threads Black/White/Purple Theme) */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] opacity-40 animate-blob" />
                <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] bg-blue-500/20 rounded-full blur-[120px] opacity-40 animate-blob animation-delay-2000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-gray-500/10 rounded-full blur-[120px] opacity-40 animate-blob animation-delay-4000" />
            </div>

            <div className={`relative z-10 p-6 max-w-5xl mx-auto transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

                {/* Header */}
                <div className="text-center mb-10 space-y-3">
                    <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-black dark:bg-white shadow-xl shadow-purple-500/10 mb-2">
                        <AtSign size={32} className="text-white dark:text-black" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                        Threads <span className="bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">Downloader</span>
                    </h1>
                    <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                        Save Images, Videos, and GIFs from Threads.
                    </p>
                </div>

                {/* 🔍 Input Section */}
                <div className="max-w-xl mx-auto space-y-6 mb-12">
                    <div className="relative flex items-center bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-xl border border-white/20 dark:border-white/10 shadow-xl shadow-purple-500/5 hover:shadow-purple-500/10 transition-all duration-300">
                        <div className="pl-5 pr-3 text-gray-400">
                            <Search size={22} />
                        </div>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                            placeholder="Paste Threads link..."
                            className="w-full bg-transparent py-4 pr-4 text-base text-gray-900 dark:text-white placeholder:text-gray-400 border-none shadow-none outline-none font-medium"
                            style={{ caretColor: '#8b5cf6' }}
                        />
                        {url && (
                            <button onClick={() => setUrl("")} className="p-2 mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                <X size={20} />
                            </button>
                        )}
                    </div>

                    {!data && (
                        <button
                            onClick={handleLookup}
                            disabled={!url || loading}
                            className={`w-full py-4 bg-black hover:bg-gray-900 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 ${loading ? 'opacity-80' : ''}`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={24} />
                                    <span>Fetching Post...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={24} />
                                    Find Media
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* 🎥 Result Card */}
                {data && (
                    <div className="max-w-4xl mx-auto bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-3xl p-6 md:p-8 border border-white/20 dark:border-white/10 shadow-2xl shadow-purple-500/5 animate-in fade-in zoom-in-95 duration-300">

                        <div className="flex flex-col gap-8">

                            {/* Top Bar: User Info & Actions */}
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center border border-white/10">
                                        <AtSign size={24} className="text-black dark:text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                                            {data.author.fullname || "Threads User"}
                                        </h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                            @{data.author.username}
                                        </p>
                                    </div>
                                </div>

                                <button onClick={clearResult} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-sm font-medium flex items-center gap-1">
                                    Clear <ExternalLink size={14} />
                                </button>
                            </div>

                            <div className="h-px bg-gray-200 dark:bg-white/10 w-full" />

                            {/* Content Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Videos */}
                                {data.videos.length > 0 && data.videos.map((vid, idx) => (
                                    <div key={`vid-${idx}`} className="group relative bg-black rounded-2xl overflow-hidden shadow-lg border border-white/10">
                                        <div className="aspect-[3/4] md:aspect-[4/5]">
                                            <video src={getProxyUrl(vid.url, `preview.mp4`)} controls className="w-full h-full object-cover" />
                                        </div>
                                        <div className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg text-white text-[10px] font-black border border-white/10 tracking-wider uppercase flex items-center gap-1">
                                            <Video size={10} /> VIDEO {idx + 1}
                                        </div>
                                        <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/90 to-transparent pt-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <button
                                                onClick={() => handleDownload(vid.url, 'video', idx)}
                                                className="w-full py-3 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors shadow-lg"
                                            >
                                                <Download size={18} /> Download Video
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Images */}
                                {data.images.length > 0 && data.images.map((img, idx) => (
                                    <div key={`img-${idx}`} className="group relative bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg border border-white/10">
                                        <div className="aspect-square md:aspect-[4/5]">
                                            <img src={getProxyUrl(img, `preview.jpg`)} alt="preview" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg text-white text-[10px] font-black border border-white/10 tracking-wider uppercase flex items-center gap-1">
                                            <ImageIcon size={10} /> IMAGE {idx + 1}
                                        </div>
                                        <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/90 to-transparent pt-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <button
                                                onClick={() => handleDownload(img, 'image', idx)}
                                                className="w-full py-3 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors shadow-lg"
                                            >
                                                <Download size={18} /> Download Image
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Summary Footer */}
                            <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 flex flex-wrap gap-4 items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-bold border border-green-500/20">
                                        <CheckCircle size={12} /> Media Ready
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {data.videos.length + data.images.length} items found
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    {['High Res', 'No Watermark'].map(tag => (
                                        <span key={tag} className="px-2 py-1 rounded-md bg-white dark:bg-black/20 text-gray-500 dark:text-gray-400 text-[10px] font-semibold border border-gray-200 dark:border-white/5">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>
                )}

                {/* Features Grid */}
                {!data && !loading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
                        {[
                            { title: "Photos & Videos", desc: "Download carousels easily", icon: <ImageIcon size={20} /> },
                            { title: "Original Quality", desc: "Highest resolution available", icon: <CheckCircle size={20} /> },
                            { title: "Free & Fast", desc: "No limits, instant save", icon: <Download size={20} /> }
                        ].map((item, i) => (
                            <div key={i} className="p-6 bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 rounded-2xl text-center hover:bg-white/60 dark:hover:bg-white/10 transition-colors group">
                                <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center text-black dark:text-white group-hover:scale-110 transition-transform mb-4">
                                    {item.icon}
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-1">{item.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </DashboardLayout>
    );
}
