import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { 
    Download, Loader2, CheckCircle, Search, Image as ImageIcon, 
    Video, ExternalLink, Camera, X, Sparkles, Zap
} from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

// ✨ Motion Variants
const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.1 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
};

export default function PinterestDownloader() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

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
                toast.success("Pin found!", { icon: "✨" });
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
            {/* 🌈 Modern Background Mesh (Red/Pink) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-orange-500/20 to-red-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
            </div>

            <motion.div 
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="relative z-10 p-4 md:p-8 max-w-6xl mx-auto space-y-8 pb-24"
            >
                {/* 🏷️ Header */}
                <div className="text-center space-y-3">
                    <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider">
                        <Camera size={14} /> Pinterest Saver
                    </motion.div>
                    <motion.h1 variants={itemVariants} className="text-3xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white">
                        Pin <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-pink-600">Premium</span>
                    </motion.h1>
                    <motion.p variants={itemVariants} className="text-gray-500 dark:text-gray-400 max-w-md mx-auto text-sm md:text-base px-4">
                        Download high-resolution images and videos directly from Pinterest.
                    </motion.p>
                </div>

                {/* 🔍 Search Input */}
                <div className="max-w-2xl mx-auto relative group px-2">
                    <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-pink-600 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-500" />
                    <div className="relative flex items-center bg-white dark:bg-gray-900/80 backdrop-blur-2xl rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden">
                        <div className="pl-4 md:pl-6 text-gray-400 shrink-0">
                            <Search size={20} className="group-focus-within:text-red-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => {
                                setUrl(e.target.value);
                                if (result) setResult(null);
                            }}
                            onKeyDown={(e) => e.key === "Enter" && handleDownload()}
                            placeholder="Paste Pin link here..."
                            className="w-full bg-transparent py-4 md:py-5 px-3 md:px-4 text-base md:text-lg border-none focus:ring-0 focus:outline-none focus-visible:outline-none outline-none text-gray-900 dark:text-white placeholder:text-gray-500 min-w-0"
                        />
                        <div className="flex items-center gap-1 md:gap-2 pr-2 md:pr-4 shrink-0">
                            {url && (
                                <button onClick={() => setUrl("")} className="p-1 md:p-2 text-gray-400 hover:text-red-500 transition-colors">
                                    <X size={18} />
                                </button>
                            )}
                            <button 
                                onClick={handleDownload}
                                disabled={!url || loading}
                                className="px-4 md:px-6 py-2 md:py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-red-500/20"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : "Fetch"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 🎥 Result Card */}
                <AnimatePresence>
                    {result && (
                        <motion.div 
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="max-w-4xl mx-auto px-2"
                        >
                            <div className="bg-white/70 dark:bg-gray-900/50 backdrop-blur-3xl rounded-3xl p-4 md:p-8 border border-white/30 dark:border-white/10 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-[80px] -mr-32 -mt-32 transition-transform group-hover:scale-110 duration-1000" />
                                
                                <div className="flex flex-col md:flex-row gap-6 md:gap-8 relative z-10">
                                    {/* Preview Section */}
                                    <div className="w-full md:w-80 shrink-0">
                                        <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-black shadow-2xl relative border border-white/20">
                                            {result.meta?.type === 'video' ? (
                                                <video
                                                    src={result.url}
                                                    className="w-full h-full object-cover"
                                                    controls
                                                    autoPlay
                                                    muted
                                                    loop
                                                    playsInline
                                                />
                                            ) : (
                                                <img 
                                                    src={result.url} 
                                                    className="w-full h-full object-cover" 
                                                    referrerPolicy="no-referrer"
                                                    alt="Preview"
                                                />
                                            )}
                                            <div className="absolute top-4 left-4">
                                                <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/20 text-[10px] font-black text-white flex items-center gap-1.5 shadow-lg tracking-tighter">
                                                    {result.meta?.type === 'video' ? <><Video size={12} className="text-red-400" /> VIDEO</> : <><ImageIcon size={12} className="text-red-400" /> IMAGE</>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info Section */}
                                    <div className="flex-1 flex flex-col min-w-0 py-2">
                                        <div className="space-y-4 mb-6 md:mb-8">
                                            <div className="flex items-center justify-between">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-widest border border-red-500/20">
                                                    <CheckCircle size={12} /> Ready to Download
                                                </span>
                                                <button onClick={clearResult} className="text-gray-400 hover:text-red-500 transition-colors">
                                                    <X size={20} />
                                                </button>
                                            </div>
                                            <h2 className="text-lg md:text-2xl font-black text-gray-900 dark:text-white leading-tight line-clamp-2 md:line-clamp-3">
                                                {result.meta?.title || "Pinterest Content"}
                                            </h2>
                                            <div className="flex flex-wrap gap-2">
                                                {['Original Res', 'Direct Link', 'Pinterest API'].map(tag => (
                                                    <span key={tag} className="px-2.5 py-1 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[9px] md:text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="mt-auto grid grid-cols-1 gap-3">
                                            <a
                                                href={result.url}
                                                download
                                                className="h-12 md:h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-sm md:text-base shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                            >
                                                <Download size={18} /> Download Now
                                            </a>

                                            <button
                                                onClick={clearResult}
                                                className="h-10 md:h-12 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-[10px] md:text-xs hover:bg-gray-50 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Search size={14} /> Download Another
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Features Grid */}
                {!result && !loading && (
                    <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto pt-8">
                        {[
                            { title: "High Quality", desc: "Download in original resolution", icon: <ImageIcon className="text-red-500" /> },
                            { title: "Any Content", desc: "Supports Images, Videos & GIFs", icon: <Zap className="text-orange-500" /> },
                            { title: "Lightning Fast", desc: "Direct download links instantly", icon: <Sparkles className="text-pink-500" /> }
                        ].map((item, i) => (
                            <div key={i} className="p-6 bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl text-center group hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-300 shadow-xl">
                                <div className="w-12 h-12 mx-auto bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    {item.icon}
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-1">{item.title}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                            </div>
                        ))}
                    </motion.div>
                )}
            </motion.div>
        </DashboardLayout>
    );
}
