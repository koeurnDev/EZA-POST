// ============================================================
// 📝 Post.jsx — Premium UX/UI Edition
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Upload, Link as LinkIcon, Image as ImageIcon, Lock, X, Cloud, Check, AlertCircle, Calendar, Clock } from "lucide-react";
import apiUtils from "../utils/apiUtils";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";

// 🛠️ Helper for clean API URLs
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "");

export default function Post() {
    useAuth();

    // 🟢 State
    const [postType, setPostType] = useState("upload"); // 'upload' | 'tiktok'
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [tiktokUrl, setTiktokUrl] = useState("");
    const [thumbnail, setThumbnail] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const [caption, setCaption] = useState("");
    const [selectedPages, setSelectedPages] = useState([]);
    const [availablePages, setAvailablePages] = useState([]);
    const [scheduleTime, setScheduleTime] = useState("");

    // 🟡 UI State (The 10/10 Polish)
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    const fileInputRef = useRef(null);

    // 🔄 Fetch Pages
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

    // 🎛️ Mode Switcher Logic
    const handleModeSwitch = (mode) => {
        if (file && mode === 'tiktok') {
            if (!window.confirm("Switching to TikTok will remove your uploaded video. Continue?")) return;
            setFile(null);
            setPreviewUrl(null);
        }
        setPostType(mode);
    };

    // 🖱️ Drag & Drop Handlers (Visual Polish)
    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const selectedFile = e.dataTransfer.files[0];
        if (selectedFile) validateAndSetVideo(selectedFile);
    };

    // 📂 File Validation
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) validateAndSetVideo(selectedFile);
    };

    const validateAndSetVideo = (selectedFile) => {
        if (!selectedFile.type.startsWith("video/")) return toast.error("Please upload a video file (MP4, MOV).");
        if (selectedFile.size > 100 * 1024 * 1024) return toast.error("File is too large. Maximum size is 100MB.");

        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            if (video.duration > 60) return toast.error("Video too long. Max 60 seconds.");

            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setTiktokUrl("");
            toast.success("Video uploaded!");
        };
        video.src = URL.createObjectURL(selectedFile);
    };

    // 🖼️ Thumbnail Handling
    const handleThumbnailChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (!selectedFile.type.startsWith("image/")) return toast.error("Please upload an image file (JPG, PNG)");
            setThumbnail(selectedFile);
            setThumbnailPreview(URL.createObjectURL(selectedFile));
        }
    };

    // 🎵 TikTok Load
    const handleLoadTiktok = async () => {
        if (!tiktokUrl) return;
        setIsLoadingVideo(true);
        const toastId = toast.loading("Fetching TikTok video...");
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_BASE}/api/tiktok/process`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ url: tiktokUrl })
            });
            const data = await response.json();
            if (data.success) {
                setPreviewUrl(data.url);
                setFile(null);
                toast.success("Video loaded!", { id: toastId });
            } else {
                throw new Error(data.error || "Failed to load video");
            }
        } catch (err) {
            toast.error(err.message, { id: toastId });
        } finally {
            setIsLoadingVideo(false);
        }
    };

    // 🚀 Submit
    const handleSubmit = async () => {
        if (selectedPages.length === 0) return toast.error("Please select a page.");
        if (!file && !previewUrl && !tiktokUrl) return toast.error("Please add media.");

        setIsSubmitting(true);
        const toastId = toast.loading("Creating post...");

        try {
            const formData = new FormData();
            formData.append("caption", caption);
            formData.append("accounts", JSON.stringify(selectedPages));
            formData.append("postType", "single");
            formData.append("cta", "LIKE_PAGE");

            if (postType === 'upload' && file) {
                formData.append("video", file);
            } else if (postType === 'tiktok') {
                if (previewUrl && previewUrl.startsWith("http")) {
                    formData.append("directMediaUrl", previewUrl);
                } else {
                    formData.append("tiktokUrl", tiktokUrl);
                }
            }

            if (thumbnail) formData.append("thumbnail", thumbnail);
            if (scheduleTime) formData.append("scheduleTime", scheduleTime);

            const token = localStorage.getItem("token");
            const response = await fetch(`${API_BASE}/api/posts/create`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                toast.success("Post created successfully!", { id: toastId });
                // Reset Form
                setFile(null);
                setPreviewUrl(null);
                setTiktokUrl("");
                setThumbnail(null);
                setThumbnailPreview(null);
                setCaption("");
                setScheduleTime("");
            } else {
                throw new Error(data.error || "Failed to create post.");
            }
        } catch (err) {
            apiUtils.handleApiError(err, toastId);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Post</h1>
                    <p className="text-gray-400 dark:text-gray-500 mt-1">Craft your campaign content.</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden">

                    {/* 1. Mode Switcher */}
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex bg-gray-100 dark:bg-gray-900/50 p-1 rounded-xl">
                            <button
                                onClick={() => handleModeSwitch('upload')}
                                className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 ${postType === 'upload' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                <Cloud size={18} /> Direct Upload
                            </button>
                            <button
                                onClick={() => handleModeSwitch('tiktok')}
                                className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 ${postType === 'tiktok' ? 'bg-white dark:bg-gray-800 text-pink-500 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                            >
                                <LinkIcon size={18} /> TikTok Link
                            </button>
                        </div>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* 2. Dynamic Media Input */}
                        <div className="transition-all duration-300 ease-in-out">
                            {postType === 'upload' ? (
                                <div
                                    onDragOver={handleDragEnter} // Trigger drag state
                                    onDragEnter={handleDragEnter}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()} // Ensure click works on container
                                    // 10/10 UX: Dynamic styling based on Drag State & File Presence
                                    className={`
                                        relative border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all duration-300 group
                                        ${isDragging
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.01] shadow-lg'
                                            : file
                                                ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10'
                                                : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                        }
                                    `}
                                    // Keyboard Accessibility
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                                >
                                    <input
                                        type="file"
                                        accept="video/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        ref={fileInputRef}
                                    />

                                    {file ? (
                                        <div className="relative w-full aspect-video max-h-[400px] bg-black rounded-2xl overflow-hidden shadow-inner" onClick={(e) => e.stopPropagation()}>
                                            <video src={previewUrl} controls className="w-full h-full object-contain" />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setFile(null); setPreviewUrl(null); }}
                                                className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-red-500 hover:scale-110 transition-all backdrop-blur-md border border-white/10"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="py-8">
                                            <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center transition-all duration-300 ${isDragging ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:scale-110 group-hover:text-blue-500'}`}>
                                                <Upload size={36} />
                                            </div>
                                            <p className="font-bold text-gray-900 dark:text-white text-xl mb-2">
                                                {isDragging ? "Drop it like it's hot! 🔥" : "Drag video here"}
                                            </p>
                                            <p className="text-gray-500 dark:text-gray-400 text-sm">or click to browse from device</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div className="flex gap-3 items-stretch">
                                        <div className="relative flex-1 group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-pink-500 transition-colors">
                                                <LinkIcon size={20} />
                                            </div>
                                            <input
                                                type="text"
                                                value={tiktokUrl}
                                                onChange={(e) => setTiktokUrl(e.target.value)}
                                                placeholder="Paste TikTok URL here..."
                                                className="w-full pl-12 pr-4 h-14 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none font-medium transition-all"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleLoadTiktok}
                                            disabled={!tiktokUrl || isLoadingVideo}
                                            isLoading={isLoadingVideo}
                                            className="bg-pink-500 hover:bg-pink-600 text-white rounded-xl px-8 h-14 font-bold shadow-lg shadow-pink-500/20"
                                        >
                                            Load
                                        </Button>
                                    </div>

                                    {/* TikTok Preview */}
                                    {previewUrl && !file && (
                                        <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-inner group animate-in fade-in zoom-in duration-300">
                                            <video src={previewUrl} controls className="w-full h-full object-contain" />
                                            <button
                                                onClick={() => { setPreviewUrl(null); setTiktokUrl(""); }}
                                                className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-red-500 hover:scale-110 transition-all backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 3. Headline & Preview */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Left Column: Inputs */}
                            <div className="md:col-span-2 space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Caption</label>
                                    <div className="relative">
                                        <textarea
                                            value={caption}
                                            onChange={(e) => setCaption(e.target.value)}
                                            maxLength={2200}
                                            placeholder="Write a catchy caption..."
                                            rows={4}
                                            className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all resize-none"
                                        />
                                        <div className={`absolute bottom-3 right-3 text-xs font-mono font-medium ${caption.length > 2000 ? 'text-red-500' : 'text-gray-400'}`}>
                                            {caption.length}/2200
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex items-center justify-between border border-blue-100 dark:border-blue-900/30">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 rounded-lg">
                                            <Lock size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-blue-900 dark:text-blue-100">Call to Action</p>
                                            <p className="text-xs text-blue-600 dark:text-blue-300">Locked to system setting</p>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                                        Like Page
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Thumbnail */}
                            <div className="md:col-span-1">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Cover Image</label>
                                <label className="block w-full aspect-[3/4] md:aspect-square relative group cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                                    {thumbnailPreview ? (
                                        <>
                                            <img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center text-white">
                                                <ImageIcon size={24} className="mb-2" />
                                                <span className="text-sm font-bold">Change Cover</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors">
                                            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                                <ImageIcon size={24} />
                                            </div>
                                            <span className="text-sm font-bold">Upload</span>
                                            <span className="text-xs opacity-70">JPG, PNG</span>
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                                </label>
                            </div>
                        </div>

                        {/* 4. Page Selection (Refined UI) */}
                        <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    Post to Accounts <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{selectedPages.length} selected</span>
                                </h3>
                                {availablePages.length > 0 && (
                                    <button
                                        onClick={() => setSelectedPages(selectedPages.length === availablePages.length ? [] : availablePages.map(p => p.id))}
                                        className="text-xs text-blue-600 font-bold hover:underline"
                                    >
                                        {selectedPages.length === availablePages.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                )}
                            </div>

                            {availablePages.length === 0 ? (
                                <div className="p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-3 text-sm">
                                    <AlertCircle size={18} />
                                    No pages connected. Please connect a Facebook page in Settings.
                                </div>
                            ) : (
                                <div className="flex gap-3 flex-wrap">
                                    {availablePages.map(page => {
                                        const isSelected = selectedPages.includes(page.id);
                                        return (
                                            <button
                                                key={page.id}
                                                onClick={() => setSelectedPages(prev => isSelected ? prev.filter(id => id !== page.id) : [...prev, page.id])}
                                                className={`
                                                    group flex items-center gap-3 pl-1 pr-4 py-1.5 rounded-full border text-sm font-medium transition-all duration-200 select-none
                                                    ${isSelected
                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20 transform scale-[1.02]'
                                                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:shadow-sm'
                                                    }
                                                `}
                                            >
                                                <div className="relative">
                                                    <img src={page.picture} alt="" className={`w-8 h-8 rounded-full border-2 ${isSelected ? 'border-white/30' : 'border-transparent'}`} />
                                                    {isSelected && (
                                                        <div className="absolute -bottom-1 -right-1 bg-white text-blue-600 rounded-full p-0.5 shadow-sm">
                                                            <Check size={10} strokeWidth={4} />
                                                        </div>
                                                    )}
                                                </div>
                                                {page.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* 5. Scheduling */}
                        <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <Calendar size={18} className="text-purple-500" /> Schedule Post <span className="text-xs font-normal text-gray-400">(Optional)</span>
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className="relative flex-1 max-w-md">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                        <Clock size={18} />
                                    </div>
                                    <input
                                        type="datetime-local"
                                        value={scheduleTime}
                                        onChange={(e) => setScheduleTime(e.target.value)}
                                        min={new Date().toISOString().slice(0, 16)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium transition-all text-gray-700 dark:text-gray-200"
                                    />
                                </div>
                                {scheduleTime && (
                                    <button
                                        onClick={() => setScheduleTime("")}
                                        className="text-sm text-red-500 hover:text-red-600 font-medium hover:underline"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                    </div >

                    {/* Footer Actions */}
                    < div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-4" >
                        <Button
                            variant="secondary"
                            onClick={() => window.location.reload()}
                            className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={(!file && !previewUrl) || selectedPages.length === 0}
                            isLoading={isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-xl shadow-lg shadow-blue-600/20 font-bold text-base transform hover:-translate-y-0.5 transition-all"
                        >
                            {isSubmitting ? 'Processing...' : (scheduleTime ? 'Schedule Post' : 'Post Now')}
                        </Button>
                    </div >
                </div >
            </div >
        </DashboardLayout >
    );
}
