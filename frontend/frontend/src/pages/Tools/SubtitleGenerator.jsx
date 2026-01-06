import React, { useState, useRef } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Upload, Languages, Play, CheckCircle, Video, Loader, Zap } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function SubtitleGenerator() {
    const [video, setVideo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [resultVideo, setResultVideo] = useState(null);
    const [status, setStatus] = useState("");
    const fileInputRef = useRef(null);

    const handleGenerate = async () => {
        if (!video) return toast.error("Please upload a video first.");

        setLoading(true);
        setStatus("Processing... (This may take a minute)");

        const formData = new FormData();
        formData.append('video', video);

        try {
            const token = localStorage.getItem("token");
            const res = await axios.post('/api/tools/subtitle/generate', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (res.data.success) {
                setResultVideo(res.data.videoUrl);
                toast.success("Subtitles Added Successfully! 🇰🇭");
            } else {
                toast.error("Process Failed.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Server Error: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
            setStatus("");
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto px-4 py-6 md:px-6 md:py-10 min-h-screen">

                {/* Header */}
                <div className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                        <Languages size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Auto Khmer Subtitles</h1>
                        <p className="text-gray-500 dark:text-gray-400">AI listens to English/Chinese and adds Khmer subtitles automatically.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* 👈 Left: Upload */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
                            {/* Pro Badge */}
                            <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1">
                                <Zap size={12} fill="currentColor" /> PRO FEATURE
                            </div>

                            <h3 className="font-bold text-lg mb-4 text-gray-900 dark:text-white">1. Upload Video</h3>

                            <div
                                onClick={() => fileInputRef.current.click()}
                                className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-2xl p-6 md:p-10 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <input
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={(e) => setVideo(e.target.files[0])}
                                />
                                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Video size={32} />
                                </div>
                                <p className="font-bold text-gray-700 dark:text-gray-200">
                                    {video ? video.name : "Click to upload video"}
                                </p>
                                <p className="text-sm text-gray-400 mt-2">Supports MP4, MOV (Max 50MB recommended)</p>
                            </div>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={loading || !video}
                            className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 transition-all ${loading || !video ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-[1.02]'}`}
                        >
                            {loading ? <Loader className="animate-spin" /> : <Languages />}
                            {loading ? "AI is Working..." : "Generate Subtitles"}
                        </button>

                        {loading && (
                            <div className="text-center text-sm text-purple-600 animate-pulse">
                                🧠 AI is listening & translating to Khmer...
                            </div>
                        )}
                    </div>

                    {/* 👉 Right: Result */}
                    <div className="bg-black rounded-3xl overflow-hidden shadow-2xl relative aspect-[9/16] max-h-[700px] mx-auto w-full max-w-sm flex flex-col items-center justify-center border border-gray-800">
                        {resultVideo ? (
                            <video
                                src={resultVideo}
                                controls
                                className="w-full h-full object-contain bg-black"
                            />
                        ) : (
                            <div className="text-center text-gray-600 p-6 md:p-10">
                                <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-800">
                                    <Video size={32} />
                                </div>
                                <h3 className="font-bold text-gray-500">Preview Area</h3>
                                <p className="text-xs mt-2 text-gray-600">Generated video will appear here.</p>
                            </div>
                        )}

                        {resultVideo && (
                            <a
                                href={resultVideo}
                                download
                                className="absolute bottom-6 bg-white text-black px-6 py-2 rounded-full font-bold shadow-xl hover:bg-gray-200 transition-colors flex items-center gap-2 z-20"
                            >
                                <CheckCircle size={16} className="text-green-500" /> Download
                            </a>
                        )}
                    </div>

                </div>
            </div>
        </DashboardLayout>
    );
}
