import React, { useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Search, Download, Facebook, Loader2, Play, Check } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function FacebookDownloader() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [videoData, setVideoData] = useState(null);
    const [downloading, setDownloading] = useState(false);

    // 🔍 Step 1: Lookup
    const handleLookup = async () => {
        setLoading(true);
        setVideoData(null);

        try {
            const isFb = /(facebook\.com|fb\.watch|fb\.me)/.test(url);
            if (!isFb) {
                setLoading(false);
                return toast.error("Invalid Facebook URL");
            }

            const res = await api.post("/tools/facebook/lookup", { url });
            if (res.data.success) {
                setVideoData(res.data.video);
                toast.success("Video found!");
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to find video");
        } finally {
            setLoading(false);
        }
    };

    // 📥 Step 2: Download
    const handleDownload = async () => {
        setDownloading(true);
        const toastId = toast.loading("Downloading...");

        try {
            const downloadPayload = { url };

            const res = await api.post("/tools/facebook/download", downloadPayload);
            if (res.data.success) {
                toast.success("Ready!", { id: toastId });
                const link = document.createElement('a');
                link.href = res.data.url;
                link.download = `fb-video-${Date.now()}.mp4`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Download failed", { id: toastId });
        } finally {
            setDownloading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto px-4 py-4 md:py-8">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
                        Facebook <span className="text-blue-600">Video Downloader</span>
                    </h1>
                    <p className="text-gray-500">Download Public Videos, Reels & Watch Videos.</p>
                </div>

                {/* 🔍 Input Section */}
                <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 transform transition-all hover:scale-[1.01] mb-8">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                            placeholder="Paste Facebook video/reel URL..."
                            className="flex-1 bg-transparent p-4 outline-none text-lg text-gray-700 dark:text-gray-200"
                        />
                        <button
                            onClick={handleLookup}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <><Search size={20} /> Search</>}
                        </button>
                    </div>
                </div>

                {/* 🎥 Result Card */}
                {videoData && (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col md:flex-row">
                            <div className="w-full md:w-5/12 relative bg-black group flex items-center justify-center">
                                {videoData.thumbnail ? (
                                    <img src={videoData.thumbnail} className="w-full h-full object-contain aspect-video" alt="Thumb" />
                                ) : (
                                    <div className="w-full aspect-video flex items-center justify-center bg-gray-900 text-gray-700">
                                        <Facebook size={64} />
                                    </div>
                                )}

                                {videoData.type !== 'image' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                                        <Play size={48} className="text-white opacity-80" />
                                    </div>
                                )}
                            </div>

                            <div className="w-full md:w-7/12 p-4 md:p-6 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-2 mb-2">
                                        {videoData.title}
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-4">Posted by: {videoData.author}</p>

                                    {videoData.type === 'image' && (
                                        <div className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold mb-4">
                                            IMAGE POST
                                        </div>
                                    )}
                                </div>

                                <div className="mt-6">
                                    {videoData.type === 'image' ? (
                                        <a
                                            href={videoData.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download={`fb-image-${Date.now()}.jpg`}
                                            className="w-full py-4 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
                                        >
                                            <Download size={24} /> Download Image
                                        </a>
                                    ) : (
                                        <button
                                            onClick={handleDownload}
                                            disabled={downloading}
                                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
                                        >
                                            {downloading ? (
                                                <> <Loader2 className="animate-spin" size={24} /> Downloading... </>
                                            ) : (
                                                <> <Download size={24} /> Download Video </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ✨ Features Info */}
                {!videoData && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-center opacity-70">
                        <div className="p-4">
                            <div className="mx-auto mb-3 bg-blue-100 text-blue-600 w-12 h-12 rounded-full flex items-center justify-center"><Facebook /></div>
                            <h3 className="font-bold">Public Videos</h3>
                            <p className="text-xs">Supports public posts, reels, and watch videos.</p>
                        </div>
                        <div className="p-4">
                            <div className="mx-auto mb-3 bg-purple-100 text-purple-600 w-12 h-12 rounded-full flex items-center justify-center"><Download /></div>
                            <h3 className="font-bold">Original Quality</h3>
                            <p className="text-xs">Downloads the highest resolution available.</p>
                        </div>
                        <div className="p-4">
                            <div className="mx-auto mb-3 bg-green-100 text-green-600 w-12 h-12 rounded-full flex items-center justify-center"><Check /></div>
                            <h3 className="font-bold">Fast & Free</h3>
                            <p className="text-xs">No watermarks, no limits.</p>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
