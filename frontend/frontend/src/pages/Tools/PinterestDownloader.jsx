import React, { useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Search, Download, Check, Video, Image as ImageIcon, Save, ExternalLink } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function PinterestDownloader() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [mediaData, setMediaData] = useState(null);

    // 🔍 Step 1: Lookup
    const handleLookup = async () => {
        if (!url.includes("pinterest.com") && !url.includes("pin.it")) return toast.error("Please enter a valid Pinterest URL");

        setLoading(true);
        setMediaData(null);
        const toastId = toast.loading("Fetching pin info...");

        try {
            const res = await api.post("/tools/pinterest/lookup", { url });
            if (res.data.success) {
                setMediaData(res.data.media);
                toast.success("Found!", { id: toastId });
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to find pin", { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
                        Pinterest <span className="text-red-600">Downloader (HD)</span>
                    </h1>
                    <p className="text-gray-500">Download high-quality (Originals) Images and Videos from Pinterest.</p>
                </div>

                {/* 🔍 Search Box */}
                <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 flex items-center gap-2 mb-8 transform transition-all hover:scale-[1.01]">
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                        placeholder="Paste Pinterest link... (e.g. https://pin.it/...)"
                        className="flex-1 bg-transparent p-4 outline-none text-lg text-gray-700 dark:text-gray-200"
                    />
                    <button
                        onClick={handleLookup}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? "Searching..." : <><Search size={20} /> Search</>}
                    </button>
                </div>

                {/* 🎥 Result Card */}
                {mediaData && (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Preview */}
                        <div className="w-full md:w-1/2 bg-gray-100 dark:bg-gray-900 relative group flex items-center justify-center">
                            {mediaData.type === 'video' ? (
                                <video
                                    src={mediaData.url}
                                    className="max-h-[500px] w-full object-contain"
                                    controls
                                    poster={mediaData.preview}
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                        if (mediaData.sd_url && e.target.src !== mediaData.sd_url) {
                                            e.target.src = mediaData.sd_url;
                                        }
                                    }}
                                />
                            ) : (
                                <img
                                    src={mediaData.url}
                                    className="max-h-[500px] w-full object-contain"
                                    alt="Pinterest content"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                        // 🔄 Fallback to SD if HD fails
                                        if (mediaData.sd_url && e.target.src !== mediaData.sd_url) {
                                            console.warn("HD failed, falling back to SD");
                                            e.target.src = mediaData.sd_url;
                                        }
                                    }}
                                />
                            )}
                        </div>

                        {/* Info & Actions */}
                        <div className="w-full md:w-1/2 p-8 flex flex-col">
                            <div className="mb-6">
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-3 ${mediaData.type === 'video' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>
                                    {mediaData.type === 'video' ? <Video size={14} /> : <ImageIcon size={14} />}
                                    {mediaData.type}
                                </span>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-3">
                                    {mediaData.title}
                                </h3>
                            </div>

                            <div className="mt-auto space-y-3">
                                {/* ⬇️ Download via Proxy (Fixes CORS) */}
                                <button
                                    onClick={() => {
                                        const downloadUrl = `${api.defaults.baseURL}/tools/pinterest/download?url=${encodeURIComponent(mediaData.url)}&filename=${encodeURIComponent(mediaData.title.substring(0, 20))}`;
                                        window.location.href = downloadUrl;
                                    }}
                                    className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 transition-all"
                                >
                                    <Download size={20} /> Download {mediaData.type === 'video' ? 'Video' : 'Image'}
                                </button>

                                <a
                                    href={mediaData.original_url || url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block text-center text-sm text-gray-400 hover:text-gray-600 mt-2"
                                >
                                    <div className="flex items-center justify-center gap-1">
                                        Open Original Post <ExternalLink size={14} />
                                    </div>
                                </a>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
