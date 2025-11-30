// ============================================================
// 📝 Post.jsx — System A Layout (Fixed & Enhanced)
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Upload, Link as LinkIcon, Image as ImageIcon, Lock, X, Cloud, Check, AlertCircle, Calendar, Clock, Layers, Video, Plus, Trash2, GripVertical, ChevronDown } from "lucide-react";
import apiUtils, { fetchCsrfToken } from "../utils/apiUtils";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import { useDropzone } from "react-dropzone";
import { Reorder, motion, AnimatePresence } from "framer-motion";

// 🛠️ Helper for clean API URLs
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/api$/, "");

export default function Post() {
    useAuth();

    // 🟢 State
    const [postFormat, setPostFormat] = useState("carousel"); // 'single' | 'carousel'
    const [videoTab, setVideoTab] = useState("upload"); // 'upload' | 'tiktok'

    // Video State
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [tiktokUrl, setTiktokUrl] = useState("");

    // Image State (Carousel Only)
    const [imageFiles, setImageFiles] = useState([]);

    // 🔄 Unified Media List (for Reordering)
    const [mediaItems, setMediaItems] = useState([]);

    // Metadata State
    const [thumbnail, setThumbnail] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);

    // 🌟 Unified Global Fields
    const [headline, setHeadline] = useState(""); // Unified Headline
    const [targetLink, setTargetLink] = useState(""); // Unified Target URL
    const [cardDescription, setCardDescription] = useState(""); // Unified Description
    const [cta, setCta] = useState("LEARN_MORE"); // Unified CTA

    const [caption, setCaption] = useState("");
    const [selectedPages, setSelectedPages] = useState([]);
    const [availablePages, setAvailablePages] = useState([]);
    const [scheduleTime, setScheduleTime] = useState("");

    // 🟡 UI State
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    const fileInputRef = useRef(null);

    // 🔄 Sync Media Items when Video or Images change
    useEffect(() => {
        if (postFormat !== 'carousel') return;

        // Construct current list based on state
        setMediaItems(prev => {
            const currentVideo = (file || previewUrl) ? {
                id: 'video-main',
                type: 'video',
                preview: previewUrl || (file ? URL.createObjectURL(file) : null),
                file: file,
                url: previewUrl
            } : null;

            // If list is empty, just combine
            if (prev.length === 0) {
                return currentVideo ? [currentVideo] : [];
            }

            // If list exists, we need to merge carefully to keep order
            // 1. Find if video exists in prev
            const prevVideoIndex = prev.findIndex(item => item.type === 'video');
            let newOrder = [...prev];

            // Update or Add Video
            if (currentVideo) {
                if (prevVideoIndex !== -1) {
                    newOrder[prevVideoIndex] = currentVideo; // Update content, keep position
                } else {
                    newOrder.unshift(currentVideo); // Add to start if new
                }
            } else {
                // Remove video if it was deleted
                if (prevVideoIndex !== -1) {
                    newOrder.splice(prevVideoIndex, 1);
                }
            }

            // 🌟 Auto-Add Page Card (Card 3)
            // Condition: Video exists + At least 1 Image exists + Page Selected
            const hasVideo = newOrder.some(i => i.type === 'video');
            const imageCount = newOrder.filter(i => i.type === 'image' && !i.isPageCard).length;
            const selectedPageId = selectedPages[0];

            if (hasVideo && imageCount >= 1 && selectedPageId) {
                const pageObj = availablePages.find(p => p.id === selectedPageId);
                if (pageObj) {
                    // Check if Page Card already exists
                    const pageCardIndex = newOrder.findIndex(i => i.isPageCard);

                    const pageCard = {
                        id: 'card-page-auto',
                        type: 'image',
                        preview: pageObj.picture, // Page Profile Pic
                        file: null, // No file, remote URL
                        imageUrl: pageObj.picture, // Explicit remote URL
                        // Global fields are used in payload, but we can store them here for reference if needed
                        isPageCard: true
                    };

                    if (pageCardIndex !== -1) {
                        // Update existing Page Card (in case Page changed)
                        newOrder[pageCardIndex] = pageCard;
                    } else {
                        // Append Page Card
                        newOrder.push(pageCard);
                    }
                }
            } else {
                // Remove Page Card if conditions not met (e.g. removed all images)
                newOrder = newOrder.filter(i => !i.isPageCard);
            }

            return newOrder;
        });
    }, [file, previewUrl, postFormat, selectedPages, availablePages, imageFiles]);

    // 🔄 Fetch Pages & Load Last Used
    useEffect(() => {
        const fetchPages = async () => {
            try {
                const res = await apiUtils.getUserPages();
                if (res.data.success) {
                    setAvailablePages(res.data.accounts);

                    // 🧠 Load Last Used Page
                    const lastUsedPageId = localStorage.getItem("lastUsedPageId");
                    if (lastUsedPageId) {
                        const found = res.data.accounts.find(p => p.id === lastUsedPageId);
                        if (found) {
                            setSelectedPages([found.id]);
                            // 🌟 Auto-Fill Global Fields
                            setHeadline(found.name);
                            setTargetLink(found.link || `https://facebook.com/${found.id}`);
                        }
                    } else if (res.data.accounts.length > 0) {
                        // 🌟 Default to first page if no history
                        const firstPage = res.data.accounts[0];
                        setSelectedPages([firstPage.id]);
                        // 🌟 Auto-Fill Global Fields
                        setHeadline(firstPage.name);
                        setTargetLink(firstPage.link || `https://facebook.com/${firstPage.id}`);
                    }
                }
            } catch (err) {
                console.error("Failed to load pages:", err);
            }
        };
        fetchPages();
    }, []);

    // 💾 Save Last Used Page & Auto-Fill
    const handlePageSelection = (pageId) => {
        setSelectedPages(prev => {
            const newSelection = [pageId];
            localStorage.setItem("lastUsedPageId", pageId);

            // 🌟 Auto-Fill Global Fields on Selection
            const pageObj = availablePages.find(p => p.id === pageId);
            if (pageObj) {
                setHeadline(pageObj.name);
                setTargetLink(pageObj.link || `https://facebook.com/${pageObj.id}`);
            }

            return newSelection;
        });
    };

    // 📸 Handle Thumbnail Change
    const handleThumbnailChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setThumbnail(selectedFile);
            setThumbnailPreview(URL.createObjectURL(selectedFile));
        }
    };

    // 🖱️ Drag & Drop Handlers (Video)
    const handleDragEnter = (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(true);
    };
    const handleDragLeave = (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    };
    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const selectedFile = e.dataTransfer.files[0];
        if (selectedFile) validateAndSetVideo(selectedFile);
    };

    // 📂 File Validation (Video)
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) validateAndSetVideo(selectedFile);
    };

    const validateAndSetVideo = (selectedFile) => {
        if (!selectedFile.type.startsWith("video/")) return toast.error("Please upload a video file.");
        if (selectedFile.size > 500 * 1024 * 1024) return toast.error("File too large (Max 500MB).");

        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            if (video.duration > 60) return toast.error("Video too long. Max 60s.");

            setFile(selectedFile);
            const url = URL.createObjectURL(selectedFile);
            setPreviewUrl(url);
            setTiktokUrl("");

            // Add to Media Items (Unified List)
            addToMediaList({
                id: `video-${Date.now()}`,
                type: 'video',
                preview: url,
                file: selectedFile
            });

            toast.success("Video added!");
        };
        video.src = URL.createObjectURL(selectedFile);
    };

    // 🖼️ Image Dropzone (Carousel)
    const onDropImages = (acceptedFiles) => {
        // 🛑 Enforce Single Image Limit for 3-Card Logic
        const file = acceptedFiles[0];
        if (!file) return;

        const newItem = {
            id: `image-${Date.now()}-${Math.random()}`,
            type: 'image',
            preview: URL.createObjectURL(file),
            file: file
        };

        // Replace existing images or add new one (Ensure only 1 image + video + page card)
        setMediaItems(prev => {
            // Keep video
            const videoItem = prev.find(i => i.type === 'video');
            // Keep Page Card (it will be re-evaluated by useEffect anyway, but good to be clean)

            const newOrder = [];
            if (videoItem) newOrder.push(videoItem);
            newOrder.push(newItem);

            return newOrder;
        });
        toast.success("Image added!");
    };

    const { getRootProps: getImageRootProps, getInputProps: getImageInputProps, isDragActive: isImageDragActive } = useDropzone({
        onDrop: onDropImages,
        accept: { "image/*": [] },
        multiple: false, // 🛑 Restrict to single file
        maxFiles: 1
    });

    // ➕ Helper to Add/Update Video in List
    const addToMediaList = (videoItem) => {
        setMediaItems(prev => {
            // Remove existing video if any, then add new one to TOP
            const filtered = prev.filter(item => item.type !== 'video');
            return [videoItem, ...filtered];
        });
    };

    // 🗑️ Remove Item
    const removeMediaItem = (id) => {
        setMediaItems(prev => {
            const item = prev.find(i => i.id === id);
            if (item && item.type === 'video') {
                setFile(null);
                setPreviewUrl(null);
                setTiktokUrl("");
            }
            return prev.filter(i => i.id !== id);
        });
    };

    // 🎵 TikTok Load
    const handleLoadTiktok = async () => {
        if (!tiktokUrl) return;
        setIsLoadingVideo(true);
        const toastId = toast.loading("Fetching TikTok...");
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
                const url = data.video.url;
                setPreviewUrl(url);
                setFile(null);

                // Add to Media List
                addToMediaList({
                    id: `video-tiktok-${Date.now()}`,
                    type: 'video',
                    preview: url, // Cloudinary URL
                    file: null,
                    url: url
                });

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

        // Validate Media
        const videoItem = mediaItems.find(i => i.type === 'video');
        const imageItems = mediaItems.filter(i => i.type === 'image');

        if (!videoItem && !file && !previewUrl) return toast.error("Please add a video.");
        if (postFormat === 'carousel' && imageItems.length === 0) {
            return toast.error("Please add at least one image.");
        }

        // Validate Required Fields for Carousel
        if (postFormat === 'carousel') {
            // 🧠 Intelligent Auto-Fill: No longer require these fields from user
            // if (!headline) return toast.error("Headline is required.");
            // if (!targetLink) return toast.error("Target URL is required.");
        }

        setIsSubmitting(true);
        const toastId = toast.loading(postFormat === 'carousel' ? "Creating carousel..." : "Creating post...");

        try {
            const formData = new FormData();
            formData.append("caption", caption);
            formData.append("accounts", JSON.stringify(selectedPages));

            // 🎥 Video Handling
            const activeVideoFile = videoItem?.file || file;
            const activeVideoUrl = videoItem?.url || (previewUrl && !file ? previewUrl : null);

            if (activeVideoFile) {
                formData.append("video", activeVideoFile);
            } else if (activeVideoUrl) {
                formData.append("videoUrl", activeVideoUrl);
            }

            if (scheduleTime) formData.append("scheduleTime", scheduleTime);

            let endpoint = `${API_BASE}/api/posts`;

            if (postFormat === 'carousel') {
                endpoint = `${API_BASE}/api/posts/mixed-carousel`;

                // 🖼️ Images
                imageItems.forEach(item => {
                    formData.append("images", item.file);
                });

                // 🔢 Rich Media Order (Cards Data)
                const cardsPayload = mediaItems.map(item => {
                    const card = {
                        type: item.type,
                        // 🌟 Unified Fields for ALL cards
                        link: targetLink,
                        headline: headline,
                        description: cardDescription,
                        cta: cta
                    };

                    if (item.type === 'image') {
                        const imgIndex = imageItems.findIndex(img => img.id === item.id);
                        card.fileIndex = imgIndex;
                    }

                    // Pass remote URL for Page Card
                    if (item.isPageCard) {
                        card.imageUrl = item.imageUrl;
                    }

                    return card;
                });

                formData.append("carouselCards", JSON.stringify(cardsPayload));

            } else {
                // Single Post
                formData.append("title", headline);
                formData.append("postType", "single");
                formData.append("cta", "LIKE_PAGE");
            }

            const token = localStorage.getItem("token");
            const csrfToken = await fetchCsrfToken();
            const headers = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;
            if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

            const response = await fetch(endpoint, {
                method: "POST",
                headers,
                credentials: "include",
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                toast.success("Post created successfully!", { id: toastId });
                // Reset
                setFile(null); setPreviewUrl(null); setTiktokUrl("");
                setThumbnail(null); setThumbnailPreview(null);
                setHeadline(""); setCardDescription(""); setTargetLink(""); setCaption(""); setScheduleTime("");
                setMediaItems([]);
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
            <div className="max-w-7xl mx-auto px-4 py-6">

                {/* 🔷 TOP SECTION (GLOBAL HEADER) */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 p-6">
                    <div className="flex flex-col md:flex-row gap-6 items-start">

                        {/* A. Post Type & Page Selection */}
                        <div className="w-full md:w-1/3 space-y-4">
                            {/* 1. Post Type Switcher (Moved Here) */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Post Type</label>
                                <div className="flex bg-gray-100 dark:bg-gray-900 rounded-xl p-1 border border-gray-200 dark:border-gray-700">
                                    <button
                                        onClick={() => setPostFormat('carousel')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${postFormat === 'carousel' ? 'bg-white shadow text-pink-500' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        <Layers size={16} /> Carousel
                                    </button>
                                    <button
                                        onClick={() => setPostFormat('single')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${postFormat === 'single' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        <Video size={16} /> Single Video
                                    </button>
                                </div>
                            </div>

                            {/* 2. Page Selection */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Post To</label>
                                <div className="relative">
                                    {availablePages.length > 0 ? (
                                        <div className="relative">
                                            <select
                                                className="w-full appearance-none pl-12 pr-10 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                onChange={(e) => handlePageSelection(e.target.value)}
                                                value={selectedPages[0] || ""}
                                            >
                                                <option value="" disabled>Choose Page...</option>
                                                {availablePages.map(page => (
                                                    <option key={page.id} value={page.id}>{page.name}</option>
                                                ))}
                                            </select>
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                                {selectedPages.length > 0 ? (
                                                    <img src={availablePages.find(p => p.id === selectedPages[0])?.picture} className="w-6 h-6 rounded-full" alt="" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700" />
                                                )}
                                            </div>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                                <ChevronDown size={16} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-red-50 text-red-500 rounded-xl text-sm">No pages connected</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* C. Caption Box */}
                        <div className="w-full md:w-2/3">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Caption</label>
                            <div className="relative h-full">
                                <textarea
                                    value={caption}
                                    onChange={(e) => setCaption(e.target.value)}
                                    maxLength={2200}
                                    placeholder="Write a catchy caption... #hashtags @mentions"
                                    className="w-full h-[132px] p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all resize-none"
                                />
                                <div className={`absolute bottom-3 right-3 text-xs font-mono font-medium ${caption.length > 2000 ? 'text-red-500' : 'text-gray-400'}`}>
                                    {caption.length}/2200
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 🟦 MAIN BODY (SPLIT 50/50) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">

                    {/* 🟦 LEFT: Video Upload + Processing Zone */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/20">
                            <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <Video className="text-blue-500" size={20} /> Video Source
                            </h3>
                        </div>

                        {/* A) Input Method Tabs */}
                        <div className="flex border-b border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => setVideoTab('upload')}
                                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${videoTab === 'upload' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                <Upload size={16} /> Upload Video
                            </button>
                            <button
                                onClick={() => setVideoTab('tiktok')}
                                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${videoTab === 'tiktok' ? 'text-pink-500 border-b-2 border-pink-500 bg-pink-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                <LinkIcon size={16} /> TikTok Link
                            </button>
                        </div>

                        <div className="p-6 flex-1 flex flex-col justify-center">
                            {(file || previewUrl) ? (
                                <div className="relative w-full aspect-square bg-black rounded-2xl overflow-hidden shadow-lg group">
                                    <video
                                        src={previewUrl}
                                        controls
                                        className="w-full h-full object-contain"
                                        preload="metadata"
                                    />
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFile(null); setPreviewUrl(null); setTiktokUrl("");
                                                setMediaItems(prev => prev.filter(i => i.type !== 'video'));
                                            }}
                                            className="p-2 bg-black/60 text-white rounded-full hover:bg-red-500 backdrop-blur-md"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-md">
                                        1:1 Preview
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {videoTab === 'upload' && (
                                        <div
                                            onDragOver={handleDragEnter}
                                            onDragEnter={handleDragEnter}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            className={`
                                                    flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 transition-all
                                                    ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
                                                `}
                                        >
                                            <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
                                            <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer text-center">
                                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Upload size={32} />
                                                </div>
                                                <p className="font-bold text-gray-700">Drag & Drop Video</p>
                                                <p className="text-sm text-gray-400 mt-1">MP4, MOV, WEBM</p>
                                            </div>
                                        </div>
                                    )}

                                    {videoTab === 'tiktok' && (
                                        <div className="flex-1 flex flex-col justify-center items-center p-8 bg-gray-50 rounded-2xl border border-gray-200">
                                            <div className="w-full max-w-md space-y-4">
                                                <div className="text-center mb-6">
                                                    <div className="w-16 h-16 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                        <LinkIcon size={32} />
                                                    </div>
                                                    <h3 className="font-bold text-gray-800">Import from TikTok</h3>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={tiktokUrl}
                                                    onChange={(e) => setTiktokUrl(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleLoadTiktok(); }}
                                                    placeholder="Paste TikTok URL here..."
                                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
                                                />
                                                <Button
                                                    onClick={handleLoadTiktok}
                                                    disabled={!tiktokUrl || isLoadingVideo}
                                                    isLoading={isLoadingVideo}
                                                    className="w-full bg-pink-500 hover:bg-pink-600 text-white py-3 rounded-xl font-bold"
                                                >
                                                    Load Video
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* 🟦 RIGHT: Image Zone / Metadata */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                            <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                {postFormat === 'carousel' ? <Layers className="text-pink-500" size={20} /> : <ImageIcon className="text-purple-500" size={20} />}
                                {postFormat === 'carousel' ? "Carousel Images" : "Post Details"}
                            </h3>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto max-h-[600px]">
                            {postFormat === 'carousel' ? (
                                <div className="space-y-6">
                                    {/* 📝 Unified Card Description & CTA */}
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="p-4 bg-blue-50 text-blue-700 rounded-xl text-sm border border-blue-100">
                                            <p className="font-bold flex items-center gap-2">
                                                <AlertCircle size={16} />
                                                Intelligent Auto-Fill Active
                                            </p>
                                            <p className="mt-1 opacity-90">
                                                We'll automatically set the Headline, Link, and CTA based on the selected Page.
                                                <br />
                                                <strong>Headline:</strong> Page Name
                                                <br />
                                                <strong>Link:</strong> Page URL
                                                <br />
                                                <strong>CTA:</strong> Learn More / Follow
                                            </p>
                                        </div>
                                    </div>

                                    {/* Add Images Dropzone */}
                                    <div {...getImageRootProps()} className={`min-h-[120px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all
                                            ${isImageDragActive ? 'border-pink-500 bg-pink-50' : 'border-gray-300 hover:border-pink-400 hover:bg-gray-50'}`}>
                                        <input {...getImageInputProps()} />
                                        <div className="text-center p-4 flex items-center gap-3">
                                            <Plus className="w-6 h-6 text-pink-400" />
                                            <span className="text-sm text-gray-600 font-medium">Add Image (Max 1)</span>
                                        </div>
                                    </div>

                                    {/* Unified Media List */}
                                    <Reorder.Group axis="y" values={mediaItems} onReorder={setMediaItems} className="space-y-3">
                                        <AnimatePresence>
                                            {mediaItems.map((item) => (
                                                <Reorder.Item key={item.id} value={item}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
                                                >
                                                    <div className="flex items-start gap-4">
                                                        <div className="mt-2 cursor-grab active:cursor-grabbing">
                                                            <GripVertical className="text-gray-400" size={20} />
                                                        </div>

                                                        {/* Media Preview */}
                                                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                                                            {item.type === 'video' ? (
                                                                <video src={item.preview} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <img src={item.preview} alt="" className="w-full h-full object-cover" />
                                                            )}
                                                        </div>

                                                        {/* Fields */}
                                                        <div className="flex-1 space-y-3">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p className="text-sm font-bold text-gray-900 capitalize">{item.type}</p>
                                                                    <p className="text-xs text-gray-500 truncate max-w-[200px]">{item.file ? item.file.name : 'Remote URL'}</p>
                                                                </div>
                                                                <button onClick={() => removeMediaItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                                    <Trash2 size={18} />
                                                                </button>
                                                            </div>

                                                            {/* Inputs Removed - Using Unified Global Inputs */}
                                                            <div className="text-xs text-gray-400 italic">
                                                                Using global settings for Headline, Description, Link, and CTA.
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Reorder.Item>
                                            ))}
                                        </AnimatePresence>
                                    </Reorder.Group>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="p-4 bg-blue-50 text-blue-700 rounded-xl text-sm border border-blue-100">
                                        <p className="font-bold flex items-center gap-2">
                                            <AlertCircle size={16} />
                                            Single Video Post
                                        </p>
                                        <p className="mt-1 opacity-90">
                                            Upload a video or paste a TikTok link. The caption will be used as the post description.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-6 flex flex-col md:flex-row items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm gap-4">

                    {/* Scheduling Toggle */}
                    <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-900 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => { setScheduleTime(""); }}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!scheduleTime ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Instant
                        </button>
                        <button
                            onClick={() => {
                                // Set default time to 1 hour from now if empty
                                if (!scheduleTime) {
                                    const now = new Date();
                                    now.setHours(now.getHours() + 1);
                                    now.setMinutes(0);
                                    setScheduleTime(now.toISOString().slice(0, 16));
                                }
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${scheduleTime ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Schedule
                        </button>
                    </div>

                    {/* Date Picker (Visible only if Scheduled) */}
                    {scheduleTime && (
                        <div className="relative animate-in fade-in slide-in-from-left-4 duration-300">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
                            <input
                                type="datetime-local"
                                value={scheduleTime}
                                onChange={(e) => setScheduleTime(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    )}

                    <Button
                        onClick={handleSubmit}
                        disabled={(!file && !previewUrl) || selectedPages.length === 0}
                        isLoading={isSubmitting}
                        className={`px-8 py-3 rounded-xl font-bold shadow-lg transition-all ${scheduleTime
                            ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'} text-white ml-auto`}
                    >
                        {isSubmitting ? 'Processing...' : (scheduleTime ? 'Schedule Post' : 'Post Now')}
                    </Button>
                </div>

            </div>
        </DashboardLayout>
    );
}
