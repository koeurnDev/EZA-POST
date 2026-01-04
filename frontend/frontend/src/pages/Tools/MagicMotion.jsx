import React, { useState, useRef } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Upload, Wand2, Play, CheckCircle, Image as ImageIcon, Loader, Sparkles } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function MagicMotion() {
    const [image, setImage] = useState(null);
    const [effect, setEffect] = useState("zoom");
    const [loading, setLoading] = useState(false);
    const [resultVideo, setResultVideo] = useState(null);
    const fileInputRef = useRef(null);

    const effects = [
        { id: 'zoom', label: 'Slow Zoom (Ken Burns)', icon: '🔍' },
        { id: 'particles', label: 'Sparkles / Noise', icon: '✨' },
        { id: 'flash', label: 'Paparazzi Flash', icon: '📸' },
        { id: 'pulse', label: 'Vignette Pulse', icon: '💓' },
    ];

    const handleGenerate = async () => {
        if (!image) return toast.error("Please upload an image first.");

        setLoading(true);
        const formData = new FormData();
        formData.append('image', image);
        formData.append('effect', effect);

        try {
            const token = localStorage.getItem("token");
            const res = await axios.post('/api/tools/magic-motion/create', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (res.data.success) {
                setResultVideo(res.data.videoUrl);
                toast.success("Magic Applied! ✨");
            }
        } catch (err) {
            console.error(err);
            toast.error("Server Error: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto px-6 py-10 min-h-screen">

                {/* Header */}
                <div className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 bg-pink-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-pink-500/30">
                        <Wand2 size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Magic Motion</h1>
                        <p className="text-gray-500 dark:text-gray-400">Turn static product photos into eye-catching videos.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* 👈 Left: Controls */}
                    <div className="space-y-6">
                        {/* Upload */}
                        <div
                            onClick={() => fileInputRef.current.click()}
                            className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-3xl p-8 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={(e) => setImage(e.target.files[0])}
                            />
                            {image ? (
                                <div className="space-y-2">
                                    <img
                                        src={URL.createObjectURL(image)}
                                        alt="Preview"
                                        className="h-40 mx-auto rounded-lg object-contain"
                                    />
                                    <p className="font-bold text-gray-700 dark:text-gray-200 truncate">{image.name}</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="w-16 h-16 bg-pink-100 dark:bg-pink-900/30 text-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <ImageIcon size={32} />
                                    </div>
                                    <p className="font-bold text-gray-700 dark:text-gray-200">Upload Photo</p>
                                </div>
                            )}
                        </div>

                        {/* Effects Grid */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Choose Effect</label>
                            <div className="grid grid-cols-2 gap-3">
                                {effects.map((ef) => (
                                    <button
                                        key={ef.id}
                                        onClick={() => setEffect(ef.id)}
                                        className={`p-4 rounded-xl border text-left transition-all ${effect === ef.id
                                                ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20 ring-2 ring-pink-500/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-pink-300'
                                            }`}
                                    >
                                        <div className="text-2xl mb-1">{ef.icon}</div>
                                        <div className="font-bold text-sm text-gray-900 dark:text-white">{ef.label}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={loading || !image}
                            className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2 transition-all ${loading || !image ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:scale-[1.02]'}`}
                        >
                            {loading ? <Loader className="animate-spin" /> : <Wand2 />}
                            {loading ? "Creating Magic..." : "Generate Video"}
                        </button>
                    </div>

                    {/* 👉 Right: Result */}
                    <div className="bg-black rounded-3xl overflow-hidden shadow-2xl relative aspect-square max-h-[600px] mx-auto w-full flex flex-col items-center justify-center border border-gray-800">
                        {resultVideo ? (
                            <video
                                src={resultVideo}
                                controls
                                autoPlay
                                loop
                                className="w-full h-full object-contain bg-black"
                            />
                        ) : (
                            <div className="text-center text-gray-600 p-10">
                                <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
                                <h3 className="font-bold text-gray-500">Magic Preview</h3>
                                <p className="text-xs mt-2 text-gray-600">Your animated video will appear here.</p>
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
