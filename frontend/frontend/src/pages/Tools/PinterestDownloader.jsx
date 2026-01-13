import React, { useState, useEffect } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Download, Loader2, CheckCircle, Search, Image as ImageIcon, Video, ExternalLink, Camera, X } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function PinterestDownloader() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const handleDownload = async () => {
        if (!url.includes("pinterest.com") && !url.includes("pin.it")) {
            return toast.error("Invalid Pinterest Link");
        }

        setLoading(true);
        setResult(null);

        try {
            const res = await api.post("/tools/pinterest/download", { url });
            if (res.data.success) {
                setResult(res.data);
                toast.success("Pin found!");
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Download Failed");
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
            {/* Ambient Background Blobs (Red/Pink Theme) */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/20 rounded-full blur-[120px] opacity-50 animate-blob" />
                <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] bg-pink-500/20 rounded-full blur-[120px] opacity-50 animate-blob animation-delay-2000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-orange-500/20 rounded-full blur-[120px] opacity-50 animate-blob animation-delay-4000" />
            </div>

            <div className={`relative z-10 p-6 max-w-5xl mx-auto transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

                {/* Header */}
                <div className="text-center mb-10 space-y-3">
                    <div className="inline-flex items-center justify-center p-3 rounded-full bg-gradient-to-tr from-red-600 to-pink-600 shadow-lg shadow-red-500/30 mb-2">
                        <Camera size={32} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                        Pinterest <span className="bg-gradient-to-r from-red-600 to-pink-500 bg-clip-text text-transparent">Downloader</span>
                    </h1>
                    <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                        Save Images, Videos, and GIFs from Pinterest.
                    </p>
                </div>

                {/* 🔍 Input Section */}
                <div className="max-w-xl mx-auto space-y-6 mb-12">
                    <div className="relative flex items-center bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-xl border border-white/20 dark:border-white/10 shadow-xl shadow-red-500/5 hover:shadow-red-500/10 transition-all duration-300">
                        <div className="pl-5 pr-3 text-gray-400">
                            <Search size={22} />
                        </div>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleDownload()}
                            placeholder="Paste Pin link..."
                            className="w-full bg-transparent py-4 pr-4 text-base text-gray-900 dark:text-white placeholder:text-gray-400 border-none shadow-none outline-none font-medium"
                            style={{ caretColor: '#e11d48' }}
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
                            className={`w-full py-4 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 ${loading ? 'opacity-80' : ''}`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={24} />
                                    <span>Fetching Pin...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={24} />
                                    Download Pin
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* 🎥 Result Card */}
                {result && (
                    <div className="max-w-4xl mx-auto bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-3xl p-6 md:p-8 border border-white/20 dark:border-white/10 shadow-2xl shadow-red-500/5 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex flex-col md:flex-row gap-8">

                            {/* Media Preview */}
                            <div className="w-full md:w-1/3 shrink-0">
                                <div className="aspect-[3/4] rounded-2xl overflow-hidden relative group bg-gray-100 dark:bg-gray-900 shadow-lg border border-white/10">
                                    {result.meta?.type === 'video' ? (
                                        <video src={result.url} controls className="w-full h-full object-cover" />
                                    ) : (
                                        <img src={result.url} alt="Pinterest Media" className="w-full h-full object-cover" />
                                    )}
                                    <div className="absolute top-3 left-3 px-3 py-1 bg-red-600/90 backdrop-blur-md rounded-lg text-white text-[10px] font-black border border-red-400/50 shadow-xl tracking-tighter uppercase flex items-center gap-1">
                                        {result.meta?.type === 'video' ? <><Video size={10} /> VIDEO</> : <><ImageIcon size={10} /> IMAGE</>}
                                    </div>
                                </div>
                            </div>

                            {/* Details & Actions */}
                            <div className="flex-1 flex flex-col">
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold border border-red-500/20">
                                            <CheckCircle size={12} /> Media Ready
                                        </span>
                                        <button onClick={clearResult} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-sm font-medium flex items-center gap-1">
                                            Clear <ExternalLink size={14} />
                                        </button>
                                    </div>

                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-2 line-clamp-2">
                                        {result.meta?.title || "Pinterest Media"}
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-mono">
                                        {result.meta?.filename}
                                    </p>

                                    <div className="flex flex-wrap gap-2 mb-8">
                                        {['High Res', 'No Watermark', 'Direct Link'].map(tag => (
                                            <span key={tag} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-semibold border border-gray-200 dark:border-white/10">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="mt-auto space-y-3">
                                        <a
                                            href={result.url}
                                            download
                                            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 transform active:scale-[0.98]"
                                        >
                                            <Download size={20} /> Save to Device
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
                            { title: "Any Media", desc: "Images, Videos & GIFs", icon: <Camera size={20} /> },
                            { title: "Original Quality", desc: "Download highest resolution", icon: <ImageIcon size={20} /> },
                            { title: "Easy Save", desc: "One-click download", icon: <Download size={20} /> }
                        ].map((item, i) => (
                            <div key={i} className="p-6 bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 rounded-2xl text-center hover:bg-white/60 dark:hover:bg-white/10 transition-colors group">
                                <div className="w-12 h-12 mx-auto bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-500 group-hover:text-red-600 transition-colors mb-4">
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
