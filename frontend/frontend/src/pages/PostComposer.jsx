// ============================================================
// 📝 PostComposer.jsx — Create & Schedule Posts
// ============================================================

import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Upload, X, Calendar, Clock, Send, Film, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import apiUtils from "../utils/apiUtils";
import { useAuth } from "../hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion"; // eslint-disable-line no-unused-vars


export default function PostComposer() {
    useAuth();
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [thumbnail, setThumbnail] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const [caption, setCaption] = useState("");
    const [tiktokUrl, setTiktokUrl] = useState(""); // 🎵 New TikTok URL State
    const [selectedPages, setSelectedPages] = useState([]);
    const [availablePages, setAvailablePages] = useState([]);
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduleTime, setScheduleTime] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState(null);

    // Fetch Pages
    useEffect(() => {
        const fetchPages = async () => {
            try {
                const res = await apiUtils.getUserPages();
                if (res.data.success) {
                    const activePages = res.data.accounts.filter(p => p.isSelected);
                    setAvailablePages(activePages);
                    setSelectedPages(activePages.map(p => p.id));
                }
            } catch (err) {
                console.error("Failed to load pages:", err);
            }
        };
        fetchPages();
    }, []);

    // ✅ Validate Video Duration (Max 60s)
    const validateAndSetVideo = (selectedFile) => {
        if (!selectedFile.type.startsWith("video/")) {
            setStatus({ type: "error", message: "Please upload a video file (MP4, MOV)." });
            return;
        }

        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            if (video.duration > 60) {
                setStatus({ type: "error", message: "Video too long. Maximum allowed length is 60 seconds." });
                return;
            }
            // Valid video
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setStatus(null);
        };
        video.src = URL.createObjectURL(selectedFile);
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) validateAndSetVideo(selectedFile);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) validateAndSetVideo(droppedFile);
    };

    const handleThumbnailChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (!selectedFile.type.startsWith("image/")) {
                setStatus({ type: "error", message: "Please upload an image file (JPG, PNG)" });
                return;
            }
            setThumbnail(selectedFile);
            setThumbnailPreview(URL.createObjectURL(selectedFile));
        }
    };

    const handleTogglePage = (pageId) => {
        setSelectedPages(prev =>
            prev.includes(pageId)
                ? prev.filter(id => id !== pageId)
                : [...prev, pageId]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file && !caption && !tiktokUrl) {
            setStatus({ type: "error", message: "Please add a video, caption, or TikTok URL." });
            return;
        }
        if (selectedPages.length === 0) {
            setStatus({ type: "error", message: "Please select at least one page." });
            return;
        }

        setIsSubmitting(true);
        setStatus(null);

        const formData = new FormData();
        if (file) formData.append("video", file);
        if (thumbnail) formData.append("thumbnail", thumbnail);
        formData.append("caption", caption);
        formData.append("tiktokUrl", tiktokUrl); // 🎵 Add TikTok URL
        formData.append("accounts", JSON.stringify(selectedPages));
        if (isScheduling && scheduleTime) {
            formData.append("scheduleTime", scheduleTime);
        }

        try {
            const endpoint = isScheduling ? "/api/posts/schedule" : "/api/posts/create";
            const token = localStorage.getItem("token");
            const response = await fetch(`${(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "")}${endpoint}`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                setStatus({
                    type: "success",
                    message: isScheduling ? "Post scheduled successfully!" : "Post published successfully!"
                });
                setFile(null);
                setPreviewUrl(null);
                setThumbnail(null);
                setThumbnailPreview(null);
                setCaption("");
                setTiktokUrl("");
                setScheduleTime("");
                setIsScheduling(false);
            } else {
                setStatus({ type: "error", message: data.error || "Failed to create post." });
            }
        } catch (err) {
            console.error("Post creation failed:", err);
            setStatus({ type: "error", message: "Network error. Please try again." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Film className="text-blue-500" />
                        Create Post
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 👈 Left Column: Inputs & Settings */}
                    <div className="space-y-6">
                        {/* 🎵 TikTok URL Input */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                TikTok URL
                            </label>
                            <input
                                type="text"
                                value={tiktokUrl}
                                onChange={(e) => setTiktokUrl(e.target.value)}
                                placeholder="Paste TikTok video URL here..."
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* 📝 Caption */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Caption
                            </label>
                            <textarea
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="What's on your mind?"
                                className="w-full h-32 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all text-gray-900 dark:text-white"
                            />
                        </div>

                        {/* 📢 Page Selection */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <CheckCircle2 size={18} className="text-green-500" />
                                    Select Pages
                                </h3>
                                {availablePages.length > 0 && (
                                    <button
                                        onClick={() => setSelectedPages(selectedPages.length === availablePages.length ? [] : availablePages.map(p => p.id))}
                                        className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                    >
                                        {selectedPages.length === availablePages.length ? "Deselect All" : "Select All"}
                                    </button>
                                )}
                            </div>

                            {availablePages.length === 0 ? (
                                <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                    <p className="text-gray-500 text-sm">No active pages found.</p>
                                    <Link to="/settings" className="text-blue-600 text-xs font-medium hover:underline mt-1 inline-block">
                                        Enable pages in Settings
                                    </Link>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {availablePages.map(page => {
                                        const isSelected = selectedPages.includes(page.id);
                                        return (
                                            <div
                                                key={page.id}
                                                onClick={() => handleTogglePage(page.id)}
                                                className={`relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${isSelected
                                                    ? "bg-blue-50 border-blue-500 dark:bg-blue-900/20 dark:border-blue-500"
                                                    : "bg-gray-50 border-transparent hover:border-gray-200 dark:bg-gray-900/50 dark:hover:border-gray-700"
                                                    }`}
                                            >
                                                <img
                                                    src={page.picture || "https://via.placeholder.com/40"}
                                                    alt={page.name}
                                                    className={`w-10 h-10 rounded-full object-cover border-2 ${isSelected ? "border-blue-500" : "border-white dark:border-gray-700"}`}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-semibold truncate ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-white"}`}>
                                                        {page.name}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 truncate">Facebook Page</p>
                                                </div>
                                                {isSelected && <CheckCircle2 size={16} className="text-blue-500" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* 📅 Schedule & Submit */}
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${isScheduling ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"}`}>
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">Schedule for later</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={isScheduling} onChange={(e) => setIsScheduling(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:bg-orange-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                                </label>
                            </div>

                            <AnimatePresence>
                                {isScheduling && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                        <input
                                            type="datetime-local"
                                            value={scheduleTime}
                                            onChange={(e) => setScheduleTime(e.target.value)}
                                            className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {status && (
                                <div className={`p-4 rounded-xl text-sm flex items-start gap-2 ${status.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                                    {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                    {status.message}
                                </div>
                            )}

                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || (!file && !caption && !tiktokUrl) || selectedPages.length === 0}
                                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${isSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02]"}`}
                            >
                                {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : isScheduling ? <><Calendar size={20} /> Schedule Post</> : <><Send size={20} /> Post Now</>}
                            </button>
                        </div>
                    </div>

                    {/* 👉 Right Column: Media Upload */}
                    <div className="space-y-6">
                        {/* 🎬 Video Upload (Premium & Responsive) */}
                        <div
                            className={`relative w-full aspect-[4/5] sm:aspect-square bg-gradient-to-br from-gray-900 to-black rounded-3xl overflow-hidden border-2 border-dashed transition-all duration-300 group flex items-center justify-center ${file ? "border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]" : "border-gray-700 hover:border-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]"}`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                        >
                            {previewUrl ? (
                                <div className="relative w-full h-full flex items-center justify-center bg-black">
                                    <video src={previewUrl} controls className="w-full h-full object-contain" />
                                    <button
                                        onClick={() => { setFile(null); setPreviewUrl(null); }}
                                        className="absolute top-4 right-4 p-2.5 bg-black/60 text-white rounded-full hover:bg-red-500 transition-all backdrop-blur-md border border-white/10 shadow-lg"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center space-y-6 p-8 relative z-10">
                                    {/* Animated Icon Background */}
                                    <div className="relative w-24 h-24 mx-auto group-hover:scale-110 transition-transform duration-500">
                                        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
                                        <div className="relative w-full h-full bg-gray-800/80 backdrop-blur-sm rounded-full flex items-center justify-center border border-gray-700 group-hover:border-blue-500/50 transition-colors">
                                            <Upload size={40} className="text-gray-400 group-hover:text-blue-400 transition-colors" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-bold text-white tracking-tight">Upload Video</h3>
                                        <p className="text-gray-400 text-sm max-w-[200px] mx-auto leading-relaxed">
                                            Drag & drop your video here or browse files
                                        </p>
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800/50 border border-gray-700 text-xs text-gray-400 mt-2">
                                            <Clock size={12} />
                                            <span>Max 60 seconds</span>
                                        </div>
                                    </div>

                                    <label className="relative inline-flex group/btn cursor-pointer">
                                        <div className="absolute transition-all duration-200 rounded-full -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-70 blur-lg group-hover/btn:opacity-100 group-hover/btn:blur group-hover/btn:-inset-1.5"></div>
                                        <div className="relative inline-flex items-center justify-center px-8 py-3.5 text-sm font-bold text-white transition-all duration-200 bg-gray-900 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600">
                                            Browse Files
                                        </div>
                                        <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* 🖼️ Thumbnail Upload */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Custom Thumbnail</h3>

                            {thumbnailPreview ? (
                                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group">
                                    <img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            onClick={() => { setThumbnail(null); setThumbnailPreview(null); }}
                                            className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                                        >
                                            Remove Thumbnail
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload size={24} className="text-gray-400 mb-2" />
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Upload Thumbnail</p>
                                    </div>
                                    <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                                </label>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
