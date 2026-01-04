import React, { useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Instagram, Download, Loader2, CheckCircle, Smartphone } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function InstagramDownloader() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

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

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="text-center mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600 mb-4 shadow-lg shadow-pink-500/20">
                        <Instagram size={32} />
                    </div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
                        Instagram <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Downloader</span>
                    </h1>
                    <p className="text-gray-500">Download Reels, Posts, and Photos instantly.</p>
                </div>

                {/* 🔍 Input Box */}
                <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 flex items-center gap-2 mb-12 transform transition-all hover:scale-[1.01]">
                    <div className="pl-4 text-gray-400">
                        <Instagram size={20} />
                    </div>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleDownload()}
                        placeholder="Paste link (e.g., https://www.instagram.com/reel/Code...)"
                        className="flex-1 bg-transparent p-4 outline-none text-lg text-gray-700 dark:text-gray-200"
                    />
                    <button
                        onClick={handleDownload}
                        disabled={loading}
                        className="bg-pink-600 hover:bg-pink-700 text-white px-8 py-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-pink-500/30"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                        {loading ? "Processing..." : "Download"}
                    </button>
                </div>

                {/* 🎥 Result */}
                {result && (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl border border-gray-100 dark:border-gray-700 max-w-sm mx-auto animate-in zoom-in duration-300">
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center justify-center gap-2">
                                <CheckCircle className="text-green-500" /> Done!
                            </h3>

                            {/* Preview (Mobile Style) */}
                            <div className="relative rounded-2xl overflow-hidden shadow-lg mb-6 bg-black aspect-[9/16]">
                                {result.meta?.type === 'video' ? (
                                    <video src={result.url} controls className="w-full h-full object-cover" />
                                ) : (
                                    <img src={result.url} alt="IG Media" className="w-full h-full object-cover" />
                                )}
                                <div className="absolute top-2 right-2 bg-black/50 p-1 rounded-full text-white">
                                    <Smartphone size={16} />
                                </div>
                            </div>

                            <a
                                href={result.url}
                                download
                                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-pink-500/30 transition-all transform hover:scale-105"
                            >
                                <Download size={24} /> Save to Device
                            </a>

                            <p className="mt-4 text-xs text-gray-400">
                                {result.meta?.filename}
                            </p>
                        </div>
                    </div>
                )}

                {!result && !loading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center opacity-50 mt-12">
                        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2">1. Copy Link</h4>
                            <p className="text-sm">From Instagram App (Share -> Copy Link)</p>
                        </div>
                        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2">2. Paste</h4>
                            <p className="text-sm">Paste into the box above</p>
                        </div>
                        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2">3. Save</h4>
                            <p className="text-sm">Download Reels & Photos in HD</p>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
