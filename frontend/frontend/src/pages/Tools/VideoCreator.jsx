import React, { useState, useRef } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Upload, Music, Play, Video, Loader, CheckCircle, X, Film } from 'lucide-react';
import apiUtils from '../../utils/apiUtils';
import toast from 'react-hot-toast';
import axios from 'axios';

export default function VideoCreator() {
    const [images, setImages] = useState([]);
    const [audio, setAudio] = useState(null);
    const [loading, setLoading] = useState(false);
    const [generatedVideo, setGeneratedVideo] = useState(null);

    // Drag & Drop Refs
    const fileInputRef = useRef(null);
    const audioInputRef = useRef(null);

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length + images.length > 10) {
            toast.error("Max 10 images allowed.");
            return;
        }
        setImages([...images, ...files]);
    };

    const handleRemoveImage = (index) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const handleGenerate = async () => {
        if (images.length === 0) return toast.error("Please upload at least 1 image.");

        setLoading(true);
        const formData = new FormData();
        images.forEach(img => formData.append('images', img));
        if (audio) formData.append('audio', audio);

        try {
            // We use axios directly for multipart/form-data convenience or apiUtils if configured
            // Assuming apiUtils handles headers correctly, but FormData needs specific handling.
            // Let's use axios directly with auth header for safety.
            const token = localStorage.getItem("token");
            const res = await axios.post('/api/tools/video-creator/create', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.data.success) {
                setGeneratedVideo(res.data.videoUrl);
                toast.success("Video Created Successfully! 🎉");
            } else {
                toast.error(res.data.error || "Generation failed.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Server error during generation.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto px-4 py-6 md:px-6 md:py-10 min-h-screen">

                {/* Header */}
                <div className="flex items-center gap-4 mb-10">
                    <div className="w-12 h-12 bg-pink-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-pink-500/30">
                        <Film size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Video Creator</h1>
                        <p className="text-gray-500 dark:text-gray-400">Turn static product photos into engaging Reels.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* 👈 Left: Inputs */}
                    <div className="space-y-6">

                        {/* Image Upload */}
                        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                                <Upload size={18} className="text-blue-500" /> Upload Images
                            </h3>

                            <div
                                onClick={() => fileInputRef.current.click()}
                                className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-2xl p-8 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleImageChange}
                                />
                                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Upload size={20} />
                                </div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                    Click to select product photos
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Up to 10 images (JPG, PNG)</p>
                            </div>

                            {/* Image Preview List */}
                            {images.length > 0 && (
                                <div className="grid grid-cols-4 gap-2 mt-4">
                                    {images.map((img, idx) => (
                                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 group">
                                            <img src={URL.createObjectURL(img)} alt="preview" className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => handleRemoveImage(idx)}
                                                className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Audio Upload */}
                        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                                <Music size={18} className="text-pink-500" /> Background Music
                            </h3>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => audioInputRef.current.click()}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Select Audio File
                                </button>
                                <span className="text-sm text-gray-500 truncate max-w-[200px]">
                                    {audio ? audio.name : "No audio selected"}
                                </span>
                                <input
                                    type="file"
                                    accept="audio/*"
                                    className="hidden"
                                    ref={audioInputRef}
                                    onChange={(e) => setAudio(e.target.files[0])}
                                />
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={loading || images.length === 0}
                            className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all ${loading || images.length === 0 ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:scale-[1.02]'}`}
                        >
                            {loading ? <Loader className="animate-spin" /> : <Play fill="currentColor" />}
                            {loading ? "Generating Magic..." : "Create Video"}
                        </button>

                    </div>

                    {/* 👉 Right: Preview */}
                    <div className="bg-black rounded-3xl overflow-hidden shadow-2xl relative aspect-[9/16] max-h-[700px] mx-auto w-full max-w-sm flex flex-col items-center justify-center">
                        {generatedVideo ? (
                            <video
                                src={generatedVideo}
                                controls
                                autoPlay
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="text-center text-gray-500 p-6 md:p-10">
                                <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Video size={32} className="text-gray-600" />
                                </div>
                                <h3 className="font-bold text-gray-400">Preview Area</h3>
                                <p className="text-xs mt-2">Your generated video will appear here.</p>
                            </div>
                        )}

                        {generatedVideo && (
                            <a
                                href={generatedVideo}
                                download
                                className="absolute bottom-6 bg-white text-black px-6 py-2 rounded-full font-bold shadow-xl hover:bg-gray-200 transition-colors flex items-center gap-2"
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
