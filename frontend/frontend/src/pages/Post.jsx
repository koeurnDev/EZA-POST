import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import DashboardLayout from "../layouts/DashboardLayout";
import {
    Upload, Link as LinkIcon, X, Calendar, Clock, Layers, Plus, Trash2,
    ChevronDown, Share2, Youtube, Instagram, Facebook, Zap, Shield,
    Maximize2, Volume2, VolumeX, MessageSquare, EyeOff
} from "lucide-react";
import apiUtils, { fetchCsrfToken } from "../utils/apiUtils";
import { postsAPI } from "../utils/api";
import { saveDraftFile, getDraftFile, clearDraftFile } from "../utils/draftDB";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import { generateThumbnailFromVideo, generateGalleryFromVideo, dataURLtoFile } from "../utils/videoUtils";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/api$/, "");

export default function Post() {
    const { user } = useAuth();

    const [postFormat] = useState("carousel"); // Forced to carousel
    const [videoTab, setVideoTab] = useState("upload");

    const [platforms, setPlatforms] = useState({
        facebook: true,
        youtube: false,
        tiktok: false,
        instagram: false
    });

    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [rawVideoUrl, setRawVideoUrl] = useState(null); // Stores raw CDN URL for backend
    const [tiktokUrl, setTiktokUrl] = useState("");
    const [mediaItems, setMediaItems] = useState([]);
    const [thumbnail, setThumbnail] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const [rightSideImage, setRightSideImage] = useState(null);
    const [rightSideImagePreview, setRightSideImagePreview] = useState(null);

    const [headline, setHeadline] = useState("");
    const [targetLink, setTargetLink] = useState("");
    const [cardDescription, setCardDescription] = useState("");
    const [cta, setCta] = useState("LEARN_MORE");

    const [caption, setCaption] = useState("");
    const [carouselCtaText, setCarouselCtaText] = useState("ចុច Like Page ដើម្បីបាន\nវីដេអូថ្មីៗ");
    const [selectedPages, setSelectedPages] = useState([]);
    const [availablePages, setAvailablePages] = useState([]);
    const [scheduleTime, setScheduleTime] = useState("");
    const [staggerDelay, setStaggerDelay] = useState(0);

    const [aiOptions, setAiOptions] = useState({
        safeMode: false,
        pitchShift: false,
        flip: false
    });

    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    const [isDraftLoaded, setIsDraftLoaded] = useState(false);
    const [connectedPlatforms, setConnectedPlatforms] = useState({ youtube: false, tiktok: false, instagram: false });
    const [publishMode, setPublishMode] = useState("now");

    const [activeView, setActiveView] = useState("create");
    const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
    const [pageCardSettings, setPageCardSettings] = useState({ enabled: true });
    const [galleryOptions, setGalleryOptions] = useState([]);
    const [queue, setQueue] = useState([]);
    const [queueError, setQueueError] = useState(null);
    const [previewVideoModal, setPreviewVideoModal] = useState(null);
    const [openCtaMenu, setOpenCtaMenu] = useState(null);
    const [autoReplyBot, setAutoReplyBot] = useState(false);


    // --- 🚀 Auto Features State ---
    const [isPreviewMuted, setIsPreviewMuted] = useState(true);
    const carouselRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const loadDraft = async () => {
            try {
                const savedDraft = localStorage.getItem("postDraft");
                if (savedDraft) {
                    const parsed = JSON.parse(savedDraft);
                    setCaption(parsed.caption || "");
                    setHeadline(parsed.headline || "");
                    setTargetLink(parsed.targetLink || "");
                    setPostFormat(parsed.postFormat || "carousel");
                    if (parsed.carouselCtaText) setCarouselCtaText(parsed.carouselCtaText);
                    if (parsed.cta) setCta(parsed.cta);
                    if (parsed.selectedPages) setSelectedPages(parsed.selectedPages);
                    if (parsed.autoReplyBot !== undefined) setAutoReplyBot(parsed.autoReplyBot);


                    if (parsed.cachedPage) {
                        setAvailablePages(prev => {
                            if (prev.some(p => p.id === parsed.cachedPage.id)) return prev;
                            return [parsed.cachedPage, ...prev];
                        });
                    }
                }
            } catch (err) {
                console.warn("Draft restoration failed", err);
            } finally {
                setIsDraftLoaded(true);
            }
        };
        loadDraft();
    }, []);

    useEffect(() => {
        if (!isDraftLoaded) return;
        const saveTimer = setTimeout(async () => {
            const selectedPageId = selectedPages[0];
            const cachedPage = availablePages.find(p => p.id === selectedPageId);

            const draftData = {
                caption, headline, targetLink, postFormat, selectedPages, cachedPage, carouselCtaText, cta, autoReplyBot
            };

            localStorage.setItem("postDraft", JSON.stringify(draftData));
        }, 1000);
        return () => clearTimeout(saveTimer);
    }, [caption, headline, targetLink, postFormat, selectedPages, isDraftLoaded, availablePages, carouselCtaText, cta, autoReplyBot]);


    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [pagesRes, connRes] = await Promise.all([
                    apiUtils.getUserPages(),
                    apiUtils.getUserConnections()
                ]);

                if (pagesRes.data.success) {
                    setAvailablePages(pagesRes.data.accounts);
                    if (pagesRes.data.accounts.length > 0) {
                        const allPageIds = pagesRes.data.accounts.map(p => p.id);
                        setSelectedPages(allPageIds);
                        const firstPage = pagesRes.data.accounts[0];
                        setHeadline(firstPage.name);
                        setTargetLink(firstPage.link || `https://facebook.com/${firstPage.id}`);
                    }
                }

                if (connRes.data.success) {
                    setConnectedPlatforms(connRes.data.connections);
                }
            } catch (err) {
                console.error("Data synchronization failed", err);
            }
        };
        fetchInitialData();
    }, []);

    const togglePlatform = (platform) => {
        if (platform === 'facebook') {
            setPlatforms(prev => ({ ...prev, facebook: !prev.facebook }));
            return;
        }

        if (!connectedPlatforms[platform]) {
            toast.error(`Unauthorized node: Connect ${platform.toUpperCase()} in terminal.`);
            return;
        }
        setPlatforms(prev => ({ ...prev, [platform]: !prev[platform] }));
    };

    const handleClearPreview = async () => {
        setFile(null);
        setPreviewUrl(null);
        setRawVideoUrl(null);
        setTiktokUrl("");
        setMediaItems([]);
        setThumbnail(null);
        setThumbnailPreview(null);
        setRightSideImage(null);
        setRightSideImagePreview(null);
        setGalleryOptions([]);
        setAutoReplyBot(false);

        
        // Clear draft files from IndexedDB
        try {
            await Promise.all([
                clearDraftFile("draft_video"),
                clearDraftFile("draft_thumb"),
                clearDraftFile("draft_card2")
            ]);
        } catch (e) { console.warn("Failed to clear draft files", e); }
        
        toast.success("Preview cleared.");
    };

    const handlePageSelection = (pageId) => {

        setSelectedPages([pageId]);
        const pageObj = availablePages.find(p => p.id === pageId);
        if (pageObj) {
            setHeadline(pageObj.name);
            setTargetLink(pageObj.link || `https://facebook.com/${pageObj.id}`);
        }
    };




    useEffect(() => {
        // We now allow mediaItems to populate even in single mode for preview consistency

        setMediaItems(prev => {
            const currentVideo = (file || previewUrl) ? {
                id: 'video-main',
                type: file?.type?.startsWith('image/') ? 'image' : 'video',
                preview: previewUrl || (file ? URL.createObjectURL(file) : null),
                file: file,
                url: previewUrl
            } : null;

            let newOrder = [...prev];
            const prevVideoIndex = newOrder.findIndex(item => item.type === 'video');

            if (currentVideo) {
                if (prevVideoIndex !== -1) newOrder[prevVideoIndex] = currentVideo;
                else newOrder.unshift(currentVideo);
            } else if (prevVideoIndex !== -1) {
                newOrder.splice(prevVideoIndex, 1);
            }

            // Remove duplicates or stale auto-cards if video is missing
            if (!currentVideo) {
                newOrder = newOrder.filter(i => !i.isPageCard);
            }

            // Also add Right Side Image if it exists and isn't already there
            if (rightSideImagePreview) {
                const rsIndex = newOrder.findIndex(i => i.id === 'right-side-image');
                const rsCard = {
                    id: 'right-side-image',
                    type: 'image',
                    preview: rightSideImagePreview,
                    file: rightSideImage,
                    isRightSide: true
                };

                if (rsIndex !== -1) {
                    newOrder[rsIndex] = rsCard;
                    // Move it to position 1 (after video) if it's not already there
                    if (rsIndex !== 1 && newOrder.length > 1) {
                        newOrder.splice(rsIndex, 1);
                        newOrder.splice(1, 0, rsCard);
                    }
                } else {
                    // Insert after video (position 1)
                    if (newOrder.length >= 1) newOrder.splice(1, 0, rsCard);
                    else newOrder.push(rsCard);
                }
            } else {
                newOrder = newOrder.filter(i => i.id !== 'right-side-image');
            }

            return newOrder;
        });
    }, [file, previewUrl, postFormat, selectedPages, availablePages, rightSideImage, rightSideImagePreview]);

    const handleThumbnailChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setThumbnail(selectedFile);
            setThumbnailPreview(URL.createObjectURL(selectedFile));
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) validateAndSetMedia(selectedFile);
    };

    const validateAndSetMedia = (selectedFile) => {
        const isVideo = selectedFile.type.startsWith("video/");
        const isImage = selectedFile.type.startsWith("image/");

        if (!isVideo && !isImage) return toast.error("Invalid media type.");
        if (selectedFile.size > 500 * 1024 * 1024) return toast.error("Payload too heavy (>500MB).");

        if (isImage) {
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setTiktokUrl("");
            setThumbnail(null);
            setThumbnailPreview(null);
            toast.success("Image payload added.");
            return;
        }

        // Video logic
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = async () => {
            window.URL.revokeObjectURL(video.src);
            if (video.duration > 60) return toast.error("Duration overflow (>60s).");

            setFile(selectedFile);
            const url = URL.createObjectURL(selectedFile);
            setPreviewUrl(url);
            setTiktokUrl("");

            try {
                const thumbDataUrl = await generateThumbnailFromVideo(selectedFile);
                setThumbnailPreview(thumbDataUrl);
                const thumbFile = dataURLtoFile(thumbDataUrl, "thumbnail.jpg");
                setThumbnail(thumbFile);

                // Generate 6 gallery options
                const frames = await generateGalleryFromVideo(selectedFile, 6);
                setGalleryOptions(frames);

                // Auto-fill Card 2 with the first frame if empty
                if (frames.length > 0 && !rightSideImagePreview) {
                    setRightSideImagePreview(frames[0]);
                    setRightSideImage(dataURLtoFile(frames[0], "card2-auto.jpg"));
                }
            } catch (e) { console.warn("Visual extraction failed", e); }

            toast.success("Identity payload added.");
        };
        video.src = URL.createObjectURL(selectedFile);
    };

    const handleLoadTiktok = async () => {
        if (!tiktokUrl) return;
        setIsLoadingVideo(true);
        const toastId = toast.loading("Intercepting TikTok data...");
        try {
            const response = await axios.post(`${API_BASE}/api/posts/tiktok/fetch`, { url: tiktokUrl }, { withCredentials: true });
            const data = response.data;
            if (data.success) {
                // Save raw URL for backend
                setRawVideoUrl(data.video.url);
                setFile(null);

                // Request H.264 compatible stream for UI preview
                let previewStream = data.video.url;
                try {
                    const compRes = await axios.post(`${API_BASE}/api/tools/tiktok/compatible`, { url: data.video.url }, { withCredentials: true });
                    if (compRes.data.success) {
                        previewStream = `${API_BASE}${compRes.data.url}`;
                    }
                } catch (e) { console.warn("Failed to get compatible stream", e); }
                
                setPreviewUrl(previewStream);

                // Use TikTok's cover if available, otherwise generate from video
                if (data.video.cover) {
                    setThumbnailPreview(data.video.cover);
                    // Fetch and convert to File for backend
                    try {
                        const blobRes = await fetch(data.video.cover);
                        const blob = await blobRes.blob();
                        const thumbFile = new File([blob], "tiktok-thumb.jpg", { type: "image/jpeg" });
                        setThumbnail(thumbFile);
                    } catch (e) { console.warn("Failed to sync TikTok cover to file", e); }
                } else {
                    try {
                        const thumbDataUrl = await generateThumbnailFromVideo(previewStream);
                        setThumbnailPreview(thumbDataUrl);
                        const thumbFile = dataURLtoFile(thumbDataUrl, "thumbnail.jpg");
                        setThumbnail(thumbFile);
                    } catch (e) { console.warn("Visual extraction failed for TikTok video", e); }
                }

                // Generate 6 gallery options using the compatible stream
                try {
                    const frames = await generateGalleryFromVideo(previewStream, 6);
                    setGalleryOptions(frames);

                    // Auto-fill Card 2 with the first frame if empty
                    if (frames.length > 0 && !rightSideImagePreview) {
                        setRightSideImagePreview(frames[0]);
                        setRightSideImage(dataURLtoFile(frames[0], "card2-auto.jpg"));
                    }
                } catch (e) { console.warn("Gallery extraction failed for TikTok video", e); }

                toast.success("Payload decrypted.", { id: toastId });
            } else throw new Error(data.error);
        } catch (err) {
            console.error("TikTok Fetch Error:", err);
            toast.error(err.response?.data?.error || "Interception failed.", { id: toastId });
        }
        finally { setIsLoadingVideo(false); }
    };

    const handleSubmit = async () => {
        if (selectedPages.length === 0) return toast.error("No target nodes selected.");
        if (!file && !previewUrl) return toast.error("No media payload.");

        setIsSubmitting(true);
        const toastId = toast.loading("Executing distribution protocol...");

        try {
            const formData = new FormData();
            formData.append("caption", caption);
            formData.append("accounts", JSON.stringify(selectedPages));
            formData.append("platforms", JSON.stringify(Object.keys(platforms).filter(k => platforms[k])));

            if (file) formData.append("video", file);
            else if (rawVideoUrl) formData.append("videoUrl", rawVideoUrl);
            else if (previewUrl) formData.append("videoUrl", previewUrl);

            if (thumbnail) formData.append("thumbnail", thumbnail);
            if (rightSideImage) formData.append("rightSideImage", rightSideImage);
            if (publishMode === 'schedule' && scheduleTime) formData.append("scheduleTime", scheduleTime);
            if (staggerDelay) formData.append("staggerDelay", staggerDelay);
            formData.append("aiOptions", JSON.stringify(aiOptions));
            formData.append("enableBot", autoReplyBot);


            // Force carousel endpoint
            let endpoint = `${API_BASE}/api/posts/mixed-carousel`;
            const cardsPayload = mediaItems.map(item => ({
                id: item.id,
                type: item.type,
                headline: item.type === 'video' ? headline : carouselCtaText.replace(/\n/g, ' '),
                description: item.type === 'video' ? (cardDescription || "Swipe to see more") : "",
                cta,
                isPageCard: item.isPageCard,
                imageUrl: item.imageUrl,
                isRightSide: item.isRightSide
            }));
            formData.append("carouselCards", JSON.stringify(cardsPayload));

            const response = await axios.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true
            });

            const data = response.data;
            if (data.success) {
                toast.success("Distribution successful.", { id: toastId });
                setFile(null); setPreviewUrl(null); setRawVideoUrl(null); setTiktokUrl(""); setMediaItems([]);
                
                const isAutoCard2 = rightSideImage && rightSideImage.name && rightSideImage.name.startsWith("card2-");
                if (isAutoCard2) {
                    setRightSideImage(null); 
                    setRightSideImagePreview(null);
                }

                setThumbnail(null); setThumbnailPreview(null);

                localStorage.removeItem("postDraft");
                
                const clearPromises = [
                    clearDraftFile("draft_video"),
                    clearDraftFile("draft_thumb")
                ];
                if (isAutoCard2 || !rightSideImage) {
                    clearPromises.push(clearDraftFile("draft_card2"));
                }
                await Promise.all(clearPromises);
            } else throw new Error(data.error);
        } catch (err) {
            console.error("Submit Error:", err);
            toast.error(err.response?.data?.error || "Distribution failure.", { id: toastId });
        }
        finally { setIsSubmitting(false); }
    };

    const cancelScheduledPost = async (postId) => {
        try {
            await postsAPI.cancel(postId);
            setQueue(prev => prev.filter(p => p.id !== postId));
            toast.success("Post removed from terminal.");
        } catch (error) {
            toast.error("Critical failure during cancellation.");
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-16 pb-32">
                {/* 🚀 Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8 mb-8 md:mb-12">
                    <div className="space-y-1 md:space-y-2">
                        <div className="flex items-center gap-2 mb-1 md:mb-3">
                            <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] md:text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                Social Manager
                            </div>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tighter">
                            Main <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Home.</span>
                        </h1>
                        <p className="text-xs md:text-sm text-gray-500 font-medium max-w-lg">គ្រប់គ្រង និងកំណត់ពេលផុសមាតិការបស់អ្នកដោយងាយស្រួល។</p>
                    </div>
                </div>

                {/* 🚀 Dynamic View Orchestrator */}
                <div className="flex items-center gap-1 md:gap-2 mb-8 md:mb-16 bg-gray-50/50 dark:bg-white/5 p-1.5 md:p-2 rounded-2xl md:rounded-[2rem] border border-gray-100 dark:border-white/5 w-fit">
                    {[
                        { id: 'create', label: 'បង្កើតមាតិកា', icon: Plus },
                        { id: 'queue', label: 'បញ្ជីកំពុងដំណើរការ', icon: Layers }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveView(tab.id)}
                            className={`flex items-center gap-2 md:gap-3 px-4 md:px-8 py-2.5 md:py-3.5 rounded-xl md:rounded-[1.5rem] text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-all ${activeView === tab.id
                                ? "bg-white dark:bg-gray-900 text-blue-600 shadow-xl shadow-black/5 border border-gray-100 dark:border-white/10"
                                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                }`}
                        >
                            <tab.icon size={14} md:size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {activeView === 'create' ? (
                        <motion.div
                            key="create"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                            className="space-y-6 md:space-y-10"
                        >
                            {/* 🎯 Destination: Choose Page */}
                            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-2xl md:rounded-[2.5rem] p-5 md:p-10 shadow-xl">
                                <div className="flex items-center justify-between mb-5 md:mb-6">
                                    <h3 className="text-sm md:text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">ជ្រើសរើសផេក</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[7px] md:text-[8px] font-black text-gray-400 uppercase">កាតផេក</span>
                                        <button
                                            onClick={() => setPageCardSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                                            className={`w-8 md:w-10 h-4 md:h-5 rounded-full transition-all relative ${pageCardSettings.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-white/10'}`}
                                        >
                                            <div className={`absolute top-0.5 md:top-1 w-3 h-3 rounded-full bg-white transition-all ${pageCardSettings.enabled ? 'left-[18px] md:left-6' : 'left-0.5 md:left-1'}`} />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                                    {availablePages.map(page => (
                                        <div
                                            key={page.id}
                                            onClick={() => handlePageSelection(page.id)}
                                            className={`flex items-center gap-2.5 md:gap-4 p-3 md:p-4 rounded-xl md:rounded-2xl border cursor-pointer transition-all active:scale-[0.98] ${selectedPages.includes(page.id) ? 'bg-blue-500/10 border-blue-500/20 shadow-lg' : 'bg-gray-50 dark:bg-black border-transparent'}`}
                                        >
                                            <img src={page.picture} className="w-7 h-7 md:w-10 md:h-10 rounded-full border border-white/10" />
                                            <p className="text-[9px] md:text-[11px] font-black text-gray-900 dark:text-white uppercase truncate">{page.name}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 🔗 TikTok Link Field */}
                            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 shadow-xl md:shadow-2xl shadow-black/5">
                                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
                                    <div className="flex-1 w-full">
                                        <div className="flex items-center gap-2 mb-2 md:mb-3 px-1">
                                            <LinkIcon size={12} md:size={14} className="text-pink-500" />
                                            <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">ដាក់ Link វីដេអូ TikTok</label>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-2.5 md:gap-4">
                                            <input
                                                type="text"
                                                value={tiktokUrl || ""}
                                                onChange={(e) => setTiktokUrl(e.target.value)}
                                                placeholder="Paste TikTok Link..."
                                                className="w-full bg-gray-100/50 dark:bg-white/5 rounded-xl md:rounded-2xl px-4 md:px-6 py-4 md:py-5 font-bold outline-none transition-all text-sm md:text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 border-2 border-transparent focus:border-pink-500/30"
                                            />
                                            <Button onClick={handleLoadTiktok} isLoading={isLoadingVideo} className="h-14 md:h-16 px-6 md:px-10 rounded-xl md:rounded-2xl bg-pink-600 text-white shadow-lg shadow-pink-500/20 active:scale-95 transition-all text-sm md:text-base font-bold w-full sm:w-auto">
                                                Fetch
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 📱 Universal Visualizer (Preview) */}
                            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-2xl md:rounded-[2.5rem] p-5 md:p-8 shadow-xl">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 md:mb-6 pb-4 border-b border-gray-100 dark:border-white/5 gap-4">
                                        <div className="flex items-center gap-3 select-none">
                                            <div className="w-8 h-8 bg-blue-500/10 text-blue-600 rounded-lg flex items-center justify-center">
                                                <Layers size={14} md:size={16} />
                                            </div>
                                            <h3 className="text-[9px] md:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">ការបង្ហាញសាកល្បង (PREVIEW)</h3>
                                        </div>
                                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                            <div className="flex items-center gap-2 mr-2 bg-purple-500/10 px-2.5 py-1.5 rounded-xl border border-purple-500/20">
                                                <div className="flex items-center gap-1.5">
                                                    <MessageSquare size={10} md:size={12} className="text-purple-600" />
                                                    <span className="text-[8px] md:text-[9px] font-black text-purple-600 uppercase tracking-tight">Bot</span>
                                                </div>
                                                <button
                                                    onClick={() => setAutoReplyBot(!autoReplyBot)}
                                                    className={`w-7 md:w-8 h-3.5 md:h-4 rounded-full transition-all relative ${autoReplyBot ? 'bg-purple-600' : 'bg-gray-200 dark:bg-white/10'}`}
                                                >
                                                    <div className={`absolute top-0.5 w-2.5 md:w-3 h-2.5 md:h-3 rounded-full bg-white transition-all ${autoReplyBot ? 'left-[16px] md:left-[18px]' : 'left-0.5'}`} />
                                                </button>
                                            </div>
                                            <button
                                                onClick={handleClearPreview}
                                                className="p-2 md:p-2.5 bg-gray-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-lg transition-all border border-gray-100 dark:border-white/5 shadow-sm active:scale-90"
                                                title="លុប"
                                            >
                                                <Trash2 size={14} md:size={16} />
                                            </button>
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="p-2 md:p-2.5 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-white rounded-lg transition-all border border-gray-100 dark:border-white/5 shadow-sm active:scale-90"
                                                title="បន្ថែម"
                                            >
                                                <Plus size={14} md:size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* 📝 Caption Editing */}
                                    <div className="px-1 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 overflow-hidden shadow-inner shrink-0">
                                                {(() => {
                                                    const selectedPage = availablePages.find(p => p.id === selectedPages[0]);
                                                    return selectedPage?.picture ? (
                                                        <img src={selectedPage.picture} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-[10px]">KR</div>
                                                    );
                                                })()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[13px] md:text-[14px] font-bold text-gray-900 dark:text-white leading-tight truncate">
                                                    {availablePages.find(p => p.id === selectedPages[0])?.name || "ជ្រើសរើសផេក"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="group/caption-preview relative mt-3 md:mt-4 px-1 pb-4 md:pb-6">
                                        <textarea
                                            value={caption}
                                            onChange={(e) => setCaption(e.target.value)}
                                            placeholder="សរសេររៀបរាប់មាតិការបស់អ្នក..."
                                            className="w-full bg-transparent border-none p-0 text-[14px] md:text-[15px] font-normal text-gray-800 dark:text-gray-200 leading-[1.3] outline-none focus:ring-0 rounded-lg resize-none min-h-[40px] scrollbar-hide"
                                            rows={2}
                                            spellCheck={false}
                                        />
                                    </div>

                                    <div
                                        ref={carouselRef}
                                        className="flex overflow-x-auto md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 pb-8 md:pb-12 px-1 snap-x scrollbar-hide"
                                    >
                                        {/* 📁 Empty State */}
                                        {!mediaItems.some(item => item.id === 'video-main') && (
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className="min-w-[260px] w-[80%] md:w-full aspect-square bg-gray-50 dark:bg-black/20 border-2 border-dashed border-gray-200 dark:border-white/5 rounded-[2rem] flex flex-col items-center justify-center gap-3 md:gap-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 transition-all group/upload-placeholder snap-center flex-shrink-0"
                                            >
                                                <div className="w-12 h-12 md:w-16 md:h-16 bg-white dark:bg-white/5 rounded-full flex items-center justify-center shadow-sm group-hover/upload-placeholder:scale-110 transition-transform">
                                                    <Plus className="text-blue-500" size={24} md:size={32} />
                                                </div>
                                                <div className="text-center px-4 md:px-6">
                                                    <p className="text-xs md:text-[13px] font-bold text-gray-900 dark:text-white mb-1">បន្ថែមមាតិកា</p>
                                                    <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">ចុចទីនេះដើម្បីដាក់វីដេអូ</p>
                                                </div>
                                            </div>
                                        )}

                                        {mediaItems.map((item, idx) => (
                                            <div
                                                key={item.id}
                                                className="min-w-[260px] w-[80%] md:w-full bg-white dark:bg-[#242526] rounded-xl overflow-hidden shadow-md border border-gray-200 dark:border-white/5 flex flex-col snap-center flex-shrink-0 transition-all duration-300 group/card"
                                            >
                                                {/* Media Section */}
                                                <div 
                                                    className="relative aspect-square bg-black overflow-hidden cursor-pointer"
                                                    onClick={() => {
                                                        if (item.id === 'video-main') {
                                                            fileInputRef.current?.click();
                                                        } else if (item.isRightSide) {
                                                            const input = document.createElement('input');
                                                            input.type = 'file';
                                                            input.accept = 'image/*';
                                                            input.onchange = (ev) => {
                                                                const f = ev.target.files[0];
                                                                if (f) {
                                                                    setRightSideImage(f);
                                                                    setRightSideImagePreview(URL.createObjectURL(f));
                                                                }
                                                            };
                                                            input.click();
                                                        }
                                                    }}
                                                >
                                                    {item.type === 'video' ? (
                                                        <video src={item.preview} className="w-full h-full object-cover" autoPlay muted={isPreviewMuted} loop playsInline />
                                                    ) : (
                                                        <img src={item.preview} className="w-full h-full object-cover" />
                                                    )}

                                                    {/* Overlays */}
                                                    <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-all flex items-center justify-center">
                                                        {(item.id === 'video-main' || item.isRightSide) && (
                                                            <div className="flex flex-col items-center gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                                                <div className="w-9 h-9 md:w-10 md:h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 text-white shadow-xl">
                                                                    <Upload size={16} md:size={18} />
                                                                </div>
                                                                <p className="text-[8px] md:text-[9px] font-bold text-white uppercase tracking-widest">ប្តូររូបភាព</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {item.type === 'video' && (
                                                        <div className="absolute top-2.5 left-2.5 z-20">
                                                            <button 
                                                                 onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setIsPreviewMuted(!isPreviewMuted);
                                                                 }}
                                                                className="p-1.5 md:p-2 bg-black/40 backdrop-blur-sm rounded-lg border border-white/10 text-white hover:bg-black/60 transition-all"
                                                            >
                                                                {isPreviewMuted ? <VolumeX size={12} md:size={14} /> : <Volume2 size={12} md:size={14} />}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Quick Gallery */}
                                                    {galleryOptions.length > 0 && (item.id === 'video-main' || item.isRightSide) && (
                                                        <div className="absolute inset-x-0 bottom-0 p-2 md:p-3 bg-black/80 translate-y-full group-hover/card:translate-y-0 transition-transform flex flex-col gap-2 z-30">
                                                            <div className="flex justify-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                                                                {galleryOptions.map((frame, fIdx) => (
                                                                    <div
                                                                        key={fIdx}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (item.id === 'video-main') {
                                                                                setThumbnailPreview(frame);
                                                                                setThumbnail(dataURLtoFile(frame, `thumb-${fIdx}.jpg`));
                                                                            } else {
                                                                                setRightSideImagePreview(frame);
                                                                                setRightSideImage(dataURLtoFile(frame, `card2-${fIdx}.jpg`));
                                                                            }
                                                                        }}
                                                                        className={`w-7 h-7 md:w-8 md:h-8 rounded-md overflow-hidden border-2 flex-shrink-0 ${(item.id === 'video-main' ? thumbnailPreview : rightSideImagePreview) === frame ? 'border-blue-500' : 'border-white/20'}`}
                                                                    >
                                                                        <img src={frame} className="w-full h-full object-cover" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Bottom Bar */}
                                                <div className="px-3 py-3 bg-[#f0f2f5] dark:bg-[#242526] border-t border-gray-200 dark:border-white/5 flex items-center gap-2 relative">
                                                    <div className="flex-1 min-w-0">
                                                        <textarea
                                                            value={carouselCtaText}
                                                            onChange={(e) => setCarouselCtaText(e.target.value)}
                                                            className="w-full bg-transparent border-none p-0 text-[11px] md:text-[12px] font-bold text-gray-900 dark:text-gray-100 leading-tight outline-none focus:ring-0 rounded resize-none overflow-hidden scrollbar-hide block"
                                                            rows={2}
                                                            spellCheck={false}
                                                        />
                                                    </div>

                                                    <div className="flex-shrink-0 relative group/cta-select transition-all">
                                                        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-[#3a3b3c] rounded-md border border-gray-300 dark:border-white/10 shadow-sm">
                                                            <span className="text-[9px] md:text-[11px] font-bold text-gray-900 dark:text-white">
                                                                {cta === 'FOLLOW' ? 'តាមដាន' :
                                                                 cta === 'LEARN_MORE' ? 'ស្វែងយល់' :
                                                                 cta === 'SEND_MESSAGE' ? 'ផ្ញើសារ' :
                                                                 cta === 'SIGN_UP' ? 'ចុះឈ្មោះ' :
                                                                 cta === 'BOOK_NOW' ? 'កក់ទុក' :
                                                                 cta === 'SHOP_NOW' ? 'ទិញ' : 'តាមដាន'}
                                                            </span>
                                                            <ChevronDown size={10} className="text-gray-500" />
                                                        </div>
                                                        <select
                                                            value={cta}
                                                            onChange={(e) => setCta(e.target.value)}
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                        >
                                                            <option value="FOLLOW">តាមដាន</option>
                                                            <option value="LEARN_MORE">ស្វែងយល់បន្ថែម</option>
                                                            <option value="SEND_MESSAGE">ផ្ញើសារ</option>
                                                            <option value="SIGN_UP">ចុះឈ្មោះ</option>
                                                            <option value="BOOK_NOW">កក់ទុក</option>
                                                            <option value="SHOP_NOW">ទិញឥឡូវនេះ</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Final Destination Card */}
                                        <div
                                            onClick={() => window.open(targetLink, '_blank')}
                                            className="min-w-[260px] w-[80%] md:w-full aspect-square bg-white dark:bg-[#242526] rounded-xl shadow-md flex flex-col items-center justify-center text-center p-6 md:p-8 border border-gray-200 dark:border-white/5 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a2d31] transition-all duration-300 group snap-center flex-shrink-0"
                                        >
                                            <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-100 dark:bg-gray-800 rounded-xl mb-4 md:mb-6 overflow-hidden flex items-center justify-center border border-gray-200 dark:border-white/5 group-hover:scale-105 transition-transform">
                                                {(() => {
                                                    const selectedPage = availablePages.find(p => p.id === selectedPages[0]);
                                                    return selectedPage?.picture ? (
                                                        <img src={selectedPage.picture} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Share2 className="text-gray-400" size={24} md:size={32} />
                                                    );
                                                })()}
                                            </div>
                                            <h4 className="text-xs md:text-sm font-bold text-gray-900 dark:text-white/90 mb-1">មើលច្រើនទៀតនៅ</h4>
                                            <p className="text-gray-500 text-[9px] md:text-[11px] font-medium uppercase tracking-wider mb-4 md:mb-5">FACEBOOK.COM</p>
                                            <div className="px-4 py-1.5 md:px-5 md:py-2 bg-gray-100 dark:bg-white/10 rounded-md text-[10px] md:text-[11px] font-bold text-gray-900 dark:text-white/60 border border-gray-300 dark:border-white/10">
                                                Go to Page
                                            </div>
                                        </div>
                                    </div>
                                </div>


                            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-2xl p-5 md:p-10 shadow-xl">
                                <h3 className="text-sm md:text-xl font-black text-gray-900 dark:text-white mb-4 md:mb-6 uppercase tracking-tighter">ឧបករណ៍ជំនួយ</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-4">
                                    {[
                                        { id: 'safeMode', label: 'Safe Mode', color: 'blue' },
                                        { id: 'pitchShift', label: 'Voice Fix', color: 'indigo' },
                                        { id: 'flip', label: 'Flip Video', color: 'pink' }
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setAiOptions(prev => ({ ...prev, [opt.id]: !prev[opt.id] }))}
                                            className={`p-3.5 md:p-6 rounded-xl md:rounded-2xl border-2 transition-all font-black uppercase text-[8px] md:text-[10px] tracking-widest active:scale-[0.98] ${aiOptions[opt.id] ? `bg-${opt.color}-500/10 border-${opt.color}-500/20 text-${opt.color}-600` : 'bg-gray-50 dark:bg-black border-transparent text-gray-400'}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 🚀 Final Actions */}
                            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-2xl md:rounded-[2.5rem] p-5 md:p-10 shadow-2xl space-y-5 md:space-y-8">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8">
                                    <div className="flex flex-col gap-3 md:gap-4 w-full md:w-auto">
                                        <label className="text-[10px] md:text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest px-1 text-left">ជំម្រើសនៃការបង្ហោះ</label>
                                        <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl md:rounded-[1.5rem] w-full md:w-fit border border-gray-200 dark:border-white/5">
                                            {[
                                                { id: 'now', label: 'ផុសឥឡូវ', icon: Zap },
                                                { id: 'schedule', label: 'កក់ពេល', icon: Calendar }
                                            ].map(mode => (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => setPublishMode(mode.id)}
                                                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 md:gap-3 px-3 md:px-6 py-2.5 md:py-3 rounded-lg md:rounded-2xl text-[9px] md:text-sm font-black uppercase tracking-widest transition-all ${publishMode === mode.id
                                                        ? "bg-white dark:bg-gray-800 text-blue-600 shadow-md border border-gray-100 dark:border-white/10"
                                                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
                                                >
                                                    <mode.icon size={12} md:size={14} />
                                                    {mode.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {publishMode === 'schedule' && (
                                            <motion.div
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                className="w-full md:w-72"
                                            >
                                                <label className="text-[10px] md:text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-2 px-1 text-left">កំណត់ពេលវេលាបង្ហោះ</label>
                                                <div className="relative group">
                                                    <input
                                                        type="datetime-local"
                                                        value={scheduleTime}
                                                        onChange={(e) => setScheduleTime(e.target.value)}
                                                        className="w-full bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-xl px-4 py-3.5 text-xs md:text-sm font-bold outline-none focus:border-blue-500 transition-all"
                                                    />
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-blue-500 transition-colors">
                                                        <Clock size={14} md:size={16} />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="w-full md:w-auto">
                                        <Button
                                            onClick={handleSubmit}
                                            isLoading={isSubmitting}
                                            className={`w-full md:w-auto md:px-20 h-14 md:h-20 rounded-xl md:rounded-[2rem] text-xs md:text-base font-black uppercase tracking-widest transition-all active:scale-[0.97] shadow-xl ${publishMode === 'schedule'
                                                    ? "bg-indigo-600 text-white shadow-indigo-500/20"
                                                    : "bg-blue-600 text-white shadow-blue-500/20"
                                                }`}
                                        >
                                            {publishMode === 'schedule' ? "កក់ពេលផុស" : "បង្ហោះឥឡូវ"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="queue"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                            className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-2xl md:rounded-3xl p-5 md:p-10 shadow-xl"
                        >
                            <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-6 md:mb-8 tracking-tighter uppercase">បញ្ជីកំពុងដំណើរការ</h2>
                            {queue.length === 0 ? (
                                <div className="py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-[9px] md:text-[10px]">No active protocols in terminal.</div>
                            ) : (
                                <div className="space-y-3 md:space-y-4">
                                    {queue.map(post => (
                                        <div key={post.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-6 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-xl md:rounded-2xl gap-4">
                                            <div className="flex items-center gap-3 md:gap-4">
                                                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-500/10 rounded-lg md:rounded-xl flex items-center justify-center text-blue-600 shrink-0"><Clock size={18} md:size={20} /></div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] md:text-xs font-black text-gray-900 dark:text-white uppercase truncate">{new Date(post.scheduledAt).toLocaleString()}</p>
                                                    <p className="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">ស្ថានភាព: កំពុងដំណើរការ</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => cancelScheduledPost(post.id)}
                                                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all w-full sm:w-auto"
                                            >
                                                <Trash2 size={14} md:size={16} />
                                                <span className="text-[9px] md:text-[10px] font-black uppercase">លុបចោល</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 🎬 Full Screen Video Preview Modal */}
            <AnimatePresence>
                {previewVideoModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
                        onClick={() => setPreviewVideoModal(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative max-w-5xl max-h-[90vh] w-full bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <video
                                src={previewVideoModal}
                                controls
                                autoPlay
                                playsInline
                                preload="auto"
                                className="w-full h-full max-h-[90vh] object-contain"
                            />
                            <button
                                onClick={() => setPreviewVideoModal(null)}
                                className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all z-10"
                            >
                                <X size={20} />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hidden Input for Manual Uploads */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
                accept="video/*,image/*"
                multiple
            />
        </DashboardLayout>
    );
}
