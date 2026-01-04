import React, { useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Send, Download, Loader2, CheckCircle, ExternalLink } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function TelegramDownloader() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleDownload = async () => {
        if (!url.includes("t.me/")) return toast.error("Invalid Telegram Link");

        setLoading(true);
        setResult(null);

        try {
            const res = await api.post("/tools/telegram/download", { url });
            if (res.data.success) {
                setResult(res.data);
                toast.success("Media found!");
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Download Failed. Is the channel Public?");
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="text-center mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-500 mb-4 shadow-lg shadow-blue-500/20">
                        <Send size={32} />
                    </div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
                        Telegram <span className="text-blue-500">Media Downloader</span>
                    </h1>
                    <p className="text-gray-500">Download Videos & Photos from Public Channels.</p>
                </div>

                {/* 🔍 Input Box */}
                <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 flex items-center gap-2 mb-12 transform transition-all hover:scale-[1.01]">
                    <div className="pl-4 text-gray-400">
                        <Send size={20} />
                    </div>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleDownload()}
                        placeholder="Paste link (e.g., https://t.me/channel/123)"
                        className="flex-1 bg-transparent p-4 outline-none text-lg text-gray-700 dark:text-gray-200"
                    />
                    <button
                        onClick={handleDownload}
                        disabled={loading}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/30"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <Download size={20} />}
                        {loading ? "Processing..." : "Download"}
                    </button>
                </div>

                {/* 🎥 Result */}
                {result && (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl border border-gray-100 dark:border-gray-700 max-w-2xl mx-auto animate-in zoom-in duration-300">
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center justify-center gap-2">
                                <CheckCircle className="text-green-500" /> Ready to Download
                            </h3>

                            {/* Preview (Video or Image) */}
                            <div className="rounded-2xl overflow-hidden shadow-lg mb-6 bg-black">
                                {result.meta?.type === 'video' ? (
                                    <video src={result.url} controls className="w-full max-h-[400px]" />
                                ) : (
                                    <img src={result.url} alt="Telegram Media" className="w-full max-h-[400px] object-contain" />
                                )}
                            </div>

                            <a
                                href={result.url}
                                download
                                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-green-500/30 transition-all transform hover:scale-105"
                            >
                                <Download size={24} /> Save Media
                            </a>

                            <p className="mt-4 text-sm text-gray-400">
                                Size: {result.meta?.size || 'Unknown'} • {result.meta?.filename}
                            </p>
                        </div>
                    </div>
                )}

                {!result && !loading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center opacity-50 mt-12">
                        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2">1. Find Link</h4>
                            <p className="text-sm">Copy public post link ending in number</p>
                        </div>
                        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2">2. Paste</h4>
                            <p className="text-sm">Paste into the box above</p>
                        </div>
                        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                            <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2">3. Save</h4>
                            <p className="text-sm">Get high quality media instantly</p>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
