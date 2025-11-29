// ============================================================
// 📝 PostComposer.jsx — Create & Schedule Posts
// ============================================================

import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Upload, X, Calendar, Clock, Send, AlertCircle, CheckCircle2, Plus, Trash2, Image as ImageIcon, Video as VideoIcon, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import apiUtils from "../utils/apiUtils";
import { useAuth } from "../hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
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
    const [isLoadingVideo, setIsLoadingVideo] = useState(false); // ⏳ Loading state for TikTok

    // 🎠 Carousel State
    const [postType, setPostType] = useState("single"); // 'single' | 'carousel'
    const [carouselCards, setCarouselCards] = useState([
        { id: 1, type: "image", file: null, previewUrl: null, headline: "", description: "", cta: "LEARN_MORE", link: "" },
        { id: 2, type: "image", file: null, previewUrl: null, headline: "", description: "", cta: "LEARN_MORE", link: "" }
    ]);

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

        // 🚨 File Size Check (100MB Limit)
        const maxSizeInBytes = 100 * 1024 * 1024; // 100MB
        if (selectedFile.size > maxSizeInBytes) {
            toast.error("File is too large. Maximum size is 100MB.");
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
            setTiktokUrl(""); // Clear TikTok URL if file uploaded
            toast.success("Video uploaded successfully!");
        };
        video.src = URL.createObjectURL(selectedFile);
    };

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

    // 🎵 Handle TikTok Load
    const handleLoadTiktok = async () => {
        if (!tiktokUrl) return;
        setIsLoadingVideo(true);
        const toastId = toast.loading("Loading TikTok video...");

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "")}/api/tiktok/process`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ url: tiktokUrl })
            });

            const data = await response.json();

            if (data.success) {
                setPreviewUrl(data.url); // Use Cloudinary URL for preview
                setFile(null); // Clear local file if any
                toast.success("Video loaded successfully!", { id: toastId });
            } else {
                throw new Error(data.error || "Failed to load video");
            }
        } catch (err) {
            console.error("TikTok load error:", err);
            toast.error(err.message || "Failed to load TikTok video", { id: toastId });
        } finally {
            setIsLoadingVideo(false);
        }
    };

    // 🎠 Carousel Handlers
    const addCard = () => {
        if (carouselCards.length >= 10) return toast.error("Maximum 10 cards allowed.");
        setCarouselCards([...carouselCards, {
            id: Date.now(),
            type: "image",
            file: null,
            previewUrl: null,
            headline: "",
            description: "",
            cta: "LEARN_MORE",
            link: ""
        }]);
    };

    const removeCard = (id) => {
        if (carouselCards.length <= 2) return toast.error("Carousel must have at least 2 cards.");
        setCarouselCards(carouselCards.filter(c => c.id !== id));
    };

    const updateCard = (id, field, value) => {
        setCarouselCards(cards => cards.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleCardMediaChange = (id, file) => {
        if (!file) return;
        const url = URL.createObjectURL(file);
        setCarouselCards(cards => cards.map(c => c.id === id ? { ...c, file, previewUrl: url, type: file.type.startsWith('video/') ? 'video' : 'image' } : c));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (selectedPages.length === 0) {
            toast.error("Please select at least one page.");
            return;
        }

        // Validation for Single Post
        if (postType === 'single') {
            const effectiveTiktokUrl = !file && previewUrl && previewUrl.startsWith("http") ? previewUrl : tiktokUrl;
            if (!file && !effectiveTiktokUrl && !caption) {
                toast.error("Please add a video, caption, or TikTok URL.");
                return;
            }
        }

        setIsSubmitting(true);
        const toastId = toast.loading(isScheduling ? "Scheduling post..." : "Publishing post...");

        try {
            const formData = new FormData();
            formData.append("caption", caption);
            formData.append("accounts", JSON.stringify(selectedPages));
            formData.append("postType", postType);

            if (isScheduling && scheduleTime) {
                formData.append("scheduleTime", scheduleTime);
            }

            if (postType === 'carousel') {
                if (carouselCards.length < 2) throw new Error("Carousel must have at least 2 cards.");

                // Append cards metadata
                formData.append("carouselCards", JSON.stringify(carouselCards.map(c => ({
                    id: c.id,
                    type: c.type,
                    headline: c.headline,
                    description: c.description,
                    cta: c.cta,
                    link: c.link
                }))));

                // Append files
                carouselCards.forEach((card) => {
                    if (card.file) {
                        formData.append(`file_${card.id}`, card.file);
                    }
                });
            } else {
                // Single Post Logic
                if (file) formData.append("video", file);
                if (thumbnail) formData.append("thumbnail", thumbnail);

                // Handle Direct Media URL (from TikTok load) vs Raw TikTok URL
                const effectiveTiktokUrl = !file && previewUrl && previewUrl.startsWith("http") ? previewUrl : tiktokUrl;
                if (!file && previewUrl && previewUrl.startsWith("http")) {
                    formData.append("directMediaUrl", previewUrl);
                } else if (tiktokUrl) {
                    formData.append("tiktokUrl", tiktokUrl);
                }
            }

            // ✅ Unified endpoint for both immediate and scheduled posts
            const endpoint = "/api/posts/create";
            const token = localStorage.getItem("token");
            const response = await fetch(`${(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "")}${endpoint}`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData,
                credentials: "include" // ✅ CRITICAL: Send cookies with request
            });

            const data = await response.json();

            if (data.success) {
                toast.success(isScheduling ? "Post scheduled successfully!" : "Post published successfully!", { id: toastId });
                // Reset State
                setFile(null);
                setPreviewUrl(null);
                setThumbnail(null);
                setThumbnailPreview(null);
                setCaption("");
                setTiktokUrl("");
                setScheduleTime("");
                setIsScheduling(false);
                // Reset Carousel
                setCarouselCards([
                    { id: 1, type: "image", file: null, previewUrl: null, headline: "", description: "", cta: "LEARN_MORE", link: "" },
                    { id: 2, type: "image", file: null, previewUrl: null, headline: "", description: "", cta: "LEARN_MORE", link: "" }
                ]);
            } else {
                throw new Error(data.error || "Failed to create post.");
            }
        } catch (err) {
            apiUtils.logError("PostComposer.handleSubmit", err);
            apiUtils.handleApiError(err, toastId);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Create Post</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Share your content across multiple pages instantly.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* 👈 Left Column: Inputs (Span 7) */}
                    <div className="lg:col-span-7 space-y-6">

                        {/* 📄 Page Selection */}
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400">
                                        <CheckCircle2 size={18} />
                                    </div>
                                    Select Pages
                                </h3>
                                <Link to="/settings" className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline">
                                    Manage Pages
                                </Link>
                            </div>

                            {availablePages.length === 0 ? (
                                <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                    <AlertCircle className="mx-auto text-gray-400 mb-3" size={32} />
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">No active pages found.</p>
                                    <Link to="/settings" className="text-sm text-blue-600 font-bold hover:underline mt-2 block">
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
                                            className={`cursor-pointer flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 ${selectedPages.includes(page.id)
                                                ? "bg-blue-50/50 dark:bg-blue-900/20 border-blue-500 shadow-sm ring-1 ring-blue-500"
                                                : "bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-white dark:hover:bg-gray-800"
                                                }`}
                                        >
                                            <div className="relative">
                                                <img
                                                    src={page.picture || "https://via.placeholder.com/40"}
                                                    alt={page.name}
                                                    className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm"
                                                />
                                                {selectedPages.includes(page.id) && (
                                                    <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-0.5 rounded-full border-2 border-white dark:border-gray-800">
                                                        <CheckCircle2 size={12} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold truncate ${selectedPages.includes(page.id) ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>
                                                    {page.name}
                                                </p>
                                                <p className="text-xs text-gray-400 truncate font-mono">ID: {page.id}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 📝 Caption Input */}
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <label className="block text-sm font-bold text-gray-900 dark:text-white mb-3">
                                Caption
                            </label>
                            <textarea
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="What's on your mind?"
                                rows={5}
                                className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-gray-900 dark:text-white placeholder-gray-400"
                            />
                        </div>

                        {/* 📅 Scheduling Toggle */}
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${isScheduling ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"}`}>
                                        <Calendar size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white">Schedule Post</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Publish at a later time</p>
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
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                        <input
                                            type="datetime-local"
                                            value={scheduleTime}
                                            onChange={(e) => setScheduleTime(e.target.value)}
                                            className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Action Button (Mobile Only - Bottom) */}
                        <div className="lg:hidden">
                            <Button
                                onClick={handleSubmit}
                                disabled={(!file && !previewUrl && !tiktokUrl && !caption) || selectedPages.length === 0}
                                isLoading={isSubmitting}
                                fullWidth
                                size="large"
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02] shadow-lg rounded-2xl py-4"
                            >
                                {isScheduling ? <><Calendar size={20} /> Schedule Post</> : <><Send size={20} /> Post Now</>}
                            </Button>
                        </div>
                    </div>

                    {/* 👉 Right Column: Media (Span 5) - Sticky */}
                    <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-8">

                        {/* 🎛️ Post Type Toggle (Moved to Right) */}
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-2 shadow-sm border border-gray-100 dark:border-gray-700 flex">
                            <button
                                onClick={() => setPostType("single")}
                                className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${postType === "single" ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                            >
                                <ImageIcon size={18} /> Single Post
                            </button>
                            <button
                                onClick={() => setPostType("carousel")}
                                className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${postType === "carousel" ? "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 shadow-sm" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                            >
                                <Layers size={18} /> Carousel
                            </button>
                        </div>

                        {postType === 'carousel' ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-gray-900 dark:text-white">Carousel Cards</h3>
                                    <button onClick={addCard} className="text-sm text-blue-600 font-bold hover:underline flex items-center gap-1">
                                        <Plus size={16} /> Add Card
                                    </button>
                                </div>

                                <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
                                    {carouselCards.map((card, index) => (
                                        <div key={card.id} className="bg-white dark:bg-gray-800 rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 relative group">
                                            <div className="absolute top-4 right-4 z-10">
                                                <button onClick={() => removeCard(card.id)} className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-red-500 rounded-full transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            <div className="flex gap-4 items-start">
                                                {/* Media Upload */}
                                                <div className="w-24 h-24 flex-shrink-0">
                                                    <label className="w-full h-full block cursor-pointer relative group/upload">
                                                        {card.previewUrl ? (
                                                            card.type === 'video' ? (
                                                                <video src={card.previewUrl} className="w-full h-full object-cover rounded-xl border border-gray-200 dark:border-gray-700" />
                                                            ) : (
                                                                <img src={card.previewUrl} alt="Preview" className="w-full h-full object-cover rounded-xl border border-gray-200 dark:border-gray-700" />
                                                            )
                                                        ) : (
                                                            <div className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center hover:border-blue-500 transition-colors">
                                                                <Upload size={20} className="text-gray-400" />
                                                            </div>
                                                        )}
                                                        <input
                                                            type="file"
                                                            accept="image/*,video/*"
                                                            className="hidden"
                                                            onChange={(e) => handleCardMediaChange(card.id, e.target.files[0])}
                                                        />
                                                    </label>
                                                </div>

                                                {/* Inputs */}
                                                <div className="flex-1 space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-gray-100 dark:bg-gray-700 text-gray-500 text-xs font-bold px-2 py-1 rounded-lg">#{index + 1}</span>
                                                        <input
                                                            type="text"
                                                            placeholder="Headline"
                                                            value={card.headline}
                                                            onChange={(e) => updateCard(card.id, 'headline', e.target.value)}
                                                            className="flex-1 bg-transparent border-none p-0 text-sm font-bold text-gray-900 dark:text-white placeholder-gray-400 focus:ring-0"
                                                        />
                                                    </div>
                                                    <textarea
                                                        placeholder="Description..."
                                                        rows={2}
                                                        value={card.description}
                                                        onChange={(e) => updateCard(card.id, 'description', e.target.value)}
                                                        className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl p-2 text-xs text-gray-600 dark:text-gray-300 resize-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                    <select
                                                        value={card.cta}
                                                        onChange={(e) => updateCard(card.id, 'cta', e.target.value)}
                                                        className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl p-2 text-xs font-bold text-blue-600 focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value="LEARN_MORE">Learn More</option>
                                                        <option value="SHOP_NOW">Shop Now</option>
                                                        <option value="SIGN_UP">Sign Up</option>
                                                        <option value="BOOK_NOW">Book Now</option>
                                                        <option value="CONTACT_US">Contact Us</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* 🎬 Video Upload (Premium) */}
                                <div className="bg-white dark:bg-gray-800 rounded-3xl p-2 shadow-sm border border-gray-100 dark:border-gray-700">
                                    <div
                                        className={`relative w-full aspect-square bg-gradient-to-br from-gray-900 to-black rounded-3xl overflow-hidden border-2 border-dashed transition-all duration-300 group flex items-center justify-center ${file ? "border-blue-500 shadow-lg" : "border-gray-700 hover:border-blue-500"}`}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={handleDrop}
                                    >
                                        {previewUrl ? (
                                            <div className="relative w-full h-full flex items-center justify-center bg-black">
                                                <video src={previewUrl} controls className="w-full h-full object-contain" />
                                                <button
                                                    onClick={() => { setFile(null); setPreviewUrl(null); }}
                                                    className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-red-500 transition-all backdrop-blur-md border border-white/10"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center space-y-4 p-8 relative z-10">
                                                <div className="relative w-20 h-20 mx-auto group-hover:scale-110 transition-transform duration-500">
                                                    <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
                                                    <div className="relative w-full h-full bg-gray-800/80 backdrop-blur-sm rounded-full flex items-center justify-center border border-gray-700 group-hover:border-blue-500/50 transition-colors">
                                                        <Upload size={32} className="text-gray-400 group-hover:text-blue-400 transition-colors" />
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <h3 className="text-xl font-bold text-white">Upload Video</h3>
                                                    <p className="text-gray-400 text-xs">Drag & drop or browse</p>
                                                </div>

                                                <label className="relative inline-flex group/btn cursor-pointer">
                                                    <div className="absolute transition-all duration-200 rounded-full -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-70 blur-lg group-hover/btn:opacity-100 group-hover/btn:blur group-hover/btn:-inset-1.5"></div>
                                                    <div className="relative inline-flex items-center justify-center px-6 py-2.5 text-sm font-bold text-white transition-all duration-200 bg-gray-900 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600">
                                                        Browse Files
                                                    </div>
                                                    <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 🎵 TikTok URL Input */}
                                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                                    <label className="block text-sm font-bold text-gray-900 dark:text-white mb-3">
                                        Import from TikTok
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                value={tiktokUrl}
                                                onChange={(e) => setTiktokUrl(e.target.value)}
                                                placeholder="Paste TikTok URL..."
                                                className="w-full pl-4 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleLoadTiktok}
                                            disabled={!tiktokUrl || isLoadingVideo}
                                            isLoading={isLoadingVideo}
                                            className="bg-pink-500 hover:bg-pink-600 text-white rounded-xl px-6"
                                        >
                                            Load
                                        </Button>
                                    </div>
                                </div>

                                {/* 🖼️ Thumbnail Upload */}
                                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Custom Thumbnail</h3>
                                    {thumbnailPreview ? (
                                        <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 group">
                                            <img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button
                                                    onClick={() => { setThumbnail(null); setThumbnailPreview(null); }}
                                                    className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                            <div className="flex flex-col items-center justify-center">
                                                <Upload size={20} className="text-gray-400 mb-1" />
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Upload Image</p>
                                            </div>
                                            <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                                        </label>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Action Button (Desktop Only) - Shared for both modes */}
                        <div className="hidden lg:block pt-4">
                            <Button
                                onClick={handleSubmit}
                                disabled={(!file && !previewUrl && !tiktokUrl && !caption && postType === 'single') || (postType === 'carousel' && carouselCards.length < 2) || selectedPages.length === 0}
                                isLoading={isSubmitting}
                                fullWidth
                                size="large"
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02] shadow-lg shadow-blue-500/25 rounded-2xl py-4 text-lg font-bold"
                            >
                                {isScheduling ? <><Calendar size={22} /> Schedule Post</> : <><Send size={22} /> Post Now</>}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
