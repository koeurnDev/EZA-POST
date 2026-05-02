import React, { useState, useEffect, useRef } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Upload, Link as LinkIcon, Image as ImageIcon, Lock, X, Cloud, Check, AlertCircle, Calendar, Clock, Layers, Video, Plus, Trash2, GripVertical, ChevronDown, Sparkles, Activity, Share2, Youtube, Instagram, Facebook, Zap, Shield, Wand2 } from "lucide-react";
import apiUtils, { fetchCsrfToken } from "../utils/apiUtils";
import { saveDraftFile, getDraftFile, clearDraftFile } from "../utils/draftDB";
import { useAuth } from "../hooks/useAuth";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import { useDropzone } from "react-dropzone";
import { Reorder, motion, AnimatePresence } from "framer-motion";
import { generateThumbnailFromVideo, dataURLtoFile } from "../utils/videoUtils";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/api$/, "");

export default function Post() {
    const MotionDiv = motion.div;
    const MotionAnimatePresence = AnimatePresence;
    const MotionReorderGroup = Reorder.Group;
    const MotionReorderItem = Reorder.Item;
    const { user } = useAuth();

    const [postFormat, setPostFormat] = useState("carousel");
    const [videoTab, setVideoTab] = useState("upload");

    const [platforms, setPlatforms] = useState({
        facebook: true,
        youtube: false,
        tiktok: false,
        instagram: false
    });

    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
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
                    if (parsed.selectedPages) setSelectedPages(parsed.selectedPages);

                    if (parsed.cachedPage) {
                        setAvailablePages(prev => {
                            if (prev.some(p => p.id === parsed.cachedPage.id)) return prev;
                            return [parsed.cachedPage, ...prev];
                        });
                    }
                }

                const savedVideo = await getDraftFile("draft_video");
                if (savedVideo) {
                    setFile(savedVideo);
                    setPreviewUrl(URL.createObjectURL(savedVideo));
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
                caption, headline, targetLink, postFormat, selectedPages, cachedPage
            };
            localStorage.setItem("postDraft", JSON.stringify(draftData));

            if (file) await saveDraftFile("draft_video", file);
            else await clearDraftFile("draft_video");

        }, 1000);
        return () => clearTimeout(saveTimer);
    }, [caption, headline, targetLink, postFormat, selectedPages, file, isDraftLoaded, availablePages]);

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

    const handlePageSelection = (pageId) => {
        setSelectedPages([pageId]);
        const pageObj = availablePages.find(p => p.id === pageId);
        if (pageObj) {
            setHeadline(pageObj.name);
            setTargetLink(pageObj.link || `https://facebook.com/${pageObj.id}`);
        }
    };

    useEffect(() => {
        if (postFormat !== 'carousel') return;

        setMediaItems(prev => {
            const currentVideo = (file || previewUrl) ? {
                id: 'video-main',
                type: 'video',
                preview: previewUrl || (file ? URL.createObjectURL(file) : null),
                file: file,
                url: previewUrl
            } : null;

            if (prev.length === 0) return currentVideo ? [currentVideo] : [];

            const prevVideoIndex = prev.findIndex(item => item.type === 'video');
            let newOrder = [...prev];

            if (currentVideo) {
                if (prevVideoIndex !== -1) newOrder[prevVideoIndex] = currentVideo;
                else newOrder.unshift(currentVideo);
            } else if (prevVideoIndex !== -1) {
                newOrder.splice(prevVideoIndex, 1);
            }

            const selectedPageId = selectedPages[0];
            if (newOrder.some(i => i.type === 'video') && selectedPageId) {
                const pageObj = availablePages.find(p => p.id === selectedPageId);
                if (pageObj) {
                    const pageCardIndex = newOrder.findIndex(i => i.isPageCard);
                    const pageCard = {
                        id: 'card-page-auto',
                        type: 'image',
                        preview: pageObj.picture,
                        file: null,
                        imageUrl: pageObj.picture,
                        isPageCard: true
                    };

                    if (pageCardIndex !== -1) {
                        newOrder[pageCardIndex] = pageCard;
                        if (pageCardIndex !== 1 && newOrder.length > 1) {
                            newOrder.splice(pageCardIndex, 1);
                            newOrder.splice(1, 0, pageCard);
                        }
                    } else {
                        newOrder.splice(1, 0, pageCard);
                    }
                }
            } else {
                newOrder = newOrder.filter(i => !i.isPageCard);
            }

            return newOrder;
        });
    }, [file, previewUrl, postFormat, selectedPages, availablePages]);

    const handleThumbnailChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setThumbnail(selectedFile);
            setThumbnailPreview(URL.createObjectURL(selectedFile));
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) validateAndSetVideo(selectedFile);
    };

    const validateAndSetVideo = (selectedFile) => {
        if (!selectedFile.type.startsWith("video/")) return toast.error("Invalid media type.");
        if (selectedFile.size > 500 * 1024 * 1024) return toast.error("Payload too heavy (>500MB).");

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
            const token = localStorage.getItem("token");
            const response = await fetch(`${API_BASE}/api/posts/tiktok/fetch`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ url: tiktokUrl })
            });
            const data = await response.json();
            if (data.success) {
                setPreviewUrl(data.video.url);
                setFile(null);
                toast.success("Payload decrypted.", { id: toastId });
            } else throw new Error(data.error);
        } catch (err) { toast.error("Interception failed.", { id: toastId }); }
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
            else if (previewUrl) formData.append("videoUrl", previewUrl);

            if (thumbnail) formData.append("thumbnail", thumbnail);
            if (rightSideImage) formData.append("rightSideImage", rightSideImage);
            if (scheduleTime) formData.append("scheduleTime", scheduleTime);
            if (staggerDelay) formData.append("staggerDelay", staggerDelay);
            formData.append("aiOptions", JSON.stringify(aiOptions));

            let endpoint = `${API_BASE}/api/posts`;
            if (postFormat === 'carousel') {
                endpoint = `${API_BASE}/api/posts/mixed-carousel`;
                const cardsPayload = mediaItems.map(item => ({
                    type: item.type,
                    headline,
                    description: cardDescription || "Swipe to see more",
                    cta,
                    isPageCard: item.isPageCard,
                    imageUrl: item.imageUrl
                }));
                formData.append("carouselCards", JSON.stringify(cardsPayload));
            }

            const token = localStorage.getItem("token");
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                toast.success("Distribution successful.", { id: toastId });
                setFile(null); setPreviewUrl(null); setTiktokUrl(""); setMediaItems([]);
                localStorage.removeItem("postDraft");
            } else throw new Error(data.error);
        } catch (err) { toast.error("Distribution failure.", { id: toastId }); }
        finally { setIsSubmitting(false); }
    };

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-6 py-10 pb-32">
                {/* Header */}
                <div className="mb-12">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-black text-blue-500 uppercase tracking-widest">
                            Content Orchestrator
                        </div>
                    </div>
                    <h1 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">
                        Broadcast <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Protocol.</span>
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Left Column: Form */}
                    <div className="lg:col-span-8 space-y-8">
                        
                        {/* Platform & Format Selector */}
                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-10 shadow-2xl shadow-black/5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4 px-1">1. Destination Nodes</label>
                                    <div className="grid grid-cols-4 gap-3">
                                        {[
                                            { id: 'facebook', icon: Facebook, color: 'blue' },
                                            { id: 'youtube', icon: Youtube, color: 'red' },
                                            { id: 'tiktok', icon: Zap, color: 'black' },
                                            { id: 'instagram', icon: Instagram, color: 'pink' }
                                        ].map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => togglePlatform(p.id)}
                                                className={`h-16 rounded-2xl border flex items-center justify-center transition-all ${platforms[p.id] ? `bg-${p.color}-500/10 border-${p.color}-500/20 text-${p.color}-500 shadow-xl shadow-${p.color}-500/5` : 'bg-gray-50 dark:bg-black border-gray-100 dark:border-white/5 text-gray-400'}`}
                                            >
                                                <p.icon size={24} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4 px-1">2. Architecture</label>
                                    <div className="flex bg-gray-50 dark:bg-black p-1.5 rounded-2xl border border-gray-100 dark:border-white/5">
                                        <button
                                            onClick={() => setPostFormat('carousel')}
                                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${postFormat === 'carousel' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-lg' : 'text-gray-400'}`}
                                        >
                                            Carousel
                                        </button>
                                        <button
                                            onClick={() => setPostFormat('single')}
                                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${postFormat === 'single' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-lg' : 'text-gray-400'}`}
                                        >
                                            Single
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Caption Area */}
                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-10 shadow-2xl shadow-black/5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4 px-1">3. Content Narrative</label>
                            <textarea
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="Construct your engagement payload..."
                                className="w-full h-40 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-[2rem] p-6 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-gray-900 dark:text-white resize-none"
                            />
                            <div className="flex justify-end mt-2 px-2">
                                <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">{caption.length} / 2200</span>
                            </div>
                        </div>

                        {/* Media Section */}
                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-10 shadow-2xl shadow-black/5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-8 px-1">4. Visual Data Payload</label>
                            
                            <div className="space-y-10">
                                {postFormat === 'single' ? (
                                    <div className="max-w-xl mx-auto">
                                        <div className="flex gap-2 mb-8 p-1.5 bg-gray-50 dark:bg-black rounded-2xl border border-gray-100 dark:border-white/5">
                                            <button onClick={() => setVideoTab('upload')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${videoTab === 'upload' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-lg' : 'text-gray-400'}`}>Upload</button>
                                            <button onClick={() => setVideoTab('tiktok')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${videoTab === 'tiktok' ? 'bg-white dark:bg-gray-800 text-pink-600 shadow-lg' : 'text-gray-400'}`}>TikTok</button>
                                        </div>

                                        {(file || previewUrl) ? (
                                            <div className="relative aspect-video bg-black rounded-[2rem] overflow-hidden group shadow-2xl">
                                                <video src={previewUrl} controls className="w-full h-full object-contain" />
                                                <button onClick={() => { setFile(null); setPreviewUrl(null); }} className="absolute top-4 right-4 p-3 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-xl">
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {videoTab === 'upload' ? (
                                                    <div onClick={() => fileInputRef.current?.click()} className="h-64 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-all group">
                                                        <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
                                                        <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                                                            <Upload size={32} />
                                                        </div>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Initialize Upload</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-3">
                                                        <input type="text" value={tiktokUrl} onChange={(e) => setTiktokUrl(e.target.value)} placeholder="Paste identity link..." className="flex-1 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-2xl px-6 py-4 font-bold outline-none focus:border-pink-500 transition-all" />
                                                        <button onClick={handleLoadTiktok} className="px-8 bg-pink-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-pink-500/20">Sync</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-10">
                                        {/* Carousel Logic UI */}
                                        {!mediaItems.some(i => i.type === 'video') ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div onClick={() => fileInputRef.current?.click()} className="h-48 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                                                    <input type="file" accept="video/*" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
                                                    <Upload size={24} className="text-blue-500 mb-3" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Media Upload</span>
                                                </div>
                                                <div onClick={() => { const u = prompt("Tiktok Link:"); if(u) { setTiktokUrl(u); handleLoadTiktok(); }}} className="h-48 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                                                    <Zap size={24} className="text-pink-500 mb-3" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Digital Intercept</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col md:flex-row gap-10">
                                                <div className="w-full md:w-64 aspect-[9/16] bg-black rounded-[2rem] overflow-hidden relative group shadow-2xl">
                                                    <video src={mediaItems.find(i => i.type === 'video').preview} className="w-full h-full object-cover" />
                                                    <button onClick={() => { setFile(null); setPreviewUrl(null); setMediaItems([]); }} className="absolute top-4 right-4 p-3 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Trash2 size={20} />
                                                    </button>
                                                </div>
                                                <div className="flex-1 space-y-8">
                                                    <div className="p-8 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-[2rem]">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4 px-1">Display Identity</label>
                                                        <div className="flex items-center gap-6">
                                                            <div className="w-24 h-24 bg-white dark:bg-gray-900 rounded-[1.5rem] border border-gray-100 dark:border-white/5 overflow-hidden shadow-lg">
                                                                {thumbnailPreview ? <img src={thumbnailPreview} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-black uppercase text-gray-300">Auto</div>}
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-[10px] font-bold text-gray-400 mb-4 uppercase tracking-widest">Override default visual identity.</p>
                                                                <label className="px-6 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer shadow-sm hover:shadow-md transition-all">
                                                                    Upload Visual
                                                                    <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                                                                </label>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Intelligence & Preview */}
                    <div className="lg:col-span-4 space-y-8">
                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-10 shadow-2xl shadow-black/5">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-600">
                                    <Wand2 size={20} />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Neural MMO</h3>
                            </div>
                            <div className="space-y-4">
                                {[
                                    { id: 'safeMode', label: 'Hash Randomizer', sub: 'Bypass MD5 filtering' },
                                    { id: 'pitchShift', label: 'Neural Pitch', sub: 'Modify audio signature' },
                                    { id: 'flip', label: 'Spatial Flip', sub: 'Mirror visual data' }
                                ].map(opt => (
                                    <label key={opt.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-2xl cursor-pointer hover:border-purple-500/20 transition-all group">
                                        <div>
                                            <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-tight">{opt.label}</p>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{opt.sub}</p>
                                        </div>
                                        <div className={`w-12 h-6 rounded-full transition-all relative ${aiOptions[opt.id] ? 'bg-purple-600' : 'bg-gray-200 dark:bg-white/10'}`}>
                                            <input type="checkbox" checked={aiOptions[opt.id]} onChange={(e) => setAiOptions(p => ({...p, [opt.id]: e.target.checked}))} className="hidden" />
                                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${aiOptions[opt.id] ? 'left-7' : 'left-1'}`} />
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* List Preview */}
                        {postFormat === 'carousel' && (
                            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-10 shadow-2xl shadow-black/5">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-6 px-1">Structure Preview</label>
                                <div className="space-y-3">
                                    {mediaItems.length === 0 ? (
                                        <div className="h-40 border-2 border-dashed border-gray-100 dark:border-white/5 rounded-[2rem] flex items-center justify-center text-[10px] font-black uppercase text-gray-300">Empty Stack</div>
                                    ) : (
                                        <MotionReorderGroup axis="y" values={mediaItems} onReorder={setMediaItems} className="space-y-3">
                                            {mediaItems.map((item, idx) => (
                                                <MotionReorderItem key={item.id} value={item}>
                                                    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-2xl cursor-grab active:cursor-grabbing">
                                                        <div className="w-12 h-12 bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm">
                                                            <img src={item.preview} className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tight">Card {idx + 1}</p>
                                                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest truncate max-w-[120px]">{item.type === 'video' ? 'Identity Video' : 'Page Profile'}</p>
                                                        </div>
                                                        <GripVertical size={14} className="text-gray-300" />
                                                    </div>
                                                </MotionReorderItem>
                                            ))}
                                        </MotionReorderGroup>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Fixed Footer Actions */}
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-7xl px-8 py-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-3xl border border-gray-100 dark:border-white/5 rounded-[3rem] shadow-2xl z-50 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex flex-col md:flex-row items-center gap-8 w-full md:w-auto">
                        <div className="w-full md:w-64">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Chronological Slot</label>
                            <input type="datetime-local" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500 transition-all" />
                        </div>
                        {selectedPages.length > 1 && (
                            <div className="w-full md:w-48">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Protocol Delay</label>
                                <select value={staggerDelay} onChange={(e) => setStaggerDelay(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold outline-none">
                                    <option value={0}>None</option>
                                    <option value={5}>5m Delay</option>
                                    <option value={15}>15m Delay</option>
                                    <option value={30}>30m Delay</option>
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4 w-full md:w-auto">
                        <Button
                            onClick={handleSubmit}
                            isLoading={isSubmitting}
                            className={`flex-1 md:px-12 h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 ${scheduleTime ? 'bg-indigo-600 shadow-indigo-500/20' : 'bg-blue-600 shadow-blue-500/20'}`}
                        >
                            {scheduleTime ? <Clock size={16} /> : <Check size={16} />}
                            {scheduleTime ? "Queue Strategy" : "Execute Protocol"}
                        </Button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
