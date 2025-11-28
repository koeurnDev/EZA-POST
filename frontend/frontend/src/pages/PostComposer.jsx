// ============================================================
// 📝 PostComposer.jsx — Create & Schedule Posts
// ============================================================

import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Upload, X, Calendar, Clock, Send, Film, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import apiUtils from "../utils/apiUtils";
import { useAuth } from "../hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

export default function PostComposer() {
    const { user } = useAuth();
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [thumbnail, setThumbnail] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const [caption, setCaption] = useState("");
    const [selectedPages, setSelectedPages] = useState([]);
    const [availablePages, setAvailablePages] = useState([]);
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduleTime, setScheduleTime] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: '' }

    // Fetch Pages
    useEffect(() => {
        const fetchPages = async () => {
            try {
                const res = await apiUtils.getUserPages();
                if (res.data.success) {
                    // Only show pages that are "selected" in settings
                    const activePages = res.data.accounts.filter(p => p.isSelected);
                    setAvailablePages(activePages);
                    // Select all by default
                    setSelectedPages(activePages.map(p => p.id));
                }
            } catch (err) {
                console.error("Failed to load pages:", err);
            }
        };
        fetchPages();
    }, []);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (!selectedFile.type.startsWith("video/")) {
                setStatus({ type: "error", message: "Please upload a video file (MP4, MOV, etc.)" });
                return;
            }
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setStatus(null);
        }
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

    const handleDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type.startsWith("video/")) {
            setFile(droppedFile);
            setPreviewUrl(URL.createObjectURL(droppedFile));
            setStatus(null);
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
        if (!file && !caption) {
            setStatus({ type: "error", message: "Please add a video or caption." });
            return;
        }
        if (selectedPages.length === 0) {
            setStatus({ type: "error", message: "Please select at least one page." });
            return;
        }

        setIsSubmitting(true);
        setStatus(null);

        const formData = new FormData();
        formData.append("video", file);
        if (thumbnail) {
            formData.append("thumbnail", thumbnail);
        }
        formData.append("caption", caption);
        formData.append("accounts", JSON.stringify(selectedPages));
        if (isScheduling && scheduleTime) {
            formData.append("scheduleTime", scheduleTime);
        }

        try {
            const endpoint = isScheduling ? "/api/posts/schedule" : "/api/posts/create";
            // We need to use axios directly or add a helper in apiUtils that supports FormData
            // Assuming apiUtils has a generic post method or we use axios
            const token = localStorage.getItem("token");
            const response = await fetch(`${(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "")}${endpoint}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                setStatus({
                    type: "success",
                    message: isScheduling
                        ? "Post scheduled successfully!"
                        : "Post published successfully!"
                });
                // Reset form
                setFile(null);
                setPreviewUrl(null);
                setCaption("");
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
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Film className="text-blue-500" />
                        Create Post
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Upload videos, write captions, and publish to your pages.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* 📝 Left Column: Composer */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Video Upload */}
                        <div
                            className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${file ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10" : "border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500"
                                }`}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                        >
                            {previewUrl ? (
                                <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                                    <video src={previewUrl} controls className="max-h-full max-w-full" />
                                    <button
                                        onClick={() => { setFile(null); setPreviewUrl(null); }}
                                        className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto">
                                        <Upload size={32} />
                                    </div>
                                    <div>
                                        <p className="text-lg font-medium text-gray-900 dark:text-white">
                                            Drag & drop video here
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            or click to browse (MP4, MOV)
                                        </p>
                                    </div>
                                    <input
                                        type="file"
                                        accept="video/*"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Thumbnail Upload (Optional) */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Custom Thumbnail (Optional)
                            </label>
                            <div className="flex items-center gap-4">
                                <div className="relative w-24 h-24 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden border border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center group">
                                    {thumbnailPreview ? (
                                        <>
                                            <img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => { setThumbnail(null); setThumbnailPreview(null); }}
                                                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={12} />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="text-gray-400">
                                            <Upload size={20} />
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleThumbnailChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                </div>
                                <div className="text-xs text-gray-500">
                                    <p>Upload a JPG or PNG image.</p>
                                    <p>Recommended size: 1280x720</p>
                                </div>
                            </div>
                        </div>

                        {/* Caption */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Caption
                            </label>
                            <textarea
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="What's on your mind? You can also paste a TikTok URL here..."
                                className="w-full h-32 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all text-gray-900 dark:text-white"
                            />
                            <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                                <span>Markdown supported</span>
                                <span>{caption.length} chars</span>
                            </div>
                        </div>

                        {/* Scheduling Toggle */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isScheduling ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"}`}>
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">Schedule for later</p>
                                    <p className="text-xs text-gray-500">Automatically post at a specific time</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isScheduling}
                                    onChange={(e) => setIsScheduling(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
                            </label>
                        </div>

                        <AnimatePresence>
                            {isScheduling && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Select Date & Time
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={scheduleTime}
                                            onChange={(e) => setScheduleTime(e.target.value)}
                                            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    {/* 📢 Right Column: Publishing Options */}
                    <div className="space-y-6">
                        {/* Page Selection */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <CheckCircle2 size={18} className="text-green-500" />
                                    Select Pages
                                </h3>
                                {availablePages.length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (selectedPages.length === availablePages.length) {
                                                setSelectedPages([]);
                                            } else {
                                                setSelectedPages(availablePages.map(p => p.id));
                                            }
                                        }}
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
                                                <div className="relative">
                                                    <img
                                                        src={page.picture || "https://via.placeholder.com/40"}
                                                        alt={page.name}
                                                        className={`w-10 h-10 rounded-full object-cover border-2 ${isSelected ? "border-blue-500" : "border-white dark:border-gray-700"}`}
                                                    />
                                                    {isSelected && (
                                                        <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 border-2 border-white dark:border-gray-900">
                                                            <CheckCircle2 size={10} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-semibold truncate ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-white"}`}>
                                                        {page.name}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 truncate">Facebook Page</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            {status && (
                                <div className={`p-4 rounded-xl text-sm flex items-start gap-2 ${status.type === 'success'
                                    ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                    : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                    }`}>
                                    {status.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5" /> : <AlertCircle size={16} className="mt-0.5" />}
                                    {status.message}
                                </div>
                            )}

                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || (!file && !caption) || selectedPages.length === 0}
                                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all ${isSubmitting
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transform hover:scale-[1.02]"
                                    }`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Processing...
                                    </>
                                ) : isScheduling ? (
                                    <>
                                        <Calendar size={20} />
                                        Schedule Post
                                    </>
                                ) : (
                                    <>
                                        <Send size={20} />
                                        Post Now
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
