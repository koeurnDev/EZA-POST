import React, { useState, useEffect } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Instagram, Download, Loader2, CheckCircle, Smartphone, X, Search, Image as ImageIcon, Video, Layers, ExternalLink } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

// 🛠️ Helper for clean API URLs (Consistent with TikTok Downloader)
const API_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.MODE === 'development' ? "" : "https://eza-post-backend.onrender.com/api")).replace(/\/api$/, "");

export default function InstagramDownloader() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const handleDownload = async () => {
        if (!url.includes("instagram.com")) return toast.error("Invalid Instagram Link");

        setLoading(true);
        setResult(null);

        try {
            const res = await api.post("/tools/instagram/download", { url });
            if (res.data.success) {
                setResult(res.data);
                toast.success("Media found!");
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Download Failed. Is the account Private?");
        } finally {
            setLoading(false);
        }
    };

    const clearResult = () => {
        setResult(null);
        setUrl("");
    };

    return (
        <DashboardLayout>
            {/* Ambient Background Blobs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-500/30 rounded-full blur-[120px] opacity-50 animate-blob" />
                <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] bg-purple-500/30 rounded-full blur-[120px] opacity-50 animate-blob animation-delay-2000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-orange-500/30 rounded-full blur-[120px] opacity-50 animate-blob animation-delay-4000" />
            </div>

            <div className={`relative z-10 p-6 max-w-5xl mx-auto transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

                {/* Header */}
                <div className="text-center mb-10 space-y-3">
                    <div className="inline-flex items-center justify-center p-3 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 shadow-lg shadow-pink-500/30 mb-2">
                        <Instagram size={32} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                        Instagram <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Downloader</span>
                    </h1>
                    <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                        Download Reels, Posts, and Photos instantly in high quality.
                    </p>
                </div>

                {/* 🔍 Input Section */}
                <div className="max-w-xl mx-auto space-y-6 mb-12">
                    <div className="relative flex items-center bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-xl border border-white/20 dark:border-white/10 shadow-xl shadow-pink-500/5 hover:shadow-pink-500/10 transition-all duration-300">
                        <div className="pl-5 pr-3 text-gray-400">
                            <Search size={22} />
                        </div>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleDownload()}
                            placeholder="Paste Instagram link (e.g., https://www.instagram.com/reel/...)"
                            className="w-full bg-transparent py-4 pr-4 text-base text-gray-900 dark:text-white placeholder:text-gray-400 border-none shadow-none outline-none"
                            style={{ caretColor: '#ec4899' }}
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
                            className={`w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 ${loading ? 'opacity-80' : ''}`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={24} />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={24} />
                                    Download Media
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* 🎥 Result Card */}
                {result && (
                    <div className="max-w-4xl mx-auto bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-3xl p-6 md:p-8 border border-white/20 dark:border-white/10 shadow-2xl shadow-black/5 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex flex-col md:flex-row gap-8">

                            {/* Media Preview */}
                            <div className="w-full md:w-1/3 shrink-0">
                                <div className="aspect-[9/16] md:aspect-[3/4] rounded-2xl overflow-hidden relative group bg-black shadow-lg border border-white/10">
                                    {result.meta?.type === 'video' ? (
                                        <video src={result.url} controls className="w-full h-full object-contain bg-black" />
                                    ) : (
                                        <img src={result.url} alt="IG Media" className="w-full h-full object-cover" />
                                    )}

                                    <div className="absolute top-3 left-3 px-3 py-1 bg-pink-500/90 backdrop-blur-md rounded-lg text-white text-[10px] font-black border border-pink-400/50 shadow-xl tracking-tighter uppercase flex items-center gap-1">
                                        {result.meta?.type === 'video' ? <><Video size={10} /> VIDEO</> : <><ImageIcon size={10} /> IMAGE</>}
                                    </div>
                                </div>
                            </div>

                            {/* Details & Actions */}
                            <div className="flex-1 flex flex-col">
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-bold border border-green-500/20">
                                            <CheckCircle size={12} /> Ready to Download
                                        </span>
                                        <button onClick={clearResult} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-sm font-medium flex items-center gap-1">
                                            Download Another <ExternalLink size={14} />
                                        </button>
                                    </div>

                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-2">
                                        {result.meta?.title || "Instagram Media"}
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono break-all line-clamp-2 mb-6">
                                        {result.meta?.filename}
                                    </p>

                                    <div className="flex flex-wrap gap-2 mb-8">
                                        {['Original Quality', 'No Watermark', 'Secure'].map(tag => (
                                            <span key={tag} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-semibold border border-gray-200 dark:border-white/10">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="mt-auto space-y-3">
                                        <a
                                            href={result.url}
                                            download
                                            className="w-full py-4 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 transform active:scale-[0.98]"
                                        >
                                            <Download size={20} /> Save to Device
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Features Grid (Empty State) */}
                {!result && !loading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
                        {[
                            { title: "Copy Link", desc: "Copy URL from Instagram App", icon: <Search size={20} /> },
                            { title: "Paste Here", desc: "Paste link in the box above", icon: <Layers size={20} /> },
                            { title: "Download", desc: "Save in High Quality", icon: <Download size={20} /> }
                        ].map((item, i) => (
                            <div key={i} className="p-6 bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 rounded-2xl text-center hover:bg-white/60 dark:hover:bg-white/10 transition-colors group">
                                <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-500 group-hover:text-pink-500 transition-colors mb-4">
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
