// ============================================================
// 📝 Post.jsx — System A Layout (Fixed & Enhanced)
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Upload, Link as LinkIcon, Image as ImageIcon, Lock, X, Cloud, Check, AlertCircle, Calendar, Clock, Layers, Video, Plus, Trash2, GripVertical, ChevronDown, Sparkles } from "lucide-react";
import apiUtils, { fetchCsrfToken } from "../utils/apiUtils";
import { saveDraftFile, getDraftFile, clearDraftFile } from "../utils/draftDB";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import { useDropzone } from "react-dropzone";
import { Reorder, motion, AnimatePresence } from "framer-motion";
import { generateThumbnailFromVideo, dataURLtoFile } from "../utils/videoUtils";

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



    // 🔄 Unified Media List (for Reordering)
    const [mediaItems, setMediaItems] = useState([]);

    // Metadata State
    const [thumbnail, setThumbnail] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const [rightSideImage, setRightSideImage] = useState(null);
    const [rightSideImagePreview, setRightSideImagePreview] = useState(null);

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
    const [isDraftLoaded, setIsDraftLoaded] = useState(false); // 🛑 Prevent save before load
    const fileInputRef = useRef(null);

    // 💾 Draft Persistence Logic
    useEffect(() => {
        const loadDraft = async () => {
            try {
                // 1. Load Text Data
                const savedDraft = localStorage.getItem("postDraft");
                if (savedDraft) {
                    const parsed = JSON.parse(savedDraft);
                    setCaption(parsed.caption || "");
                    setHeadline(parsed.headline || "");
                    setTargetLink(parsed.targetLink || "");
                    setPostFormat(parsed.postFormat || "carousel");
                    if (parsed.selectedPages) setSelectedPages(parsed.selectedPages);

                    // 🌟 Restore Cached Page (Immediate Profile Card)
                    if (parsed.cachedPage) {
                        setAvailablePages(prev => {
                            // Avoid duplicates if already loaded
                            if (prev.some(p => p.id === parsed.cachedPage.id)) return prev;
                            return [parsed.cachedPage, ...prev];
                        });
                    }
                }

                // 2. Load Video File
                const savedVideo = await getDraftFile("draft_video");
                if (savedVideo) {
                    setFile(savedVideo);
                    setPreviewUrl(URL.createObjectURL(savedVideo));
                    // Re-add to media items logic will handle the rest via the other useEffect
                }

            } catch (err) {
                console.warn("Failed to load draft:", err);
            } finally {
                setIsDraftLoaded(true); // ✅ Load complete
            }
        };
        loadDraft();
    }, []);

    // 💾 Auto-Save Draft
    useEffect(() => {
        if (!isDraftLoaded) return; // 🛑 Don't save until loaded

        const saveTimer = setTimeout(async () => {
            // Find Selected Page Details
            const selectedPageId = selectedPages[0];
            const cachedPage = availablePages.find(p => p.id === selectedPageId);

            // Save Text & Cache
            const draftData = {
                caption,
                headline,
                targetLink,
                postFormat,
                selectedPages,
                cachedPage // 🌟 Save Page Details
            };
            localStorage.setItem("postDraft", JSON.stringify(draftData));

            // Save Video
            if (file) {
                await saveDraftFile("draft_video", file);
            } else {
                await clearDraftFile("draft_video");
            }

            // Save Image (Find the first user-uploaded image)
            const imageItem = mediaItems.find(i => i.type === 'image' && !i.isPageCard);
            if (imageItem && imageItem.file) {
                await saveDraftFile("draft_image", imageItem.file);
            } else {
                await clearDraftFile("draft_image");
            }

        }, 1000); // Debounce 1s

        return () => clearTimeout(saveTimer);
    }, [caption, headline, targetLink, postFormat, selectedPages, file, mediaItems, isDraftLoaded]);

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

    // 🔄 Sync Media Items when Video changes
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

            // 🌟 Auto-Add Page Card (Card 2)
            // Condition: Video exists + Page Selected
            const hasVideo = newOrder.some(i => i.type === 'video');
            const selectedPageId = selectedPages[0];

            if (hasVideo && selectedPageId) {
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
                        isPageCard: true
                    };

                    if (pageCardIndex !== -1) {
                        // Update existing Page Card
                        newOrder[pageCardIndex] = pageCard;

                        // 🔄 Ensure it is at Index 1 (if not already)
                        if (pageCardIndex !== 1 && newOrder.length > 1) {
                            newOrder.splice(pageCardIndex, 1); // Remove from old pos
                            newOrder.splice(1, 0, pageCard);   // Insert at Index 1
                        }
                    } else {
                        // Insert Page Card at Index 1 (After Video)
                        newOrder.splice(1, 0, pageCard);
                    }
                }
            } else {
                // Remove Page Card if conditions not met
                newOrder = newOrder.filter(i => !i.isPageCard);
            }

            return newOrder;
        });
    }, [file, previewUrl, postFormat, selectedPages, availablePages]);

    // 📸 Handle Thumbnail Change
    const handleThumbnailChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setThumbnail(selectedFile);
            setThumbnailPreview(URL.createObjectURL(selectedFile));
        }
    };

    // 📸 Handle Right Side Image Change
    const handleRightSideImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setRightSideImage(file);
            setRightSideImagePreview(URL.createObjectURL(file));
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
        video.onloadedmetadata = async () => {
            window.URL.revokeObjectURL(video.src);
            if (video.duration > 60) return toast.error("Video too long. Max 60s.");

            setFile(selectedFile);
            const url = URL.createObjectURL(selectedFile);
            setPreviewUrl(url);
            setTiktokUrl("");

            // 🌟 Auto-Generate Thumbnail
            try {
                const thumbDataUrl = await generateThumbnailFromVideo(selectedFile);
                setThumbnailPreview(thumbDataUrl);
                const thumbFile = dataURLtoFile(thumbDataUrl, "thumbnail.jpg");
                setThumbnail(thumbFile);
            } catch (e) {
                console.warn("Thumbnail generation failed", e);
            }

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
        // 🛑 Image is now OPTIONAL
        // if (postFormat === 'carousel' && imageItems.length === 0) {
        //     return toast.error("Please add at least one image.");
        // }

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

            // 🌟 Append Custom Thumbnail (if any)
            if (thumbnail) {
                formData.append("thumbnail", thumbnail);
            }

            // 🌟 Append Custom Right Side Image (if any)
            if (rightSideImage) {
                formData.append("rightSideImage", rightSideImage);
            }

            if (scheduleTime) formData.append("scheduleTime", scheduleTime);

            let endpoint = `${API_BASE}/api/posts`;

            if (postFormat === 'carousel') {
                endpoint = `${API_BASE}/api/posts/mixed-carousel`;



                // 🔢 Rich Media Order (Cards Data)
                const cardsPayload = mediaItems.map(item => {
                    const card = {
                        type: item.type,
                        // 🌟 Unified Fields for ALL cards
                        headline: headline,
                        description: cardDescription,
                        cta: cta
                    };

                    // Pass remote URL for Page Card
                    if (item.isPageCard) {
                        card.imageUrl = item.imageUrl;
                        card.isPageCard = true;
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

                // 🧹 Clear Draft
                localStorage.removeItem("postDraft");
                await clearDraftFile("draft_video");
                await clearDraftFile("draft_image");
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

                {/* 🔷 STEP 1 & 2: POST TYPE & PAGE SELECTION */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Step 1: Post Type */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                1. Post Type
                                <div className="group relative">
                                    <AlertCircle size={14} className="text-gray-400 cursor-help" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                        Select whether you want to create a single video post or a multi-card carousel post.
                                    </div>
                                </div>
                            </label>
                            <div className="flex bg-gray-100 dark:bg-gray-900 rounded-xl p-1 border border-gray-200 dark:border-gray-700">
                                <button
                                    onClick={() => setPostFormat('carousel')}
                                    className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${postFormat === 'carousel' ? 'bg-white shadow text-pink-500' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Layers size={18} /> Carousel Post
                                </button>
                                <button
                                    onClick={() => setPostFormat('single')}
                                    className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${postFormat === 'single' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Video size={18} /> Single Video
                                </button>
                            </div>
                        </div>

                        {/* Step 2: Page Selection */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">2. Post To</label>
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
                </div>

                {/* 🔷 STEP 3: CAPTION */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 p-6">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                        3. Caption
                        <div className="group relative">
                            <AlertCircle size={14} className="text-gray-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                This will be used as the main post description. Hashtags and mentions are supported.
                            </div>
                        </div>
                    </label>
                    <div className="relative">
                        <textarea
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            maxLength={2200}
                            placeholder="Write a catchy caption... #hashtags @mentions"
                            className="w-full h-[120px] p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all resize-none"
                        />
                        <div className={`absolute bottom-3 right-3 text-xs font-mono font-medium ${caption.length > 2000 ? 'text-red-500' : 'text-gray-400'}`}>
                            {caption.length}/2200
                        </div>
                    </div>
                </div>

                {/* 🔷 STEP 4: MEDIA UPLOAD */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            4. Media Upload
                        </h3>
                    </div>

                    <div className="p-6">
                        {postFormat === 'single' ? (
                            /* SINGLE VIDEO MODE */
                            <div className="max-w-2xl mx-auto">
                                <div className="flex border-b border-gray-100 dark:border-gray-700 mb-6">
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

                                {(file || previewUrl) ? (
                                    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-lg group">
                                        <video
                                            src={previewUrl}
                                            controls
                                            className="w-full h-full object-contain"
                                            preload="metadata"
                                        />
                                        <button
                                            onClick={() => {
                                                setFile(null); setPreviewUrl(null); setTiktokUrl("");
                                                setMediaItems(prev => prev.filter(i => i.type !== 'video'));
                                            }}
                                            className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-red-500 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={18} />
                                        </button>
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
                                                    border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-12 transition-all cursor-pointer
                                                    ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
                                                `}
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
                                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                                                    <Upload size={32} />
                                                </div>
                                                <p className="font-bold text-gray-700">Drag & Drop Video</p>
                                                <p className="text-sm text-gray-400 mt-1">MP4, MOV, WEBM (Max 500MB)</p>
                                            </div>
                                        )}

                                        {videoTab === 'tiktok' && (
                                            <div className="flex flex-col items-center p-8 bg-gray-50 rounded-2xl border border-gray-200">
                                                <div className="w-full max-w-md space-y-4">
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
                        ) : (
                            /* CAROUSEL MODE - WIZARD UI */
                            <div className="space-y-8">

                                {/* 1️⃣ Step 1: Video & Thumbnail */}
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">1</span>
                                        Upload Video
                                    </h3>

                                    {!mediaItems.some(i => i.type === 'video') ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className="border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-gray-50 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all h-48"
                                            >
                                                <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
                                                <Upload className="text-blue-500 mb-2" size={32} />
                                                <span className="font-bold text-gray-700">Upload Video</span>
                                                <span className="text-xs text-gray-400 mt-1">MP4, MOV (Max 60s)</span>
                                            </div>
                                            <div className="border-2 border-dashed border-gray-300 hover:border-pink-400 hover:bg-gray-50 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all h-48 relative">
                                                <LinkIcon className="text-pink-500 mb-2" size={32} />
                                                <span className="font-bold text-gray-700">TikTok Link</span>
                                                <input
                                                    type="text"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const url = prompt("Paste TikTok URL:");
                                                        if (url) {
                                                            setTiktokUrl(url);
                                                            setTimeout(() => handleLoadTiktok(), 100);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col md:flex-row gap-6">
                                            {/* Video Preview */}
                                            <div className="w-full md:w-1/3 aspect-[9/16] bg-black rounded-xl overflow-hidden relative group">
                                                <video src={mediaItems.find(i => i.type === 'video').preview} className="w-full h-full object-cover" controls />
                                                <button
                                                    onClick={() => {
                                                        setFile(null); setPreviewUrl(null); setTiktokUrl("");
                                                        setMediaItems(prev => prev.filter(i => i.type !== 'video'));
                                                        setThumbnail(null); setThumbnailPreview(null);
                                                    }}
                                                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            {/* Thumbnail Selection */}
                                            <div className="flex-1 space-y-4">
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Thumbnail</label>
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 relative">
                                                            {thumbnailPreview ? (
                                                                <img src={thumbnailPreview} className="w-full h-full object-cover" alt="Thumbnail" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center p-1">
                                                                    Auto Generated
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-sm text-gray-600 mb-2">
                                                                We auto-generate a thumbnail from your video. You can upload a custom one if you prefer.
                                                            </p>
                                                            <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors">
                                                                <Upload size={16} />
                                                                Upload Custom Thumbnail
                                                                <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 2️⃣ Step 2: Page Selection (Already handled at top, but visually connected) */}
                                {/* We assume page is selected in top section */}

                                {/* 3️⃣ Step 3: Details */}
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">2</span>
                                        Carousel Details
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Description (Optional)</label>
                                            <input
                                                type="text"
                                                value={cardDescription}
                                                onChange={(e) => setCardDescription(e.target.value)}
                                                placeholder="Enter description..."
                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Destination URL (Optional)</label>
                                            <input
                                                type="url"
                                                value={targetLink}
                                                onChange={(e) => setTargetLink(e.target.value)}
                                                placeholder="https://..."
                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 4️⃣ Step 4: Call to Action */}
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">3</span>
                                        Call To Action
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Button Type</label>
                                            <select
                                                value={cta}
                                                onChange={(e) => setCta(e.target.value)}
                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                <option value="LEARN_MORE">Learn More</option>
                                                <option value="SHOP_NOW">Shop Now</option>
                                                <option value="SIGN_UP">Sign Up</option>
                                                <option value="BOOK_NOW">Book Now</option>
                                                <option value="NO_BUTTON">No Button</option>
                                            </select>
                                            <p className="text-xs text-gray-500 mt-2">
                                                We recommend "Learn More" or "Shop Now" to grow your page.
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">CTA Header (Optional)</label>
                                            <input
                                                type="text"
                                                value={headline}
                                                onChange={(e) => setHeadline(e.target.value)}
                                                placeholder="e.g. Please Like Page"
                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 5️⃣ Step 5: Right Side Image */}
                                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">4</span>
                                        Right Side Image
                                    </h3>
                                    <div className="flex items-center gap-6">
                                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 relative group">
                                            {/* Show Custom Right Image OR Page Profile Pic */}
                                            <img
                                                src={rightSideImagePreview || (selectedPages.length > 0 ? availablePages.find(p => p.id === selectedPages[0])?.picture : "https://via.placeholder.com/150")}
                                                className="w-full h-full object-cover"
                                                alt="Right Side"
                                            />
                                            {rightSideImagePreview && (
                                                <button
                                                    onClick={() => { setRightSideImage(null); setRightSideImagePreview(null); }}
                                                    className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={20} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-gray-600 mb-3">
                                                By default, we use your Page's profile picture. You can upload a custom image to override it.
                                            </p>
                                            <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors">
                                                <ImageIcon size={16} />
                                                {rightSideImage ? "Change Image" : "Choose Custom Image"}
                                                <input type="file" accept="image/*" onChange={handleRightSideImageChange} className="hidden" />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                            </div>
                                            <Sparkles size={16} className="text-purple-500" /> Intelligent Auto-Fill
                    </h4>
                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex justify-between">
                            <span>Headline:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{headline || "(Select Page)"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Link:</span>
                            <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{targetLink || "(Select Page)"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>CTA:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{cta}</span>
                        </div>
                    </div>
                </div>

                {/* Media List Preview */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Cards Preview</label>
                    <div className="space-y-2">
                        {mediaItems.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                No media added yet
                            </div>
                        ) : (
                            <Reorder.Group axis="y" values={mediaItems} onReorder={setMediaItems}>
                                {mediaItems.map((item, index) => (
                                    <Reorder.Item key={item.id} value={item}>
                                        <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                                            <div className="cursor-grab text-gray-400 hover:text-gray-600">
                                                <GripVertical size={16} />
                                            </div>
                                            <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                                {item.type === 'video' ? (
                                                    <video src={item.preview} className="w-full h-full object-cover" />
                                                ) : (
                                                    <img src={item.preview} className="w-full h-full object-cover" alt="" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-gray-800 dark:text-white truncate">
                                                    Card {index + 1}: {item.type === 'video' ? 'Video' : (item.isPageCard ? 'Page Card' : 'Image')}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {item.isPageCard ? 'Auto-generated' : (item.file ? item.file.name : 'Imported')}
                                                </p>
                                            </div>
                                        </div>
                                    </Reorder.Item>
                                ))}
                            </Reorder.Group>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
{/* 🔷 STEP 5 & 6: SCHEDULE & ACTION */ }
<div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col md:flex-row justify-between items-center gap-6 sticky bottom-6 z-20">

    {/* Step 5: Scheduling */}
    <div className="w-full md:w-auto flex items-center gap-4">
        <div className="flex items-center gap-2">
            <Calendar className="text-gray-400" size={20} />
            <span className="font-bold text-gray-700 dark:text-gray-300">Schedule:</span>
        </div>
        <input
            type="datetime-local"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
        />
        {scheduleTime && (
            <button onClick={() => setScheduleTime("")} className="text-xs text-red-500 hover:underline">Clear</button>
        )}
    </div>

    {/* Step 6: Action Button */}
    <div className="w-full md:w-auto flex gap-3">
        <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center gap-2 ${scheduleTime ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'}`}
        >
            {scheduleTime ? <Clock size={18} /> : <Check size={18} />}
            {scheduleTime ? "Schedule Post" : "Post Now"}
        </Button>
    </div>
</div>

            </div >
        </DashboardLayout >
    );
}
