// ============================================================
// 📝 Post.jsx — Premium UX/UI Edition (Unified)
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Upload, Link as LinkIcon, Image as ImageIcon, Lock, X, Cloud, Check, AlertCircle, Calendar, Clock, Layers, Video, Plus, Trash2 } from "lucide-react";
import apiUtils from "../utils/apiUtils";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import { useDropzone } from "react-dropzone";

// 🛠️ Helper for clean API URLs
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "");

export default function Post() {
    useAuth();

    // 🟢 State
    const [postFormat, setPostFormat] = useState("single"); // 'single' | 'carousel'

    // Video State
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [tiktokUrl, setTiktokUrl] = useState("");

    // Image State (Carousel Only)
    const [imageFiles, setImageFiles] = useState([]);

    // Metadata State
    const [thumbnail, setThumbnail] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const [headline, setHeadline] = useState("");
    const [caption, setCaption] = useState("");
    const [selectedPages, setSelectedPages] = useState([]);
    const [availablePages, setAvailablePages] = useState([]);
    const [scheduleTime, setScheduleTime] = useState("");

    // 🟡 UI State
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

    // 🖱️ Drag & Drop Handlers (Video)
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

    // 📂 File Validation (Video)
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) validateAndSetVideo(selectedFile);
    };

    const validateAndSetVideo = (selectedFile) => {
        if (!selectedFile.type.startsWith("video/")) return toast.error("Please upload a video file (MP4, MOV).");
        if (selectedFile.size > 500 * 1024 * 1024) return toast.error("File is too large. Maximum size is 500MB.");

        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            if (video.duration > 60) return toast.error("Video too long. Max 60 seconds.");

            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setTiktokUrl(""); // Clear URL if file is dropped
            toast.success("Video uploaded!");
        };
        video.src = URL.createObjectURL(selectedFile);
    };

    // 🖼️ Image Dropzone (Carousel)
    const onDropImages = (acceptedFiles) => {
        const newImages = acceptedFiles.map(file => Object.assign(file, { preview: URL.createObjectURL(file) }));
        setImageFiles(prev => [...prev, ...newImages]);
        toast.success(`${newImages.length} image(s) added!`);
    };

    const { getRootProps: getImageRootProps, getInputProps: getImageInputProps, isDragActive: isImageDragActive } = useDropzone({
        onDrop: onDropImages,
        accept: { "image/*": [] },
        multiple: true,
    });

    const removeImage = (index) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
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
            const headers = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const response = await fetch(`${API_BASE}/api/posts/tiktok/fetch`, {
                method: "POST",
                headers,
                credentials: "include",
                body: JSON.stringify({ url: tiktokUrl })
            });
            const data = await response.json();
            if (data.success) {
                setPreviewUrl(data.video.url); // Cloudinary URL
                setFile(null); // Clear file if URL is loaded
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
        if (!file && !previewUrl && !tiktokUrl) return toast.error("Please add a video.");

        // Carousel Validation
        if (postFormat === 'carousel' && imageFiles.length === 0) {
            return toast.error("Please add at least one image for the carousel.");
        }

        setIsSubmitting(true);
        const toastId = toast.loading(postFormat === 'carousel' ? "Creating carousel..." : "Creating post...");

        try {
            const formData = new FormData();
            formData.append("caption", caption);
            formData.append("accounts", JSON.stringify(selectedPages));

            // Common Fields
            if (file) {
                formData.append("video", file);
            } else if (previewUrl && previewUrl.startsWith("http")) {
                formData.append("videoUrl", previewUrl);
            }
            if (scheduleTime) formData.append("scheduleTime", scheduleTime);

            let endpoint = `${API_BASE}/api/posts`;

            if (postFormat === 'carousel') {
                // 🎠 Mixed Carousel Payload
                endpoint = `${API_BASE}/api/posts/mixed-carousel`;
                imageFiles.forEach(file => {
                    formData.append("images", file);
                });
            } else {
                // 🎥 Single Post Payload
                formData.append("title", headline);
                formData.append("postType", "single");
                formData.append("cta", "LIKE_PAGE");
                if (thumbnail) formData.append("thumbnail", thumbnail);
            }

            const token = localStorage.getItem("token");
            const headers = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const response = await fetch(endpoint, {
                method: "POST",
                headers,
                credentials: "include",
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
                setHeadline("");
                setCaption("");
                setScheduleTime("");
                setImageFiles([]);
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
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create New Post</h1>
                    <p className="text-gray-400 dark:text-gray-500 mt-1">Craft your campaign content.</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden">

                    {/* 0. Post Format Switcher */}
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                        <div className="flex justify-center">
                            <div className="bg-gray-200 dark:bg-gray-700 p-1 rounded-xl inline-flex">
                                <button
                                    onClick={() => setPostFormat('single')}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all duration-200 ${postFormat === 'single' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                >
                                    <Video size={18} /> Single Video
                                </button>
                                <button
                                    onClick={() => setPostFormat('carousel')}
                                    className={`px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all duration-200 ${postFormat === 'carousel' ? 'bg-white dark:bg-gray-800 text-pink-500 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                >
                                    <Layers size={18} /> Mixed Carousel
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-8">

                        <div className={`grid grid-cols-1 ${postFormat === 'carousel' ? 'lg:grid-cols-2' : ''} gap-8`}>

                            {/* 1. Video Section (Unified) */}
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    <Video className="text-blue-500" size={20} /> Video Source
                                </h3>

                                {/* Unified Dropzone & URL Input */}
                                <div className="transition-all duration-300 ease-in-out">
                                    <div
                                        onDragOver={handleDragEnter}
                                        onDragEnter={handleDragEnter}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={`
                                            relative border-2 border-dashed rounded-3xl p-6 text-center transition-all duration-300 group
                                            ${isDragging
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.01] shadow-lg'
                                                : (file || previewUrl)
                                                    ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10'
                                                    : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                            }
                                        `}
                                    >
                                        {/* Hidden File Input */}
                                        <input
                                            type="file"
                                            accept="video/*"
                                            onChange={handleFileChange}
                                            className="hidden"
                                            ref={fileInputRef}
                                        />

                                        {/* Preview Area */}
                                        {(file || previewUrl) ? (
                                            <div className="relative w-full aspect-square max-h-[300px] bg-black rounded-2xl overflow-hidden shadow-inner mx-auto">
                                                <video
                                                    src={previewUrl}
                                                    controls
                                                    className="w-full h-full object-contain"
                                                    preload="metadata"
                                                    poster={previewUrl && previewUrl.includes('cloudinary.com') ? previewUrl.replace('/upload/', '/upload/so_0,w_400,h_400,c_fill,q_auto,f_auto/').replace(/\.[^/.]+$/, ".jpg") : undefined}
                                                />
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFile(null);
                                                        setPreviewUrl(null);
                                                        setTiktokUrl("");
                                                    }}
                                                    className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-red-500 hover:scale-110 transition-all backdrop-blur-md border border-white/10"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        ) : (
                                            /* Empty State: Upload + URL Input */
                                            <div className="py-4 space-y-6">
                                                {/* Drag & Drop Trigger */}
                                                <div
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="cursor-pointer"
                                                >
                                                    <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-all duration-300 ${isDragging ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:scale-110 group-hover:text-blue-500'}`}>
                                                        <Upload size={28} />
                                                    </div>
                                                    <p className="font-bold text-gray-900 dark:text-white text-lg mb-1">
                                                        {isDragging ? "Drop video here!" : "Drag & Drop Video"}
                                                    </p>
                                                    <p className="text-gray-500 dark:text-gray-400 text-xs">or click to browse from device</p>
                                                </div>

                                                <div className="flex items-center gap-4 px-8">
                                                    <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                                                    <span className="text-xs font-bold text-gray-400 uppercase">OR</span>
                                                    <div className="h-px bg-gray-200 dark:bg-gray-700 flex-1"></div>
                                                </div>

                                                {/* TikTok URL Input */}
                                                <div className="flex gap-2 items-center max-w-md mx-auto">
                                                    <div className="relative flex-1 group/input text-left">
                                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-pink-500 transition-colors">
                                                            <LinkIcon size={16} />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={tiktokUrl}
                                                            onChange={(e) => setTiktokUrl(e.target.value)}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') handleLoadTiktok(); }}
                                                            placeholder="Paste TikTok URL..."
                                                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none text-sm font-medium transition-all"
                                                        />
                                                    </div>
                                                    <Button
                                                        onClick={handleLoadTiktok}
                                                        disabled={!tiktokUrl || isLoadingVideo}
                                                        isLoading={isLoadingVideo}
                                                        className="bg-pink-500 hover:bg-pink-600 text-white rounded-xl px-4 py-2.5 font-bold text-sm shadow-lg shadow-pink-500/20"
                                                    >
                                                        Load
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 2. Image Gallery (Carousel Only) */}
                            {postFormat === 'carousel' && (
                                <div className="space-y-6 animate-in slide-in-from-right duration-300">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                            <ImageIcon className="text-pink-500" size={20} /> Image Gallery
                                        </h3>
                                        <span className="px-3 py-1 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 text-xs font-semibold rounded-full border border-pink-100 dark:border-pink-800">
                                            {imageFiles.length} Images
                                        </span>
                                    </div>

                                    <div {...getImageRootProps()} className={`min-h-[150px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all mb-4
                                        ${isImageDragActive ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/10' : 'border-gray-300 dark:border-gray-700 hover:border-pink-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                                        <input {...getImageInputProps()} />
                                        <div className="text-center p-4">
                                            <Plus className="w-8 h-8 text-pink-400 mx-auto mb-2" />
                                            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Add Images</p>
                                            <p className="text-xs text-gray-400">JPG, PNG</p>
                                        </div>
                                    </div>

                                    {/* Horizontal Scroll Gallery */}
                                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar snap-x">
                                        {imageFiles.map((file, index) => (
                                            <div key={index} className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden shadow-md group/img snap-center">
                                                <img src={file.preview} alt={`Upload ${index}`} className="w-full h-full object-cover" />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                                                    className="absolute top-1 right-1 p-1 bg-red-500/80 text-white rounded-full hover:bg-red-600 opacity-0 group-hover/img:opacity-100 transition-all"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. Headline & Caption */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Left Column: Inputs */}
                            <div className="md:col-span-2 space-y-6">
                                {postFormat === 'single' && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Video Title (Headline)</label>
                                        <input
                                            type="text"
                                            value={headline}
                                            onChange={(e) => setHeadline(e.target.value)}
                                            placeholder="Enter a bold headline..."
                                            className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all"
                                        />
                                    </div>
                                )}

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

                                {postFormat === 'single' && (
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
                                )}
                            </div>

                            {/* Right Column: Thumbnail (Single Only) */}
                            {postFormat === 'single' && (
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Cover Image</label>
                                    <label className="block w-full aspect-[3/4] md:aspect-square relative group cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-150">
                                        {thumbnailPreview ? (
                                            <>
                                                <img
                                                    src={thumbnailPreview}
                                                    alt="Thumbnail"
                                                    loading="lazy"
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-150 flex flex-col items-center justify-center text-white">
                                                    <ImageIcon size={24} className="mb-2" />
                                                    <span className="text-sm font-bold">Change Cover</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 group-hover:text-blue-500 transition-colors duration-150">
                                                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full mb-3 group-hover:scale-105 transition-transform duration-150">
                                                    <ImageIcon size={24} />
                                                </div>
                                                <span className="text-sm font-bold">Upload</span>
                                                <span className="text-xs opacity-70">JPG, PNG</span>
                                            </div>
                                        )}
                                        <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* 4. Page Selection */}
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
                    <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-end gap-4">
                        <Button
                            variant="secondary"
                            onClick={() => window.location.reload()}
                            className="w-full sm:w-auto text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors duration-200"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={(!file && !previewUrl) || selectedPages.length === 0}
                            isLoading={isSubmitting}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 rounded-xl shadow-lg shadow-blue-600/20 font-bold text-base transform hover:-translate-y-0.5 transition-all duration-200"
                        >
                            {isSubmitting ? 'Processing...' : (scheduleTime ? 'Schedule Post' : 'Post Now')}
                        </Button>
                    </div>
                </div >
            </div >
        </DashboardLayout >
    );
}
