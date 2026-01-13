import React, { useState, useEffect } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Facebook, Download, Loader2, CheckCircle, Search, Video, Image as ImageIcon, ExternalLink, ThumbsUp, X } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function FacebookDownloader() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const handleDownload = async () => {
        if (!url.includes("facebook.com") && !url.includes("fb.watch")) {
            return toast.error("Invalid Facebook Link");
        }

        setLoading(true);
        setResult(null);

        try {
            const res = await api.post("/tools/facebook/download", { url });
            if (res.data.success) {
                setResult(res.data);
                toast.success("Video found!");
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Download Failed. Is the video Public?");
        } finally {
            setLoading(false);
        }
    };

    const clearResult = () => {
        setResult(null);
        setUrl("");
    };

    // Helper to determine quality label
    const getQualityLabel = (url) => {
        if (url.includes("hd_src")) return "HD Quality";
        if (url.includes("sd_src")) return "SD Quality";
        return "Standard Quality";
    };

    return (
        <DashboardLayout>
            {/* Ambient Background Blobs (Blue/Indigo Theme) */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] opacity-50 animate-blob" />
                <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] bg-indigo-500/20 rounded-full blur-[120px] opacity-50 animate-blob animation-delay-2000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-sky-500/20 rounded-full blur-[120px] opacity-50 animate-blob animation-delay-4000" />
            </div>

            <div className={`relative z-10 p-6 max-w-5xl mx-auto transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

                {/* Header */}
                <div className="text-center mb-10 space-y-3">
                    <div className="inline-flex items-center justify-center p-3 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30 mb-2">
                        <Facebook size={32} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                        Facebook <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">Downloader</span>
                    </h1>
                    <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                        Download public Facebook videos in HD quality.
                    </p>
                </div>

                {/* 🔍 Input Section */}
                <div className="max-w-xl mx-auto space-y-6 mb-12">
                    <div className="relative flex items-center bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-xl border border-white/20 dark:border-white/10 shadow-xl shadow-blue-500/5 hover:shadow-blue-500/10 transition-all duration-300">
                        <div className="pl-5 pr-3 text-gray-400">
                            <Search size={22} />
                        </div>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleDownload()}
                            placeholder="Paste Facebook video link..."
                            className="w-full bg-transparent py-4 pr-4 text-base text-gray-900 dark:text-white placeholder:text-gray-400 border-none shadow-none outline-none font-medium"
                            style={{ caretColor: '#3b82f6' }}
                        />
                        {url && (
                            <button onClick={() => setUrl("")} className="p-2 mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                <X size={20} />
                            </button>
                        )}
                    </div>

                    {!result && (
                        <button
                            onClick={handleDownload}
                            disabled={!url || loading}
                            className={`w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 ${loading ? 'opacity-80' : ''}`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={24} />
                                    <span>Fetching Video...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={24} />
                                    Download Video
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* 🎥 Result Card */}
                {result && (
                    <div className="max-w-4xl mx-auto bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-3xl p-6 md:p-8 border border-white/20 dark:border-white/10 shadow-2xl shadow-blue-500/5 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex flex-col md:flex-row gap-8">

                            {/* Media Preview */}
                            <div className="w-full md:w-1/3 shrink-0">
                                <div className="aspect-video md:aspect-[4/5] rounded-2xl overflow-hidden relative group bg-black shadow-lg border border-white/10">
                                    {result.video?.type === 'image' ? (
                                        <img src={result.video.url} className="w-full h-full object-contain" alt="FB Content" />
                                    ) : (
                                        <video src={result.video?.url || result.url} controls className="w-full h-full object-contain bg-black" />
                                    )}
                                    <div className="absolute top-3 left-3 px-3 py-1 bg-blue-600/90 backdrop-blur-md rounded-lg text-white text-[10px] font-black border border-blue-400/50 shadow-xl tracking-tighter uppercase flex items-center gap-1">
                                        {result.video?.type === 'image' ? <><ImageIcon size={12} /> IMAGE</> : <><Video size={12} /> {getQualityLabel(result.video?.url || result.url)}</>}
                                    </div>
                                </div>
                            </div>

                            {/* Details & Actions */}
                            <div className="flex-1 flex flex-col">
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20">
                                            <CheckCircle size={12} /> Video Ready
                                        </span>
                                        <button onClick={clearResult} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-sm font-medium flex items-center gap-1">
                                            Clear <ExternalLink size={14} />
                                        </button>
                                    </div>

                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-2 line-clamp-2">
                                        {result.meta?.title || "Facebook Video"}
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                        {result.meta?.filename}
                                    </p>

                                    <div className="flex flex-wrap gap-2 mb-8">
                                        {['High Speed', 'MP4 Format', 'Secure'].map(tag => (
                                            <span key={tag} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-semibold border border-gray-200 dark:border-white/10">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="mt-auto space-y-3">
                                        <a
                                            href={result.url}
                                            download
                                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transform active:scale-[0.98]"
                                        >
                                            <Download size={20} /> Save Video
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Features Grid */}
                {!result && !loading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
                        {[
                            { title: "Public Videos", desc: "Download from Pages/Groups", icon: <Video size={20} /> },
                            { title: "HD Quality", desc: "Best available resolution", icon: <ThumbsUp size={20} /> },
                            { title: "Fast & Free", desc: "No limits or hidden fees", icon: <Download size={20} /> }
                        ].map((item, i) => (
                            <div key={i} className="p-6 bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 rounded-2xl text-center hover:bg-white/60 dark:hover:bg-white/10 transition-colors group">
                                <div className="w-12 h-12 mx-auto bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-500 group-hover:text-blue-600 transition-colors mb-4">
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
