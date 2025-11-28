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
import toast from "react-hot-toast";
import Button from "../components/ui/Button";


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
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) validateAndSetVideo(selectedFile);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const selectedFile = e.dataTransfer.files[0];
        if (selectedFile) validateAndSetVideo(selectedFile);
    };

    const validateAndSetVideo = (selectedFile) => {
        if (!selectedFile.type.startsWith("video/")) {
            toast.error("Please upload a video file (MP4, MOV).");
            return;
        }

        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            if (video.duration > 60) {
                toast.error("Video too long. Maximum allowed length is 60 seconds.");
                return;
            }
            // Valid video
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            toast.success("Video uploaded successfully!");
        };
        video.src = URL.createObjectURL(selectedFile);
    };

    // ...

    const handleThumbnailChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (!selectedFile.type.startsWith("image/")) {
                toast.error("Please upload an image file (JPG, PNG)");
                return;
            }
            setThumbnail(selectedFile);
            setThumbnailPreview(URL.createObjectURL(selectedFile));
            toast.success("Thumbnail uploaded!");
        }
    };

    // ...

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file && !caption && !tiktokUrl) {
            toast.error("Please add a video, caption, or TikTok URL.");
            return;
        }
        if (selectedPages.length === 0) {
            toast.error("Please select at least one page.");
            return;
        }

        setIsSubmitting(true);
        const toastId = toast.loading(isScheduling ? "Scheduling post..." : "Publishing post...");

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
            // ✅ Unified endpoint for both immediate and scheduled posts
            const endpoint = "/api/posts/create";
            const token = localStorage.getItem("token");
            const response = await fetch(`${(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "")}${endpoint}`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                toast.success(isScheduling ? "Post scheduled successfully!" : "Post published successfully!", { id: toastId });
                setFile(null);
                setPreviewUrl(null);
                setThumbnail(null);
                setThumbnailPreview(null);
                setCaption("");
                setTiktokUrl("");
                setScheduleTime("");
                setIsScheduling(false);
            } else {
                toast.error(data.error || "Failed to create post.", { id: toastId });
            }
        } catch (err) {
            console.error("Post creation failed:", err);
            toast.error("Network error. Please try again.", { id: toastId });
        } finally {
            setIsSubmitting(false);
        }
    };

    // ...

    <div className="space-y-6">
        {/* 📄 Page Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="text-blue-500" size={20} />
                    Select Pages
                </h3>
                <Link to="/settings" className="text-xs text-blue-600 hover:underline">
                    Manage Pages
                </Link>
            </div>

            {availablePages.length === 0 ? (
                <div className="text-center py-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                    <AlertCircle className="mx-auto text-gray-400 mb-2" size={24} />
                    <p className="text-sm text-gray-500">No active pages found.</p>
                    <Link to="/settings" className="text-xs text-blue-600 font-medium hover:underline mt-1 block">
                        Connect in Settings
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availablePages.map(page => (
                        <div
                            key={page.id}
                            onClick={() => {
                                setSelectedPages(prev =>
                                    prev.includes(page.id)
                                        ? prev.filter(id => id !== page.id)
                                        : [...prev, page.id]
                                );
                            }}
                            className={`cursor-pointer flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedPages.includes(page.id)
                                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-sm"
                                : "bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700 hover:border-blue-300"
                                }`}
                        >
                            <div className="relative">
                                <img
                                    src={page.picture || "https://via.placeholder.com/40"}
                                    alt={page.name}
                                    className="w-10 h-10 rounded-full object-cover bg-white"
                                />
                                {selectedPages.includes(page.id) && (
                                    <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-0.5 rounded-full border-2 border-white dark:border-gray-800">
                                        <CheckCircle2 size={10} />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold truncate ${selectedPages.includes(page.id) ? "text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>
                                    {page.name}
                                </p>
                                <p className="text-xs text-gray-400 truncate">ID: {page.id}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* 🎵 TikTok URL Input */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                TikTok URL (Optional)
            </label>
            <input
                type="text"
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                placeholder="Paste TikTok video URL here..."
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
        </div>

        {/* 📝 Caption Input */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Caption
            </label>
            <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="What's on your mind?"
                rows={4}
                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
            />
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

        <Button
            onClick={handleSubmit}
            disabled={(!file && !caption && !tiktokUrl) || selectedPages.length === 0}
            isLoading={isSubmitting}
            fullWidth
            size="large"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02] shadow-lg"
        >
            {isScheduling ? <><Calendar size={20} /> Schedule Post</> : <><Send size={20} /> Post Now</>}
        </Button>
    </div >
                    </div >

        {/* 👉 Right Column: Media Upload */ }
        < div className = "space-y-6" >
            {/* 🎬 Video Upload (Premium & Responsive) */ }
            < div
    className = {`relative w-full aspect-[4/5] sm:aspect-square bg-gradient-to-br from-gray-900 to-black rounded-3xl overflow-hidden border-2 border-dashed transition-all duration-300 group flex items-center justify-center ${file ? "border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]" : "border-gray-700 hover:border-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]"}`
}
onDragOver = {(e) => e.preventDefault()}
onDrop = { handleDrop }
    >
{
    previewUrl?(
                                <div className = "relative w-full h-full flex items-center justify-center bg-black" >
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
                        </div >

    {/* 🖼️ Thumbnail Upload */ }
    < div className = "bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700" >
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Custom Thumbnail</h3>

{
    thumbnailPreview ? (
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
    )
}
                        </div >
                    </div >
                </div >
            </div >
        </DashboardLayout >
    );
}
