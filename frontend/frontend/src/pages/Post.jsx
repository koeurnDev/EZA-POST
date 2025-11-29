// ============================================================
// 📝 Post.jsx — New Post Creation Interface
// ============================================================

import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Upload, Link as LinkIcon, Image as ImageIcon, Lock, X, Cloud, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import apiUtils from "../utils/apiUtils";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";

export default function Post() {
    useAuth();

    // 🟢 State
    const [postType, setPostType] = useState("upload"); // 'upload' | 'tiktok'
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [tiktokUrl, setTiktokUrl] = useState("");
    const [thumbnail, setThumbnail] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const [headline, setHeadline] = useState("");
    const [selectedPages, setSelectedPages] = useState([]);
    const [availablePages, setAvailablePages] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);

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

    // 📂 File Handling
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
        if (selectedFile.size > 100 * 1024 * 1024) {
            toast.error("File is too large. Maximum size is 100MB.");
            return;
        }

        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            if (video.duration > 60) {
                toast.error("Video too long. Max 60 seconds.");
                return;
            }
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
            if (!selectedFile.type.startsWith("image/")) {
                toast.error("Please upload an image file (JPG, PNG)");
                return;
            }
            setThumbnail(selectedFile);
            setThumbnailPreview(URL.createObjectURL(selectedFile));
        }
    };

    // 🎵 TikTok Load
    const handleLoadTiktok = async () => {
        if (!tiktokUrl) return;
        setIsLoadingVideo(true);
        const toastId = toast.loading("Loading TikTok video...");
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`${(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "")}/api/tiktok/process`, {
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
            formData.append("caption", headline); // Mapping headline to caption
            formData.append("accounts", JSON.stringify(selectedPages));
            formData.append("postType", "single"); // Always single for this new UI? Or should we support carousel? User spec implies single video flow.
            formData.append("cta", "LIKE_PAGE");

            // Handle Media
            if (postType === 'upload' && file) {
                formData.append("video", file);
            } else if (postType === 'tiktok') {
                // Handle Direct Media URL (from TikTok load) vs Raw TikTok URL
                if (previewUrl && previewUrl.startsWith("http")) {
                    formData.append("directMediaUrl", previewUrl);
                } else {
                    formData.append("tiktokUrl", tiktokUrl);
                }
            }

            if (thumbnail) formData.append("thumbnail", thumbnail);

            const endpoint = "/api/posts/create";
            const token = localStorage.getItem("token");
            const response = await fetch(`${(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "")}${endpoint}`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData,
                credentials: "include"
            });

            const data = await response.json();
            if (data.success) {
                toast.success("Post created successfully!", { id: toastId });
                // Reset
                setFile(null);
                setPreviewUrl(null);
                setTiktokUrl("");
                setThumbnail(null);
                setThumbnailPreview(null);
                setHeadline("");
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
                    <p className="text-gray-500 dark:text-gray-400">Craft your campaign content.</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">

                    {/* 1. Mode Switcher */}
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex bg-gray-100 dark:bg-gray-900/50 p-1 rounded-xl">
                            <button
                                onClick={() => handleModeSwitch('upload')}
                                className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${postType === 'upload' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500'}`}
                            >
                                <Cloud size={18} /> Direct Upload
                            </button>
                            <button
                                onClick={() => handleModeSwitch('tiktok')}
                                className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${postType === 'tiktok' ? 'bg-white dark:bg-gray-800 text-pink-500 shadow-sm' : 'text-gray-500'}`}
                            >
                                <LinkIcon size={18} /> TikTok Link
                            </button>
                        </div>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* 2. Dynamic Media Input */}
                        <div>
                            {postType === 'upload' ? (
                                <div
                                    className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all ${file ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-300 dark:border-gray-700 hover:border-blue-500'}`}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={handleDrop}
                                >
                                    {file ? (
                                        <div className="flex flex-col items-center">
                                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                                <CheckCircle2 size={32} />
                                            </div>
                                            <p className="font-bold text-gray-900 dark:text-white">{file.name}</p>
                                            <p className="text-sm text-gray-500 mb-4">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                            <button onClick={() => { setFile(null); setPreviewUrl(null); }} className="text-red-500 text-sm font-bold hover:underline">Remove Video</button>
                                        </div>
                                    ) : (
                                        <label className="cursor-pointer block">
                                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Upload size={32} />
                                            </div>
                                            <p className="font-bold text-gray-900 dark:text-white text-lg">Drag video here</p>
                                            <p className="text-gray-500 text-sm">or click to browse</p>
                                            <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
                                        </label>
                                    )}
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                            <LinkIcon size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            value={tiktokUrl}
                                            onChange={(e) => setTiktokUrl(e.target.value)}
                                            placeholder="Paste TikTok URL here..."
                                            className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none font-medium"
                                        />
                                    </div>
                                    <Button onClick={handleLoadTiktok} disabled={!tiktokUrl || isLoadingVideo} isLoading={isLoadingVideo} className="bg-pink-500 hover:bg-pink-600 text-white rounded-xl px-6">
                                        Load
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* 3. Headline & Preview */}
                        <div className="flex gap-6">
                            {/* Thumbnail Preview */}
                            <div className="w-32 h-32 flex-shrink-0">
                                <label className="block w-full h-full relative group cursor-pointer">
                                    {thumbnailPreview ? (
                                        <>
                                            <img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover rounded-2xl border border-gray-200 dark:border-gray-700" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                                                <span className="text-white text-xs font-bold">Change</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center hover:border-blue-500 transition-colors">
                                            <ImageIcon size={24} className="text-gray-400 mb-1" />
                                            <span className="text-[10px] text-gray-500 font-bold">Cover</span>
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                                </label>
                            </div>

                            {/* Headline Input */}
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">Headline</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={headline}
                                        onChange={(e) => setHeadline(e.target.value)}
                                        maxLength={100}
                                        placeholder="Write a catchy caption..."
                                        className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                    />
                                    <div className="absolute bottom-3 right-3 text-xs text-gray-400 font-mono">
                                        {headline.length}/100
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. Fixed CTA */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex items-center justify-between border border-blue-100 dark:border-blue-900/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 rounded-lg">
                                    <Lock size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-blue-900 dark:text-blue-100">Call to Action</p>
                                    <p className="text-xs text-blue-600 dark:text-blue-300">System setting</p>
                                </div>
                            </div>
                            <div className="px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 text-sm font-bold text-gray-600 dark:text-gray-300">
                                Like Page
                            </div>
                        </div>

                        {/* Page Selection (Simplified for this view, or keep existing?) 
                            User spec didn't explicitly mention page selector in the wireframe, 
                            but it's required for the API. I'll keep a simplified version or assume it's global.
                            I'll add a compact page selector at the top or bottom.
                        */}
                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Post to:</h3>
                            {availablePages.length === 0 ? (
                                <p className="text-sm text-red-500">No pages connected.</p>
                            ) : (
                                <div className="flex gap-2 flex-wrap">
                                    {availablePages.map(page => (
                                        <button
                                            key={page.id}
                                            onClick={() => setSelectedPages(prev => prev.includes(page.id) ? prev.filter(id => id !== page.id) : [...prev, page.id])}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${selectedPages.includes(page.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}
                                        >
                                            <img src={page.picture} alt="" className="w-4 h-4 rounded-full" />
                                            {page.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => window.location.reload()}>Cancel</Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={(!file && !previewUrl) || selectedPages.length === 0}
                            isLoading={isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                        >
                            Create Post
                        </Button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
