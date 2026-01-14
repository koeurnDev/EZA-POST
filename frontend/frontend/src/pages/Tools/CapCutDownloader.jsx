import React, { useState, useEffect } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Scissors, Download, Loader2, CheckCircle, Search, Video, Image as ImageIcon, ExternalLink, Sparkles, X } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function CapCutDownloader() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const handleDownload = async () => {
        if (!url.includes("capcut.com")) {
            return toast.error("Invalid CapCut Link");
        }

        setLoading(true);
        setResult(null);

        try {
            const res = await api.post("/tools/capcut/download", { url });
            if (res.data.success) {
                setResult(res.data);
                toast.success("Template found!");
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
            {/* Ambient Background Blobs (Monochrome/Dark Theme) */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gray-500/20 rounded-full blur-[120px] opacity-50 animate-blob" />
                <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] bg-zinc-600/20 rounded-full blur-[120px] opacity-50 animate-blob animation-delay-2000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-slate-400/20 rounded-full blur-[120px] opacity-50 animate-blob animation-delay-4000" />
            </div>

            <div className={`relative z-10 p-6 max-w-5xl mx-auto transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

                {/* Header */}
                <div className="text-center mb-10 space-y-3">
                    <div className="inline-flex items-center justify-center p-3 rounded-full bg-black shadow-lg shadow-gray-500/30 mb-2 border border-gray-800">
                        <Scissors size={32} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                        CapCut <span className="bg-gradient-to-r from-gray-700 to-black dark:from-gray-400 dark:to-white bg-clip-text text-transparent">Downloader</span>
                    </h1>
                    <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                        Download CapCut templates and videos without watermarks.
                    </p>
                </div>

                {/* 🔍 Input Section */}
                <div className="max-w-xl mx-auto space-y-6 mb-12">
                    <div className="relative flex items-center bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-xl border border-white/20 dark:border-white/10 shadow-xl shadow-black/5 hover:shadow-black/10 transition-all duration-300">
                        <div className="pl-5 pr-3 text-gray-400">
                            <Search size={22} />
                        </div>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleDownload()}
                            placeholder="Paste CapCut template link..."
                            className="w-full bg-transparent py-4 pr-4 text-base text-gray-900 dark:text-white placeholder:text-gray-400 border-none shadow-none outline-none font-medium"
                            style={{ caretColor: '#000000' }}
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
                            className={`w-full py-4 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-gray-500/20 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 ${loading ? 'opacity-80' : ''}`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={24} />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={24} />
                                    Download Template
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
                                <div className="aspect-[9/16] rounded-2xl overflow-hidden relative group bg-black shadow-lg border border-white/10">
                                    <video src={result.url} controls className="w-full h-full object-cover" />
                                    <div className="absolute top-3 left-3 px-3 py-1 bg-black/80 backdrop-blur-md rounded-lg text-white text-[10px] font-black border border-white/20 shadow-xl tracking-tighter uppercase flex items-center gap-1">
                                        <Video size={10} /> TEMPLATE
                                    </div>
                                </div>
                            </div>

                            {/* Details & Actions */}
                            <div className="flex-1 flex flex-col">
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-bold border border-green-500/20">
                                            <CheckCircle size={12} /> Ready to Use
                                        </span>
                                        <button onClick={clearResult} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-sm font-medium flex items-center gap-1">
                                            Clear <ExternalLink size={14} />
                                        </button>
                                    </div>

                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-2 line-clamp-2">
                                        {result.meta?.title || "CapCut Template"}
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-mono">
                                        {result.meta?.filename}
                                    </p>

                                    <div className="flex flex-wrap gap-2 mb-8">
                                        {['No Watermark', 'HD Quality', 'Instant Save'].map(tag => (
                                            <span key={tag} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-semibold border border-gray-200 dark:border-white/10">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="mt-auto space-y-3">
                                        <a
                                            href={result.url}
                                            download
                                            className="w-full py-4 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-500/20 transform active:scale-[0.98]"
                                        >
                                            <Download size={20} /> Save Video
                                        </a>

                                        <button
                                            onClick={clearResult}
                                            className="w-full py-4 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-900 dark:text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 transform active:scale-[0.98]"
                                        >
                                            <Search size={20} /> Download Another
                                        </button>
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
                            { title: "Templates", desc: "Download viral editing templates", icon: <Scissors size={20} /> },
                            { title: "No Watermark", desc: "Clean output without logo", icon: <Sparkles size={20} /> },
                            { title: "Fast", desc: "Instant high-speed server", icon: <Download size={20} /> }
                        ].map((item, i) => (
                            <div key={i} className="p-6 bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 rounded-2xl text-center hover:bg-white/60 dark:hover:bg-white/10 transition-colors group">
                                <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-500 group-hover:text-black dark:group-hover:text-white transition-colors mb-4">
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
