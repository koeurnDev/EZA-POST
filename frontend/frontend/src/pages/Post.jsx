import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import DashboardLayout from "../layouts/DashboardLayout";
import {
    Upload, Link as LinkIcon, X, Calendar, Clock, Layers, Plus, Trash2,
    ChevronDown, Share2, Zap, Volume2, VolumeX, MessageSquare, Loader2,
    Search, Languages, ExternalLink, RefreshCw, Image as ImageIcon, Video
} from "lucide-react";
import apiUtils from "../utils/apiUtils";
import { postsAPI } from "../utils/api";
import { clearDraftFile } from "../utils/draftDB";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import { generateThumbnailFromVideo, generateGalleryFromVideo, dataURLtoFile } from "../utils/videoUtils";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/api$/, "");

const POST_FORMATS = [
    { id: "text_link", label: "📝 Text / Link", accept: "image/*" },
    { id: "photos", label: "🖼️ Photos (1-10)", multiImage: true, accept: "image/*" },
    { id: "video", label: "🎥 Videos", accept: "video/*", useBusinessSuite: true },
    { id: "reels", label: "📱 Reels", accept: "video/*", useBusinessSuite: true },
    { id: "video_pe", label: "🎠 Video PE", needsAdAccount: true, accept: "video/*" },
    { id: "photo_pe", label: "🗂️ Photo PE", multiImage: true, needsAdAccount: true, accept: "image/*" },
    { id: "video_cta", label: "🎬 Video CTA", needsAdAccount: true, accept: "video/*" },
    { id: "photo_cta", label: "🏷️ Photo CTA", needsAdAccount: true, accept: "image/*" },
    { id: "instant_experience", label: "⚡ Instant Exp", needsAdAccount: true, accept: "image/*" },
    { id: "live", label: "🔴 Live Stream", route: "/tools/live-stream" },
];

const CTA_OPTIONS = [
    { value: "LEARN_MORE", label: "ស្វែងយល់ (Learn More)" },
    { value: "SHOP_NOW", label: "ទិញឥឡូវ (Shop Now)" },
    { value: "SEND_MESSAGE", label: "ផ្ញើសារ (Send Message)" },
    { value: "SIGN_UP", label: "ចុះឈ្មោះ (Sign Up)" },
    { value: "BOOK_NOW", label: "កក់ទុក (Book Now)" },
    { value: "WATCH_MORE", label: "មើលបន្ថែម (Watch More)" },
    { value: "CALL_NOW", label: "ហៅទូរស័ព្ទ (Call Now)" },
    { value: "FOLLOW", label: "តាមដាន (Follow)" },
];

function normalizePostFormat(fmt) {
    if (fmt === "single") return "video";
    if (fmt === "carousel") return "video_pe";
    if (POST_FORMATS.some((f) => f.id === fmt && !f.route)) return fmt;
    return "video";
}

export default function Post() {
    const location = useLocation();
    const navigate = useNavigate();

    const [postFormat, setPostFormat] = useState(() => normalizePostFormat(location.state?.postFormat || "video"));

    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [rawVideoUrl, setRawVideoUrl] = useState(null);
    const [tiktokUrl, setTiktokUrl] = useState("");
    const [mediaItems, setMediaItems] = useState([]);
    const [multiImages, setMultiImages] = useState([]);
    const [thumbnail, setThumbnail] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const [rightSideImage, setRightSideImage] = useState(null);
    const [rightSideImagePreview, setRightSideImagePreview] = useState(null);

    const [headline, setHeadline] = useState("");
    const [targetLink, setTargetLink] = useState("");
    const [cardDescription, setCardDescription] = useState("");
    const [cta, setCta] = useState("LEARN_MORE");
    const [adAccounts, setAdAccounts] = useState([]);
    const [selectedAdAccount, setSelectedAdAccount] = useState("");
    const [hasAdsToken, setHasAdsToken] = useState(false);
    const [isDarkPost, setIsDarkPost] = useState(false);
    const [canvases, setCanvases] = useState([]);
    const [canvasId, setCanvasId] = useState("");
    const [loadingCanvases, setLoadingCanvases] = useState(false);

    const [caption, setCaption] = useState("");
    const [carouselCtaText, setCarouselCtaText] = useState("ចុច Like Page ដើម្បីបាន\nវីដេអូថ្មីៗ");
    const [selectedPages, setSelectedPages] = useState([]);
    const [availablePages, setAvailablePages] = useState([]);
    const [isLoadingPages, setIsLoadingPages] = useState(true);
    const [scheduleTime, setScheduleTime] = useState("");

    const [showAdvanced, setShowAdvanced] = useState(false);
    const [aiOptions, setAiOptions] = useState({
        safeMode: false,
        pitchShift: false,
        flip: false
    });

    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingVideo, setIsLoadingVideo] = useState(false);
    const [isDraftLoaded, setIsDraftLoaded] = useState(false);
    const [publishMode, setPublishMode] = useState("now");

    const [activeView, setActiveView] = useState("create");
    const [galleryOptions, setGalleryOptions] = useState([]);
    const [queue, setQueue] = useState([]);
    const [isLoadingQueue, setIsLoadingQueue] = useState(false);
    const [previewVideoModal, setPreviewVideoModal] = useState(null);
    const [autoReplyBot, setAutoReplyBot] = useState(false);
    const [videoData, setVideoData] = useState(null);
    const [videoError, setVideoError] = useState(false);
    const [isFixed, setIsFixed] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isPageSelectorOpen, setIsPageSelectorOpen] = useState(false);
    const [isPreviewMuted, setIsPreviewMuted] = useState(true);
    const [extensionInstalled, setExtensionInstalled] = useState(false);
    const [extensionVersion, setExtensionVersion] = useState("");
    const [isOpeningComposer, setIsOpeningComposer] = useState(false);

    const carouselRef = useRef(null);
    const fileInputRef = useRef(null);

    // 🎬 Capture Video and Subtitles passed from SubtitleStudio
    useEffect(() => {
        if (location.state?.videoUrl) {
            setPreviewUrl(location.state.videoUrl);
            if (location.state.rawVideoUrl) setRawVideoUrl(location.state.rawVideoUrl);
            if (location.state.suggestedCaption && !caption) {
                setCaption(location.state.suggestedCaption);
            }
            toast.success("បានទទួលវីដេអូពី Subtitle Studio រួចរាល់! 🎉", { duration: 4000 });
        }
    }, [location.state]);

    useEffect(() => {
        const loadDraft = async () => {
            try {
                const savedPrefs = localStorage.getItem("postPreferences");
                if (savedPrefs) {
                    const prefs = JSON.parse(savedPrefs);
                    if (prefs.carouselCtaText) setCarouselCtaText(prefs.carouselCtaText);
                    if (prefs.cta) setCta(prefs.cta);
                }

                const savedDraft = localStorage.getItem("postDraft");
                if (savedDraft) {
                    const parsed = JSON.parse(savedDraft);
                    setCaption(parsed.caption || "");
                    setHeadline(parsed.headline || "");
                    setTargetLink(parsed.targetLink || "");
                    if (parsed.carouselCtaText) setCarouselCtaText(parsed.carouselCtaText);
                    if (parsed.cta) setCta(parsed.cta);
                    if (Array.isArray(parsed.selectedPages)) setSelectedPages(parsed.selectedPages);
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
        const saveTimer = setTimeout(() => {
            const selectedPageId = selectedPages[0];
            const cachedPage = availablePages.find(p => p.id === selectedPageId);

            localStorage.setItem("postDraft", JSON.stringify({
                caption, headline, targetLink, postFormat, selectedPages, cachedPage, carouselCtaText, cta, autoReplyBot
            }));
            localStorage.setItem("postPreferences", JSON.stringify({ carouselCtaText, cta }));
        }, 1500);
        return () => clearTimeout(saveTimer);
    }, [caption, headline, targetLink, postFormat, selectedPages, isDraftLoaded, availablePages, carouselCtaText, cta, autoReplyBot]);

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoadingPages(true);
            try {
                const pagesRes = await apiUtils.getUserPages();
                if (pagesRes.data.success) {
                    const accounts = pagesRes.data.accounts || [];
                    const fetchedAdAccounts = Array.isArray(pagesRes.data.adAccounts) ? pagesRes.data.adAccounts : [];
                    setAvailablePages(accounts);
                    setAdAccounts(fetchedAdAccounts);
                    setHasAdsToken(Boolean(pagesRes.data.hasAdsToken));
                    if (fetchedAdAccounts.length > 0) {
                        setSelectedAdAccount((prev) => prev || fetchedAdAccounts[0].id);
                    }
                    if (accounts.length > 0) {
                        const enabledPages = accounts.filter(p => p.isSelected !== false && !p.isProfile);
                        setSelectedPages(prev => {
                            const validPrev = prev.filter(id => accounts.some(a => a.id === id));
                            if (validPrev.length > 0) return validPrev;
                            if (enabledPages.length > 0) return enabledPages.map(p => p.id);
                            return [accounts[0].id];
                        });
                        const firstPage = enabledPages[0] || accounts.find((a) => !a.isProfile) || accounts[0];
                        setHeadline(prev => prev || firstPage.name);
                        setTargetLink(prev => prev || firstPage.link || `https://facebook.com/${firstPage.id}`);
                    }
                }
            } catch (err) {
                const details = err?.details || err?.response?.data;
                toast.error(details?.error || err?.message || "មិនអាចទាញយកបញ្ជីផេកបានទេ");
            } finally {
                setIsLoadingPages(false);
            }
        };
        fetchInitialData();

        const checkExt = () => {
            if (document.documentElement.getAttribute("data-eza-extension") === "installed") {
                setExtensionInstalled(true);
                setExtensionVersion(document.documentElement.getAttribute("data-eza-extension-version") || "");
            }
        };
        checkExt();
        const onExtMsg = (event) => {
            if (event.source === window && event.data?.source === "EZA_EXTENSION" && event.data?.action === "EXTENSION_STATUS") {
                if (event.data.installed) {
                    setExtensionInstalled(true);
                    if (event.data.version) setExtensionVersion(String(event.data.version));
                }
            }
        };
        window.addEventListener("message", onExtMsg);
        window.postMessage({ source: "EZA_WEB_APP", action: "CHECK_EXTENSION" }, "*");
        const extPoll = setInterval(checkExt, 1500);
        return () => {
            window.removeEventListener("message", onExtMsg);
            clearInterval(extPoll);
        };
    }, []);

    const fetchQueue = useCallback(async () => {
        setIsLoadingQueue(true);
        try {
            const data = await postsAPI.getQueue();
            if (data?.success) {
                setQueue(Array.isArray(data.posts) ? data.posts : []);
            }
        } catch (err) {
            console.warn("Queue fetch failed:", err);
        } finally {
            setIsLoadingQueue(false);
        }
    }, []);

    useEffect(() => {
        if (activeView === "queue") {
            fetchQueue();
        }
    }, [activeView, fetchQueue]);

    useEffect(() => {
        if (postFormat !== "instant_experience" || !selectedPages[0]) return;
        setLoadingCanvases(true);
        apiUtils.getPageCanvases(selectedPages[0])
            .then((res) => {
                const list = Array.isArray(res.data?.canvases) ? res.data.canvases : [];
                setCanvases(list);
                if (list.length > 0) setCanvasId((prev) => prev || list[0].id);
            })
            .catch(() => setCanvases([]))
            .finally(() => setLoadingCanvases(false));
    }, [postFormat, selectedPages]);

    const handleClearPreview = async () => {
        setFile(null);
        setPreviewUrl(null);
        setRawVideoUrl(null);
        setTiktokUrl("");
        setMediaItems([]);
        setMultiImages([]);
        setThumbnail(null);
        setThumbnailPreview(null);
        setRightSideImage(null);
        setRightSideImagePreview(null);
        setGalleryOptions([]);
        setVideoData(null);
        setVideoError(false);
        setIsFixed(false);

        try {
            await Promise.all([
                clearDraftFile("draft_video"),
                clearDraftFile("draft_thumb"),
                clearDraftFile("draft_card2")
            ]);
        } catch (e) { console.warn("Failed to clear draft files", e); }

        toast.success("បានសម្អាតមាតិកាសាកល្បងរួចរាល់");
    };

    const handlePageSelection = (pageId) => {
        setSelectedPages(prev => {
            if (prev.includes(pageId)) {
                return prev.filter(id => id !== pageId);
            }
            return [...prev, pageId];
        });

        const pageObj = availablePages.find(p => p.id === pageId);
        if (pageObj && selectedPages.length === 0) {
            setHeadline(pageObj.name);
            setTargetLink(pageObj.link || `https://facebook.com/${pageObj.id}`);
        }
    };

    const toggleAllPages = () => {
        if (selectedPages.length === availablePages.length) {
            setSelectedPages(availablePages.length > 0 ? [availablePages[0].id] : []);
        } else {
            setSelectedPages(availablePages.map(p => p.id));
        }
    };

    // Build preview items based on postFormat
    useEffect(() => {
        setMediaItems(() => {
            const items = [
                {
                    id: "video-main",
                    type: file?.type?.startsWith("image/") ? "image" : "video",
                    preview: previewUrl || (file ? URL.createObjectURL(file) : null),
                    file,
                    url: previewUrl,
                    isPlaceholder: !(file || previewUrl)
                }
            ];

            if (postFormat === "video_pe") {
                items.push({
                    id: "right-side-image",
                    type: "image",
                    preview: rightSideImagePreview,
                    file: rightSideImage,
                    isRightSide: true,
                    isPlaceholder: !rightSideImagePreview
                });
                items.push({
                    id: "card-destination-final",
                    type: "image",
                    isPageCard: true,
                    isPlaceholder: false
                });
            }

            return items;
        });
    }, [postFormat, file, previewUrl, rightSideImage, rightSideImagePreview]);

    const addMultiImages = (fileList) => {
        const picked = Array.from(fileList || []).filter((f) => f.type?.startsWith("image/"));
        if (picked.length === 0) {
            return toast.error("សូមជ្រើសរើសឯកសាររូបភាព (JPG, PNG, WEBP) ប៉ុណ្ណោះ");
        }
        const oversized = picked.find((f) => f.size > 90 * 1024 * 1024);
        if (oversized) return toast.error("រូបភាពមានទំហំធំពេក (អតិបរមា 90MB)");
        setMultiImages((prev) => {
            const remaining = Math.max(0, 10 - prev.length);
            const additions = picked.slice(0, remaining).map((f, i) => ({
                id: `img-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
                file: f,
                preview: URL.createObjectURL(f),
                headline: headline || "",
                link: targetLink || "",
                cta: cta || "LEARN_MORE",
            }));
            if (picked.length > remaining) {
                toast("អាចដាក់រូបភាពបានច្រើនបំផុត ១០ សន្លឹក!", { icon: "ℹ️" });
            }
            return [...prev, ...additions];
        });
    };

    const handleFileChange = (e) => {
        if (e.target.files?.length > 0 && (postFormat === "photos" || postFormat === "photo_pe")) {
            addMultiImages(e.target.files);
            e.target.value = "";
            return;
        }
        const selectedFile = e.target.files?.[0];
        if (selectedFile) validateAndSetMedia(selectedFile);
        e.target.value = "";
    };

    const validateAndSetMedia = (selectedFile) => {
        const isVideo = selectedFile.type.startsWith("video/");
        const isImage = selectedFile.type.startsWith("image/");

        if (!isVideo && !isImage) return toast.error("សូមជ្រើសរើសឯកសារវីដេអូ ឬ រូបភាពប៉ុណ្ណោះ");
        if (selectedFile.size > 90 * 1024 * 1024) return toast.error("ទំហំឯកសារធំពេក (អតិបរមា 90MB)");

        if (isImage) {
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setTiktokUrl("");
            setThumbnail(null);
            setThumbnailPreview(null);
            toast.success("បានដាក់បញ្ចូលរូបភាពរួចរាល់!");
            return;
        }

        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = async () => {
            window.URL.revokeObjectURL(video.src);
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setTiktokUrl("");

            try {
                const thumbDataUrl = await generateThumbnailFromVideo(selectedFile);
                setThumbnailPreview(thumbDataUrl);
                setThumbnail(dataURLtoFile(thumbDataUrl, "thumbnail.jpg"));

                const frames = await generateGalleryFromVideo(selectedFile, 6);
                setGalleryOptions(frames);
                if (frames.length > 0 && !rightSideImagePreview) {
                    setRightSideImagePreview(frames[0]);
                    setRightSideImage(dataURLtoFile(frames[0], "card2-auto.jpg"));
                }
            } catch (e) { console.warn("Visual extraction failed", e); }

            setVideoError(false);
            setVideoData({ id: "upload", type: "video" });
            toast.success("បានដាក់បញ្ចូលវីដេអូរួចរាល់!");
        };
        video.src = URL.createObjectURL(selectedFile);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer?.files?.length > 0 && (postFormat === "photos" || postFormat === "photo_pe")) {
            addMultiImages(e.dataTransfer.files);
            return;
        }
        const dropped = e.dataTransfer?.files?.[0];
        if (dropped) validateAndSetMedia(dropped);
    };

    const handleLoadTiktok = async () => {
        if (!tiktokUrl.trim()) return toast.error("សូមបិទភ្ជាប់ Link វីដេអូ TikTok ជាមុនសិន!");
        setIsLoadingVideo(true);
        setVideoError(false);
        setIsFixed(false);
        const toastId = toast.loading("កំពុងទាញយកវីដេអូពី TikTok...");
        try {
            const response = await axios.post(`${API_BASE}/api/tools/tiktok/lookup`, { url: tiktokUrl }, { withCredentials: true });
            const data = response.data;
            if (data.success && data.video) {
                const directPlayUrl = data.video.no_watermark_url || data.video.playUrl || data.video.url || "";
                setVideoData({ ...data.video, url: directPlayUrl });
                setRawVideoUrl(data.video.rawPath || directPlayUrl || null);
                setFile(null);

                if (data.video.title && !caption) setCaption(data.video.title);
                if (data.video.title && !headline) setHeadline(data.video.title);

                if (data.video.type === "slideshow" && data.video.images?.length > 0) {
                    handleGenerateSlideshow(data.video);
                } else if (!directPlayUrl) {
                    throw new Error("មិនអាចទាញយកតំណវីដេអូ TikTok នេះបានទេ (សូមទាញយកជាឯកសារ MP4 រួច Upload)!");
                } else {
                    const streamUrl = `${API_BASE}/api/tools/tiktok/stream?id=${encodeURIComponent(data.video.id || "")}&url=${encodeURIComponent(directPlayUrl)}`;
                    setPreviewUrl(streamUrl);

                    if (data.video.cover) {
                        setThumbnailPreview(data.video.cover);
                        if (!rightSideImagePreview) setRightSideImagePreview(data.video.cover);
                        try {
                            const blobRes = await fetch(data.video.cover);
                            const blob = await blobRes.blob();
                            setThumbnail(new File([blob], "tiktok-thumb.jpg", { type: "image/jpeg" }));
                            if (!rightSideImage) {
                                setRightSideImage(new File([blob], "card2-tiktok.jpg", { type: "image/jpeg" }));
                            }
                        } catch (e) { console.warn("Failed to sync TikTok cover to file", e); }
                    } else {
                        try {
                            const thumbDataUrl = await generateThumbnailFromVideo(streamUrl);
                            setThumbnailPreview(thumbDataUrl);
                            setThumbnail(dataURLtoFile(thumbDataUrl, "thumbnail.jpg"));
                        } catch {}
                    }

                    try {
                        const frames = await generateGalleryFromVideo(streamUrl, 6);
                        setGalleryOptions(frames);
                        if (frames.length > 0 && !rightSideImagePreview) {
                            setRightSideImagePreview(frames[0]);
                            setRightSideImage(dataURLtoFile(frames[0], "card2-auto.jpg"));
                        }
                    } catch {}

                    toast.success("ទាញយកវីដេអូ TikTok រួចរាល់!", { id: toastId });
                }
            } else throw new Error(data.error);
        } catch (err) {
            toast.error(err.response?.data?.error || "មិនអាចទាញយកវីដេអូ TikTok បានទេ", { id: toastId });
        } finally {
            setIsLoadingVideo(false);
        }
    };

    const handleGenerateSlideshow = async (video) => {
        setIsLoadingVideo(true);
        const toastId = toast.loading("កំពុងបង្កើតវីដេអូ Slideshow...");
        try {
            const res = await axios.post(`${API_BASE}/api/tools/tiktok/combine`, {
                images: video.images,
                audio: video.audio,
                id: video.id,
                title: video.meta?.title
            }, { withCredentials: true });

            if (res.data.success) {
                const streamUrl = res.data.streamUrl || res.data.url;
                const combinedUrl = `${API_BASE}${streamUrl}`;
                setPreviewUrl(combinedUrl);

                if (res.data.path) {
                    setRawVideoUrl(res.data.path);
                } else if (streamUrl && streamUrl.includes("?")) {
                    const localPath = new URLSearchParams(streamUrl.split("?")[1]).get("path");
                    if (localPath) setRawVideoUrl(localPath);
                }

                setIsFixed(true);
                toast.success("បង្កើតវីដេអូជោគជ័យ!", { id: toastId });

                try {
                    const frames = await generateGalleryFromVideo(combinedUrl, 6);
                    setGalleryOptions(frames);
                } catch {}
            }
        } catch {
            toast.error("មិនអាចបង្កើត Slideshow បានទេ", { id: toastId });
        } finally {
            setIsLoadingVideo(false);
        }
    };

    const handleFixH265 = async (customVideoData) => {
        const targetData = customVideoData || videoData;
        if (!targetData?.id || isFixing) return;
        setIsFixing(true);
        try {
            const res = await axios.post(`${API_BASE}/api/tools/tiktok/compatible`, {
                id: targetData.id,
                url: targetData.url
            }, { withCredentials: true });

            if (res.data.success) {
                const fixedUrl = `${API_BASE}/api/tools/tiktok/stream?id=${targetData.id}&url=${encodeURIComponent(res.data.path)}`;
                setPreviewUrl(fixedUrl);
                setRawVideoUrl(res.data.path);
                setIsFixed(true);
                setVideoError(false);

                try {
                    const thumbDataUrl = await generateThumbnailFromVideo(fixedUrl);
                    setThumbnailPreview(thumbDataUrl);
                    setGalleryOptions(await generateGalleryFromVideo(fixedUrl, 6));
                } catch {}
            }
        } catch (err) {
            console.warn("Background optimization failed:", err.message);
        } finally {
            setIsFixing(false);
        }
    };

    const isExtensionAtLeastV205 = (ver) => {
        const parts = String(ver || "").split(".").map((n) => Number.parseInt(n, 10) || 0);
        const [maj = 0, min = 0, pat = 0] = parts;
        return maj > 2 || (maj === 2 && (min > 0 || pat >= 5));
    };

    const isExtensionAtLeastV230 = (ver) => {
        const parts = String(ver || "").split(".").map((n) => Number.parseInt(n, 10) || 0);
        const [maj = 0, min = 0] = parts;
        return maj > 2 || (maj === 2 && min >= 3);
    };

    const uploadMediaFileToEdge = async (mediaFile) => {
        const upForm = new FormData();
        upForm.append("media", mediaFile);
        const upRes = await axios.post(`${API_BASE}/api/upload/post-media`, upForm, {
            headers: { "Content-Type": "multipart/form-data" },
            withCredentials: true,
            timeout: 300000
        });
        if (!upRes.data?.success || !upRes.data?.url) {
            throw new Error(upRes.data?.error || "មិនអាចផ្ទុកឯកសារឡើង Edge Storage បានទេ");
        }
        return upRes.data.url;
    };

    const handlePublishAdCreativeViaExtension = async () => {
        setIsSubmitting(true);
        const toastId = toast.loading("កំពុងផ្ទុកឯកសារ និងបង្ហោះ PE / CTA ផ្ទាល់តាម Chrome Extension...");
        try {
            let uploadedVideoUrl = rawVideoUrl || (previewUrl && previewUrl.startsWith("https://") ? previewUrl : null);
            let uploadedImageUrl = null;
            if (file) {
                const url = await uploadMediaFileToEdge(file);
                if (file.type?.startsWith("image/")) uploadedImageUrl = url;
                else uploadedVideoUrl = url;
            }
            const uploadedThumbUrl = thumbnail ? await uploadMediaFileToEdge(thumbnail) : null;
            const uploadedRightUrl = rightSideImage ? await uploadMediaFileToEdge(rightSideImage) : null;

            let cardsPayload = [];
            if (postFormat === "video_pe") {
                cardsPayload = [
                    {
                        id: "video-main",
                        type: "video",
                        mediaUrl: uploadedVideoUrl,
                        headline: headline || "",
                        description: cardDescription || "Swipe to see more",
                        link: targetLink.trim(),
                        cta
                    },
                    ...(uploadedRightUrl
                        ? [
                              {
                                  id: "right-side-image",
                                  type: "image",
                                  mediaUrl: uploadedRightUrl,
                                  headline: carouselCtaText.replace(/\n/g, " "),
                                  description: "",
                                  link: targetLink.trim(),
                                  cta
                              }
                          ]
                        : []),
                    {
                        id: "card-destination-final",
                        type: "image",
                        isPageCard: true,
                        headline: "មើលច្រើនទៀតនៅ",
                        description: "FACEBOOK.COM",
                        link: targetLink.trim(),
                        cta: cta || "LEARN_MORE"
                    }
                ];
            } else if (postFormat === "photo_pe") {
                for (const [idx, img] of multiImages.entries()) {
                    const imgUrl = img.file ? await uploadMediaFileToEdge(img.file) : img.preview;
                    cardsPayload.push({
                        id: img.id || `photo-card-${idx}`,
                        type: "image",
                        mediaUrl: imgUrl,
                        headline: img.headline || headline || "",
                        description: cardDescription || "",
                        link: img.link || targetLink.trim() || "",
                        cta: img.cta || cta || "LEARN_MORE"
                    });
                }
            }

            const targetPages = selectedPages.map((id) => {
                const found = availablePages.find((p) => p.id === id);
                return { id, name: found?.name || "Facebook Page" };
            });

            toast.loading("កំពុងបង្ហោះទៅ Ads Manager / Facebook ផ្ទាល់ពី Browser...", { id: toastId });

            const extResult = await new Promise((resolve) => {
                const timer = setTimeout(() => {
                    window.removeEventListener("message", listener);
                    resolve({ ok: false, error: "Extension មិនឆ្លើយតប (Timeout) — សូម Reload Extension v2.3.0 ហើយ Refresh ទំព័រ!" });
                }, 120000);

                const listener = (event) => {
                    if (
                        event.source === window &&
                        event.data?.source === "EZA_EXTENSION" &&
                        event.data?.action === "PUBLISH_AD_CREATIVE_RESULT"
                    ) {
                        clearTimeout(timer);
                        window.removeEventListener("message", listener);
                        resolve(event.data);
                    }
                };
                window.addEventListener("message", listener);
                window.postMessage(
                    {
                        source: "EZA_WEB_APP",
                        action: "PUBLISH_AD_CREATIVE",
                        payload: {
                            format: postFormat,
                            adAccountId: selectedAdAccount || "",
                            pages: targetPages,
                            caption,
                            headline: headline.trim(),
                            description: cardDescription.trim(),
                            link: targetLink.trim(),
                            cta,
                            isDarkPost,
                            canvasId,
                            canvasUrl: postFormat === "instant_experience" ? targetLink.trim() : "",
                            videoUrl: uploadedVideoUrl,
                            imageUrl: uploadedImageUrl,
                            thumbnailUrl: uploadedThumbUrl,
                            cards: cardsPayload
                        }
                    },
                    "*"
                );
            });

            if (!extResult.ok) {
                throw new Error(extResult.error || "មិនអាចបង្ហោះ PE / CTA តាម Extension បានទេ");
            }

            toast.success(
                isDarkPost
                    ? `🎉 បានបង្កើត Dark Post (PE) ជោគជ័យ! (ID: ${extResult.storyId})`
                    : `🎉 បានបង្ហោះ PE / CTA ទៅ Facebook ជោគជ័យ!`,
                { id: toastId, duration: 6000 }
            );
            setFile(null);
            setPreviewUrl(null);
            setRawVideoUrl(null);
            setTiktokUrl("");
            setCaption("");
            setMediaItems([]);
            setMultiImages([]);
            setThumbnail(null);
            setThumbnailPreview(null);
            localStorage.removeItem("postDraft");
            await Promise.all([
                clearDraftFile("draft_video"),
                clearDraftFile("draft_thumb"),
                clearDraftFile("draft_card2")
            ]);
        } catch (err) {
            console.error("❌ In-browser PE/CTA publish error:", err);
            toast.error(err.response?.data?.error || err.message || "មិនអាចបង្ហោះ PE / CTA បានទេ", {
                id: toastId,
                duration: 8500
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const activeFormatMeta = POST_FORMATS.find((f) => f.id === postFormat) || POST_FORMATS[2];

    const handleSubmit = async () => {
        if (selectedPages.length === 0) {
            return toast.error("សូមជ្រើសរើសផេកយ៉ាងតិច ១ ដើម្បីបង្ហោះ!");
        }

        const hasSingleVideo = Boolean((file && file.type.startsWith("video/")) || rawVideoUrl || (previewUrl && !file?.type?.startsWith("image/")));
        const hasSingleImage = Boolean((file && file.type.startsWith("image/")) || (previewUrl && file?.type?.startsWith("image/")));

        if (postFormat === "reels" && !hasSingleVideo) {
            return toast.error("Facebook Reels តម្រូវឱ្យដាក់ឯកសារវីដេអូ (.mp4)!");
        }
        if (postFormat === "video" && !hasSingleVideo && !caption.trim()) {
            return toast.error("សូមដាក់វីដេអូ ឬសរសេរអត្ថបទជាមុនសិន!");
        }
        if (postFormat === "video_pe" && !hasSingleVideo) {
            return toast.error("Video PE Carousel តម្រូវឱ្យដាក់វីដេអូ!");
        }
        if (postFormat === "video_cta" && !hasSingleVideo) {
            return toast.error("Video CTA តម្រូវឱ្យដាក់វីដេអូ!");
        }
        if (postFormat === "photo_cta" && !hasSingleImage) {
            return toast.error("Photo CTA តម្រូវឱ្យដាក់រូបភាព ១ សន្លឹក!");
        }
        if (postFormat === "photos" && multiImages.length === 0 && !hasSingleImage) {
            return toast.error("សូមដាក់រូបភាពយ៉ាងតិច ១ សន្លឹក!");
        }
        if (postFormat === "photo_pe" && multiImages.length < 2) {
            return toast.error("Photo PE Carousel តម្រូវឱ្យដាក់រូបភាពយ៉ាងតិច ២ សន្លឹក!");
        }
        if (postFormat === "instant_experience" && !canvasId && !targetLink.trim()) {
            return toast.error("សូមជ្រើសរើស Instant Experience (Canvas) ឬដាក់ Link URL!");
        }
        if (postFormat === "text_link" && !caption.trim() && !targetLink.trim()) {
            return toast.error("សូមសរសេរអត្ថបទ ឬបញ្ចូល Link URL ជាមុនសិន!");
        }

        const isExtReady =
            extensionInstalled || document.documentElement.getAttribute("data-eza-extension") === "installed";
        const currentVer =
            extensionVersion || document.documentElement.getAttribute("data-eza-extension-version") || "";

        if (activeFormatMeta.needsAdAccount && publishMode === "now" && isExtReady && isExtensionAtLeastV230(currentVer)) {
            return handlePublishAdCreativeViaExtension();
        }

        if (activeFormatMeta.needsAdAccount && (!selectedAdAccount || !hasAdsToken)) {
            return toast.error(
                !selectedAdAccount
                    ? "ទម្រង់ PE / CTA ត្រូវការ Ad Account — សូមទាញយក Extension v2.3.0 ក្នុងទំព័រ 'ភ្ជាប់ផេក' រួចចុច Sync!"
                    : "ខ្វះ Live Ads Token — សូមអាប់ដេត Extension v2.3.0 ក្នុងទំព័រ 'ភ្ជាប់ផេក' រួចចុច Sync ឡើងវិញ!",
                { duration: 7500 }
            );
        }

        if (publishMode === "schedule") {
            if (!scheduleTime) {
                return toast.error("សូមជ្រើសរើសថ្ងៃ និងម៉ោងត្រូវបង្ហោះ!");
            }
            const diffMinutes = (new Date(scheduleTime).getTime() - Date.now()) / (1000 * 60);
            if (diffMinutes < 10) {
                return toast.error("សូមកំណត់ពេលវេលាយ៉ាងតិច ១០ នាទីបន្ទាប់ពីពេលនេះ!");
            }
        }

        if (activeFormatMeta.useBusinessSuite) {
            if (isExtReady && isExtensionAtLeastV205(currentVer)) {
                return handlePublishViaBusinessSuite();
            }
            if (isExtReady) {
                toast.error(
                    `Extension របស់អ្នកជាកំណែចាស់ (${currentVer || "< 2.0.5"}) — សូម Reload/អាប់ដេត Extension v2.3.0 ក្នុង chrome://extensions ជាមុនសិន!`,
                    { duration: 8000 }
                );
                return;
            }
            toast.error(
                "សូមដំឡើង EZA-POST Extension (v2.3.0) នៅក្នុងទំព័រ 'ភ្ជាប់ផេក' ដើម្បីផុសវីដេអូតាម Business Suite ដោយសុវត្ថិភាព!",
                { duration: 8000 }
            );
            return;
        }

        setIsSubmitting(true);
        const toastId = toast.loading(
            publishMode === "schedule"
                ? "កំពុងរក្សាទុកការកក់ពេលផុស..."
                : "កំពុងបង្ហោះទៅកាន់ Facebook Pages..."
        );

        try {
            const formData = new FormData();
            formData.append("caption", caption);
            formData.append("accounts", JSON.stringify(selectedPages));
            formData.append("platforms", JSON.stringify(["facebook"]));
            formData.append("postFormat", postFormat);
            if (targetLink.trim()) formData.append("link", targetLink.trim());
            if (headline.trim()) formData.append("headline", headline.trim());
            if (cardDescription.trim()) formData.append("cardDescription", cardDescription.trim());
            if (cta) formData.append("cta", cta);
            if (selectedAdAccount) formData.append("adAccountId", selectedAdAccount);
            if (isDarkPost) formData.append("isDarkPost", "true");
            if (canvasId) formData.append("canvasId", canvasId);
            if (postFormat === "instant_experience" && targetLink.trim()) formData.append("canvasUrl", targetLink.trim());
            if (publishMode === "schedule" && scheduleTime) formData.append("scheduleTime", new Date(scheduleTime).toISOString());
            formData.append("aiOptions", JSON.stringify(aiOptions));
            formData.append("enableBot", autoReplyBot);

            let endpoint = `${API_BASE}/api/posts`;
            if (postFormat === "video_pe") {
                endpoint = `${API_BASE}/api/posts/mixed-carousel`;
                if (file) formData.append("video", file);
                else if (rawVideoUrl) formData.append("videoUrl", rawVideoUrl);
                else if (previewUrl) formData.append("videoUrl", previewUrl);
                if (thumbnail) formData.append("thumbnail", thumbnail);
                if (rightSideImage) formData.append("rightSideImage", rightSideImage);
                if (targetLink.trim()) formData.append("targetLink", targetLink.trim());
                formData.append("postType", "carousel");
                const cardsPayload = [
                    ...mediaItems.map(item => ({
                        id: item.id,
                        type: item.type,
                        headline: item.type === "video" ? headline : carouselCtaText.replace(/\n/g, " "),
                        description: item.type === "video" ? (cardDescription || "Swipe to see more") : "",
                        cta,
                        isPageCard: item.isPageCard,
                        imageUrl: item.imageUrl,
                        isRightSide: item.isRightSide
                    })),
                    {
                        id: "card-destination-final",
                        type: "image",
                        isPageCard: true,
                        headline: "មើលច្រើនទៀតនៅ",
                        description: "FACEBOOK.COM",
                        link: targetLink,
                        cta: cta || "LEARN_MORE"
                    }
                ];
                formData.append("carouselCards", JSON.stringify(cardsPayload));
            } else if (postFormat === "photos" || postFormat === "photo_pe") {
                if (multiImages.length > 0) {
                    multiImages.forEach((img) => {
                        if (img.file) formData.append("images", img.file);
                    });
                    if (postFormat === "photo_pe") {
                        formData.append(
                            "carouselCards",
                            JSON.stringify(
                                multiImages.map((img, idx) => ({
                                    id: img.id || `photo-card-${idx}`,
                                    type: "image",
                                    headline: img.headline || headline || "",
                                    description: cardDescription || "",
                                    link: img.link || targetLink || "",
                                    cta: img.cta || cta || "LEARN_MORE",
                                }))
                            )
                        );
                    }
                } else if (file) {
                    formData.append("images", file);
                }
                formData.append("postType", postFormat === "photo_pe" || multiImages.length >= 2 ? "carousel" : "image");
            } else {
                if (file) formData.append("video", file);
                else if (rawVideoUrl) formData.append("videoUrl", rawVideoUrl);
                else if (previewUrl && postFormat !== "text_link") formData.append("videoUrl", previewUrl);
                if (thumbnail) formData.append("thumbnail", thumbnail);
                formData.append("postType", postFormat);
            }

            const response = await axios.post(endpoint, formData, {
                headers: { "Content-Type": "multipart/form-data" },
                withCredentials: true,
                timeout: 300000
            });

            const data = response.data;
            if (data.success) {
                toast.success(
                    publishMode === "schedule"
                        ? "កក់ពេលបង្ហោះរួចរាល់! 📅"
                        : "បានបង្ហោះទៅកាន់ Facebook រួចរាល់! 🎉",
                    { id: toastId }
                );
                setFile(null);
                setPreviewUrl(null);
                setRawVideoUrl(null);
                setTiktokUrl("");
                setCaption("");
                setMediaItems([]);
                setMultiImages([]);

                const isAutoCard2 = rightSideImage?.name?.startsWith("card2-");
                if (isAutoCard2) {
                    setRightSideImage(null);
                    setRightSideImagePreview(null);
                }

                setThumbnail(null);
                setThumbnailPreview(null);
                localStorage.removeItem("postDraft");

                await Promise.all([
                    clearDraftFile("draft_video"),
                    clearDraftFile("draft_thumb"),
                    ...(isAutoCard2 || !rightSideImage ? [clearDraftFile("draft_card2")] : [])
                ]);

                if (publishMode === "schedule") {
                    fetchQueue();
                }
            } else {
                throw new Error(data.error || "មិនអាចបង្ហោះបានទេ");
            }
        } catch (err) {
            console.error("❌ Post publish error:", err.response?.data?.error || err.message, err.response?.data || err);
            let errMsg = "មិនអាចបង្ហោះបានទេ សូមព្យាយាមម្តងទៀត";
            if (err.code === "ECONNABORTED") {
                errMsg = "ប្រព័ន្ធកំពុងដំណើរការនៅ Backend។ សូមរង់ចាំបន្តិច រួចពិនិត្យមើលក្នុង Facebook របស់អ្នក។";
            } else if (err.response?.data?.error) {
                errMsg = err.response.data.error;
            } else if (err.message) {
                errMsg = err.message;
            }
            toast.error(errMsg, { id: toastId, duration: 8000 });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePublishViaBusinessSuite = async () => {
        if (selectedPages.length === 0) {
            return toast.error("សូមជ្រើសរើសផេកយ៉ាងតិច ១ ដើម្បីបង្ហោះ!");
        }
        const isExtReady =
            extensionInstalled || document.documentElement.getAttribute("data-eza-extension") === "installed";
        if (!isExtReady) {
            toast.error("សូមដំឡើង ឬ Reload EZA-POST Extension (v2.2.0) ជាមុនសិន!");
            return;
        }
        const currentVer =
            extensionVersion || document.documentElement.getAttribute("data-eza-extension-version") || "";
        if (!isExtensionAtLeastV205(currentVer)) {
            toast.error(
                `សូមអាប់ដេត ឬ Reload Extension v2.2.0 ក្នុង chrome://extensions (បច្ចុប្បន្ន: ${currentVer || "ចាស់"}) ហើយ Refresh ទំព័រនេះ!`,
                { duration: 8000 }
            );
            return;
        }
        if (!file && !previewUrl && !caption.trim()) {
            return toast.error("សូមសរសេរអត្ថបទ ឬបន្ថែមវីដេអូ/រូបភាពជាមុនសិន!");
        }

        const primaryPage = availablePages.find((p) => p.id === selectedPages[0]);
        setIsOpeningComposer(true);
        const toastId = toast.loading("កំពុងរៀបចំឯកសារ និងបើក Meta Business Suite...");

        try {
            let mediaUrl = null;
            let filename = file?.name || "video.mp4";
            let mimeType = file?.type || "video/mp4";

            if (file) {
                const uploadForm = new FormData();
                uploadForm.append("media", file);
                const upRes = await axios.post(`${API_BASE}/api/upload/post-media`, uploadForm, {
                    headers: { "Content-Type": "multipart/form-data" },
                    withCredentials: true,
                    timeout: 300000
                });
                if (!upRes.data?.success || !upRes.data?.url) {
                    throw new Error(upRes.data?.error || "មិនអាចផ្ទុកឯកសារឡើង Edge Storage បានទេ");
                }
                mediaUrl = upRes.data.url;
                filename = upRes.data.filename || filename;
                mimeType = upRes.data.mimeType || mimeType;
            } else if (rawVideoUrl && rawVideoUrl.startsWith("https://")) {
                mediaUrl = rawVideoUrl;
            } else if (previewUrl && previewUrl.startsWith("https://")) {
                mediaUrl = previewUrl;
            }

            const scheduleLabel =
                publishMode === "schedule" && scheduleTime
                    ? new Date(scheduleTime).toLocaleString()
                    : "";

            const assistResult = await new Promise((resolve) => {
                const timer = setTimeout(() => {
                    window.removeEventListener("message", listener);
                    resolve({ ok: false, error: "Extension មិនឆ្លើយតប — សូមអាប់ដេត Extension v2.0.5 ហើយ Refresh ទំព័រ!" });
                }, 40000);

                const listener = (event) => {
                    if (
                        event.source === window &&
                        event.data?.source === "EZA_EXTENSION" &&
                        event.data?.action === "COMPOSER_ASSIST_RESULT"
                    ) {
                        clearTimeout(timer);
                        window.removeEventListener("message", listener);
                        resolve(event.data);
                    }
                };
                window.addEventListener("message", listener);
                window.postMessage(
                    {
                        source: "EZA_WEB_APP",
                        action: "PREPARE_COMPOSER_POST",
                        payload: {
                            pageId: selectedPages[0],
                            pageName: primaryPage?.name || "",
                            caption,
                            mediaUrl,
                            filename,
                            mimeType,
                            scheduleLabel
                        }
                    },
                    "*"
                );
            });

            if (!assistResult.ok) {
                throw new Error(assistResult.error || "មិនអាចបើក Meta Business Suite បានទេ");
            }
            toast.success("បានបើក Meta Business Suite ដោយបញ្ចូលវីដេអូ & Caption រួចរាល់! 🎉", {
                id: toastId,
                duration: 6000
            });
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || "មានបញ្ហាក្នុងការបើក Business Suite", {
                id: toastId,
                duration: 7000
            });
        } finally {
            setIsOpeningComposer(false);
        }
    };

    const cancelScheduledPost = async (postId) => {
        try {
            await postsAPI.cancel(postId);
            setQueue(prev => prev.filter(p => p.id !== postId));
            toast.success("បានលុបការកក់ពេលផុសនេះចោលរួចរាល់");
        } catch {
            toast.error("មិនអាចលុបការកក់ពេលនេះបានទេ");
        }
    };

    const hasMedia = Boolean(file || previewUrl || multiImages.length > 0);
    const mainPreviewItem = mediaItems[0];

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto px-1 sm:px-4 py-2 md:py-4 pb-16 space-y-5 font-khmer">
                {/* Header + View Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                            បង្កើត និងកំណត់ពេល <span className="text-blue-600 dark:text-blue-400">ផុសមាតិកា</span>
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            ងាយស្រួលក្នុង ៣ ជំហាន៖ រើសផេក → ដាក់មាតិកា → ចុចបង្ហោះ ឬកក់ម៉ោង
                        </p>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10 w-full sm:w-fit shrink-0">
                        {[
                            { id: "create", label: "បង្កើតផុសថ្មី", icon: Plus },
                            { id: "queue", label: "បញ្ជីកក់ម៉ោង", icon: Layers }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveView(tab.id)}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    activeView === tab.id
                                        ? "bg-white dark:bg-gray-900 text-blue-600 shadow-xs border border-gray-200/80 dark:border-white/10"
                                        : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                                }`}
                            >
                                <tab.icon size={14} />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {activeView === "create" ? (
                    <div className="space-y-4">
                        {/* 10-Format Switcher (Tube2Post Parity) */}
                        <div className="flex flex-wrap gap-1.5 p-1.5 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10">
                            {POST_FORMATS.map((fmt) => {
                                const isActive = postFormat === fmt.id;
                                return (
                                    <button
                                        key={fmt.id}
                                        type="button"
                                        onClick={() => {
                                            if (fmt.route) {
                                                navigate(fmt.route);
                                                return;
                                            }
                                            setPostFormat(fmt.id);
                                        }}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                            isActive
                                                ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs"
                                                : "text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
                                        }`}
                                    >
                                        <span>{fmt.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Ad Account + Dark Post Selector for PE / CTA / Canvas Formats */}
                        {activeFormatMeta.needsAdAccount && (
                            <div className="bg-blue-500/[0.06] dark:bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="text-xs font-bold text-blue-700 dark:text-blue-300">
                                        💳 ជ្រើសរើស Ad Account សម្រាប់ {activeFormatMeta.label}
                                    </div>
                                    {adAccounts.length > 0 ? (
                                        <div className="space-y-1.5">
                                            <select
                                                value={selectedAdAccount}
                                                onChange={(e) => setSelectedAdAccount(e.target.value)}
                                                className="w-full sm:max-w-sm bg-white dark:bg-gray-900 border border-blue-500/30 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 dark:text-white outline-none"
                                            >
                                                {adAccounts.map((acc) => (
                                                    <option key={acc.id} value={acc.id}>
                                                        {acc.name} ({acc.id} • {acc.currency})
                                                    </option>
                                                ))}
                                            </select>
                                            {!hasAdsToken && !isExtensionAtLeastV230(extensionVersion) && (
                                                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                                                    ⚠️ សូមអាប់ដេត Extension v2.3.0 ក្នុង{" "}
                                                    <Link to="/connections" className="underline font-bold">ទំព័រភ្ជាប់ផេក</Link> ដើម្បីចាប់ Live Ads Token និងបង្ហោះ PE/CTA ផ្ទាល់លើ Browser!
                                                </p>
                                            )}
                                            {isExtensionAtLeastV230(extensionVersion) && (
                                                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                                                    ⚡ Extension v{extensionVersion} រួចរាល់ — នឹងបង្ហោះ PE / CTA ផ្ទាល់លើ Browser របស់អ្នក (គ្មានបញ្ហា Server IP)
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-amber-700 dark:text-amber-300">
                                            មិនទាន់ឃើញ Ad Account ទេ — សូមអាប់ដេត Extension v2.3.0 ក្នុង{" "}
                                            <Link to="/connections" className="underline font-bold">ទំព័រភ្ជាប់ផេក</Link> រួចចុច Sync!
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5 bg-white/80 dark:bg-gray-900 p-1 rounded-xl border border-blue-500/20 shrink-0 w-fit">
                                    {[
                                        { dark: false, label: "📢 ផុសឡើង Timeline" },
                                        { dark: true, label: "🕶️ Dark Post (PE)" },
                                    ].map((opt) => (
                                        <button
                                            key={String(opt.dark)}
                                            type="button"
                                            onClick={() => setIsDarkPost(opt.dark)}
                                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                                isDarkPost === opt.dark
                                                    ? "bg-blue-600 text-white shadow-2xs"
                                                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* STEP 1: Select Destination Pages */}
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/5 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                        ជំហានទី ១៖ ជ្រើសរើសផេក Facebook
                                    </h3>
                                    <p className="text-xs text-gray-500">រើសផេក ១ ឬច្រើនដែលអ្នកចង់ផុសចូល</p>
                                </div>
                                {availablePages.length > 0 && (
                                    <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold">
                                        បានរើស {selectedPages.length}/{availablePages.length}
                                    </span>
                                )}
                            </div>

                            {isLoadingPages ? (
                                <div className="py-4 flex items-center gap-2 text-xs text-gray-400">
                                    <Loader2 size={15} className="animate-spin" />
                                    <span>កំពុងទាញយកបញ្ជីផេក...</span>
                                </div>
                            ) : availablePages.length === 0 ? (
                                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                                        មិនទាន់មានផេក Facebook ត្រូវបានភ្ជាប់ទេ។ សូមភ្ជាប់ផេកជាមុនសិន!
                                    </p>
                                    <Link
                                        to="/connections"
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0"
                                    >
                                        <span>ទៅភ្ជាប់ផេក Facebook</span>
                                        <ExternalLink size={13} />
                                    </Link>
                                </div>
                            ) : (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsPageSelectorOpen(!isPageSelectorOpen)}
                                        className="w-full bg-gray-50 dark:bg-black/60 border border-gray-200 dark:border-white/10 rounded-xl p-3.5 flex items-center justify-between hover:border-blue-500/40 transition cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0">
                                                {selectedPages.length}
                                            </div>
                                            <div className="text-left min-w-0">
                                                <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                                                    {selectedPages.length === 0
                                                        ? "ចុចទីនេះដើម្បីជ្រើសរើសផេក..."
                                                        : selectedPages.length === availablePages.length
                                                            ? `បានជ្រើសរើសទាំងអស់ (${availablePages.length} ផេក)`
                                                            : availablePages
                                                                .filter(p => selectedPages.includes(p.id))
                                                                .map(p => p.name)
                                                                .join(", ")}
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronDown size={18} className={`text-gray-400 transition-transform shrink-0 ${isPageSelectorOpen ? "rotate-180" : ""}`} />
                                    </button>

                                    <AnimatePresence>
                                        {isPageSelectorOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 6 }}
                                                className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                                            >
                                                <div className="p-3 border-b border-gray-100 dark:border-white/5 flex items-center gap-2">
                                                    <div className="relative flex-1">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                        <input
                                                            type="text"
                                                            placeholder="ស្វែងរកឈ្មោះផេក..."
                                                            value={searchQuery}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                            className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs font-medium outline-none focus:border-blue-500"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={toggleAllPages}
                                                        className="px-3 py-2 bg-blue-600/10 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-600 hover:text-white transition whitespace-nowrap cursor-pointer"
                                                    >
                                                        {selectedPages.length === availablePages.length ? "រើសតែ ១" : "រើសទាំងអស់"}
                                                    </button>
                                                </div>

                                                <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                                                    {availablePages
                                                        .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                                        .map(page => {
                                                            const isSelected = selectedPages.includes(page.id);
                                                            return (
                                                                <div
                                                                    key={page.id}
                                                                    onClick={() => handlePageSelection(page.id)}
                                                                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                                                                        isSelected ? "bg-blue-500/10" : "hover:bg-gray-50 dark:hover:bg-white/5"
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                                        <img
                                                                            src={page.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(page.name)}`}
                                                                            alt={page.name}
                                                                            className="w-8 h-8 rounded-full object-cover shrink-0"
                                                                        />
                                                                        <div className="min-w-0">
                                                                            <p className={`text-xs sm:text-sm font-bold truncate ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white"}`}>
                                                                                {page.name}
                                                                            </p>
                                                                            <span className={`text-[10px] font-semibold ${page.isProfile || page.category === "គណនីផ្ទាល់ខ្លួន" ? "text-purple-500" : "text-gray-400"}`}>
                                                                                {page.isProfile || page.category === "គណនីផ្ទាល់ខ្លួន" ? "គណនីផ្ទាល់ខ្លួន" : "ផេក Facebook"}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => {}}
                                                                        className="w-4 h-4 rounded text-blue-600 pointer-events-none"
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                </div>

                                                <div className="p-2.5 border-t border-gray-100 dark:border-white/5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsPageSelectorOpen(false)}
                                                        className="w-full py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-xs cursor-pointer"
                                                    >
                                                        រួចរាល់
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>

                        {/* STEP 2: Caption & Media Upload / TikTok */}
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/5 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                        ជំហានទី ២៖ សរសេរអត្ថបទ និងដាក់វីដេអូ ឬរូបភាព
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    {hasMedia && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => navigate("/subtitles", { state: { videoUrl: previewUrl, file } })}
                                                className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <Languages size={14} />
                                                <span>ដាក់អក្សររត់ AI</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleClearPreview}
                                                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                                            >
                                                <Trash2 size={13} />
                                                <span>លុបចេញ</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Caption */}
                            <textarea
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="សរសេរ Caption ឬខ្លឹមសារផុសរបស់អ្នកនៅទីនេះ..."
                                className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl p-3.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-blue-500 resize-y min-h-[96px]"
                                rows={3}
                            />

                            {/* Format-specific CTA / Link / Instant Experience Fields */}
                            {postFormat === "text_link" && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                        🔗 តំណភ្ជាប់ Link Preview (Optional)
                                    </label>
                                    <input
                                        type="url"
                                        value={targetLink}
                                        onChange={(e) => setTargetLink(e.target.value)}
                                        placeholder="https://moneaa.site/..."
                                        className="w-full bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500"
                                    />
                                </div>
                            )}

                            {postFormat === "instant_experience" && (
                                <div className="p-3.5 rounded-xl bg-purple-500/[0.06] border border-purple-500/20 space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                                            ⚡ ជ្រើសរើស Instant Experience (Canvas ID)
                                        </span>
                                        {loadingCanvases && <Loader2 size={14} className="animate-spin text-purple-500" />}
                                    </div>
                                    {canvases.length > 0 && (
                                        <select
                                            value={canvasId}
                                            onChange={(e) => setCanvasId(e.target.value)}
                                            className="w-full bg-white dark:bg-gray-900 border border-purple-500/30 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 dark:text-white outline-none"
                                        >
                                            <option value="">-- ជ្រើស Canvas របស់ផេក --</option>
                                            {canvases.map((cv) => (
                                                <option key={cv.id} value={cv.id}>
                                                    {cv.name || "Instant Experience"} (ID: {cv.id})
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    <input
                                        type="text"
                                        value={canvasId}
                                        onChange={(e) => setCanvasId(e.target.value)}
                                        placeholder="ឬវាយ Canvas ID ដោយដៃ (ឧទាហរណ៍ 1234567890...)"
                                        className="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-gray-900 dark:text-white outline-none"
                                    />
                                </div>
                            )}

                            {(postFormat === "video_cta" || postFormat === "photo_cta" || postFormat === "instant_experience") && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-gray-500">ចំណងជើង (Headline)</label>
                                        <input
                                            type="text"
                                            value={headline}
                                            onChange={(e) => setHeadline(e.target.value)}
                                            placeholder="បញ្ចូលចំណងជើងលើកាត..."
                                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-gray-500">ការពិពណ៌នាខ្លី (Description)</label>
                                        <input
                                            type="text"
                                            value={cardDescription}
                                            onChange={(e) => setCardDescription(e.target.value)}
                                            placeholder="ព័ត៌មានបន្ថែមខាងក្រោម..."
                                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-gray-500">តំណភ្ជាប់គោលដៅ (Website / Link URL)</label>
                                        <input
                                            type="url"
                                            value={targetLink}
                                            onChange={(e) => setTargetLink(e.target.value)}
                                            placeholder="https://..."
                                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-gray-500">ប៊ូតុង CTA (Call To Action)</label>
                                        <select
                                            value={cta}
                                            onChange={(e) => setCta(e.target.value)}
                                            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500"
                                        >
                                            {CTA_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Media Upload Dropzone OR Preview (hidden only when text_link without media) */}
                            {postFormat === "text_link" ? null : (postFormat === "photos" || postFormat === "photo_pe") ? (
                                <div className="space-y-3">
                                    {multiImages.length > 0 && (
                                        <div className={`grid gap-3 ${postFormat === "photo_pe" ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
                                            {multiImages.map((img, idx) => (
                                                <div key={img.id} className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/40 flex flex-col">
                                                    <div className="relative aspect-square bg-black">
                                                        <img src={img.preview} alt={`photo-${idx + 1}`} className="w-full h-full object-cover" />
                                                        <button
                                                            type="button"
                                                            onClick={() => setMultiImages((prev) => prev.filter((item) => item.id !== img.id))}
                                                            className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-white hover:bg-rose-600 cursor-pointer"
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                        <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">
                                                            #{idx + 1}
                                                        </span>
                                                    </div>
                                                    {postFormat === "photo_pe" && (
                                                        <div className="p-2.5 space-y-1.5 text-xs">
                                                            <input
                                                                type="text"
                                                                value={img.headline}
                                                                onChange={(e) => setMultiImages((prev) => prev.map((it) => it.id === img.id ? { ...it, headline: e.target.value } : it))}
                                                                placeholder="ចំណងជើងកាត..."
                                                                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] outline-none"
                                                            />
                                                            <input
                                                                type="url"
                                                                value={img.link}
                                                                onChange={(e) => setMultiImages((prev) => prev.map((it) => it.id === img.id ? { ...it, link: e.target.value } : it))}
                                                                placeholder="Link URL កាត..."
                                                                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] outline-none"
                                                            />
                                                            <select
                                                                value={img.cta}
                                                                onChange={(e) => setMultiImages((prev) => prev.map((it) => it.id === img.id ? { ...it, cta: e.target.value } : it))}
                                                                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-[11px] font-bold outline-none"
                                                            >
                                                                {CTA_OPTIONS.map((opt) => (
                                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {multiImages.length < 10 && (
                                        <div
                                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                            onDragLeave={() => setIsDragging(false)}
                                            onDrop={handleDrop}
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                                                isDragging
                                                    ? "border-blue-500 bg-blue-500/10"
                                                    : "border-gray-200 dark:border-white/15 bg-gray-50/70 dark:bg-black/20 hover:border-blue-500/50"
                                            }`}
                                        >
                                            <ImageIcon size={22} className="mx-auto mb-2 text-blue-500" />
                                            <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                                                ចុចដើម្បីជ្រើសរើសរូបភាព ({multiImages.length}/10 សន្លឹក)
                                            </p>
                                            <p className="text-[11px] text-gray-500 mt-0.5">
                                                {postFormat === "photo_pe" ? "ត្រូវការយ៉ាងតិច ២ កាតសម្រាប់ Photo PE Carousel" : "អាចជ្រើស ១ ឬច្រើនសន្លឹកព្រមគ្នា (JPG, PNG, WEBP)"}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : !hasMedia ? (
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                                        isDragging
                                            ? "border-blue-500 bg-blue-500/10"
                                            : "border-gray-200 dark:border-white/15 bg-gray-50/70 dark:bg-black/20 hover:border-blue-500/50 hover:bg-blue-50/30 dark:hover:bg-blue-900/10"
                                    }`}
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
                                        <Upload size={22} />
                                    </div>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                                        ចុចទីនេះ ឬអូសវីដេអូ / រូបភាពដាក់ចូល
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-3">
                                        <span className="inline-flex items-center gap-1"><Video size={12} /> MP4, MOV, WebM</span>
                                        <span className="inline-flex items-center gap-1"><ImageIcon size={12} /> JPG, PNG</span>
                                        <span>(អតិបរមា 90MB)</span>
                                    </p>
                                </div>
                            ) : postFormat !== "video_pe" ? (
                                /* Clean Single Media Preview */
                                <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 bg-black">
                                    {mainPreviewItem?.type === "video" ? (
                                        <div className="relative max-h-[420px] flex items-center justify-center bg-black">
                                            <video
                                                key={mainPreviewItem.preview}
                                                src={mainPreviewItem.preview}
                                                poster={thumbnailPreview}
                                                className="w-full max-h-[420px] object-contain"
                                                autoPlay
                                                muted={isPreviewMuted}
                                                loop
                                                playsInline
                                                controls
                                                onError={() => {
                                                    if (!isFixed) {
                                                        setVideoError(true);
                                                        handleFixH265();
                                                    }
                                                }}
                                            />
                                            {videoError && (
                                                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center">
                                                    <Loader2 size={28} className="text-pink-500 animate-spin mb-2" />
                                                    <p className="text-white text-xs font-bold">កំពុងបម្លែងវីដេអូឱ្យដំណើរការ...</p>
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setIsPreviewMuted(!isPreviewMuted)}
                                                className="absolute top-3 left-3 p-2 bg-black/60 rounded-lg text-white hover:bg-black/80 cursor-pointer"
                                                title={isPreviewMuted ? "បើកសំឡេង" : "បិទសំឡេង"}
                                            >
                                                {isPreviewMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                                            </button>
                                        </div>
                                    ) : (
                                        <img
                                            src={mainPreviewItem?.preview}
                                            alt="Preview"
                                            className="w-full max-h-[420px] object-contain mx-auto"
                                        />
                                    )}
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-white/10 flex items-center justify-between">
                                        <span className="text-xs text-gray-500 dark:text-gray-300 font-medium">
                                            {file ? file.name : "វីដេអូដែលបានភ្ជាប់"}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-200 hover:border-blue-500 cursor-pointer"
                                        >
                                            ប្តូរវីដេអូ / រូបភាព
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Carousel 3-Card Preview */
                                <div
                                    ref={carouselRef}
                                    className="flex overflow-x-auto md:grid md:grid-cols-3 gap-4 pb-2 snap-x"
                                >
                                    {mediaItems.map((item) => (
                                        <div
                                            key={item.id}
                                            className="min-w-[240px] w-[80%] md:w-full bg-white dark:bg-[#242526] rounded-xl overflow-hidden shadow-md border border-gray-200 dark:border-white/10 flex flex-col snap-center shrink-0"
                                        >
                                            <div
                                                className={`relative aspect-square overflow-hidden cursor-pointer ${
                                                    item.isPlaceholder ? "bg-gray-50 dark:bg-black/20 border-2 border-dashed border-gray-200 dark:border-white/10" : "bg-black"
                                                }`}
                                                onClick={() => {
                                                    if (item.id === "video-main") {
                                                        fileInputRef.current?.click();
                                                    } else if (item.isRightSide) {
                                                        const input = document.createElement("input");
                                                        input.type = "file";
                                                        input.accept = "image/*";
                                                        input.onchange = (ev) => {
                                                            const f = ev.target.files?.[0];
                                                            if (f) {
                                                                setRightSideImage(f);
                                                                setRightSideImagePreview(URL.createObjectURL(f));
                                                            }
                                                        };
                                                        input.click();
                                                    }
                                                }}
                                            >
                                                {item.isPlaceholder ? (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                                                        <Plus className="text-blue-500" size={22} />
                                                        <p className="text-xs font-bold text-gray-700 dark:text-white">
                                                            {item.id === "video-main" ? "បន្ថែមវីដេអូ" : "បន្ថែមរូបភាព Card 2"}
                                                        </p>
                                                    </div>
                                                ) : item.type === "video" ? (
                                                    <video
                                                        key={item.preview}
                                                        src={item.preview}
                                                        poster={thumbnailPreview}
                                                        className="w-full h-full object-cover"
                                                        autoPlay
                                                        muted={isPreviewMuted}
                                                        loop
                                                        playsInline
                                                    />
                                                ) : item.isPageCard ? (
                                                    <div className="absolute inset-0 bg-gray-50 dark:bg-black/30 flex flex-col items-center justify-center text-center p-4">
                                                        <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-xl mb-3 overflow-hidden flex items-center justify-center border border-gray-200 dark:border-white/10">
                                                            {(() => {
                                                                const selectedPage = availablePages.find(p => p.id === selectedPages[0]);
                                                                return selectedPage?.picture ? (
                                                                    <img src={selectedPage.picture} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <Share2 className="text-gray-400" size={22} />
                                                                );
                                                            })()}
                                                        </div>
                                                        <p className="text-[10px] font-bold text-gray-400 mb-0.5">មើលច្រើនទៀតនៅ</p>
                                                        <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate w-full">
                                                            {availablePages.find(p => p.id === selectedPages[0])?.name || "FACEBOOK.COM"}
                                                        </h4>
                                                    </div>
                                                ) : (
                                                    <img src={item.preview} alt="" className="w-full h-full object-cover" />
                                                )}

                                                {galleryOptions.length > 0 && (item.id === "video-main" || item.isRightSide) && (
                                                    <div className="absolute inset-x-0 bottom-0 p-2 bg-black/75 flex justify-center gap-1 overflow-x-auto">
                                                        {galleryOptions.map((frame, fIdx) => (
                                                            <div
                                                                key={fIdx}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (item.id === "video-main") {
                                                                        setThumbnailPreview(frame);
                                                                        setThumbnail(dataURLtoFile(frame, `thumb-${fIdx}.jpg`));
                                                                    } else {
                                                                        setRightSideImagePreview(frame);
                                                                        setRightSideImage(dataURLtoFile(frame, `card2-${fIdx}.jpg`));
                                                                    }
                                                                }}
                                                                className={`w-7 h-7 rounded overflow-hidden border-2 shrink-0 ${
                                                                    (item.id === "video-main" ? thumbnailPreview : rightSideImagePreview) === frame
                                                                        ? "border-blue-500"
                                                                        : "border-white/20"
                                                                }`}
                                                            >
                                                                <img src={frame} alt="" className="w-full h-full object-cover" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="px-3 py-2.5 bg-gray-100 dark:bg-[#242526] border-t border-gray-200 dark:border-white/5 flex items-center gap-2">
                                                <div className="flex-1 min-w-0">
                                                    {item.isPageCard ? (
                                                        <p className="text-[11px] font-bold text-gray-900 dark:text-gray-100">FACEBOOK.COM</p>
                                                    ) : (
                                                        <textarea
                                                            value={carouselCtaText}
                                                            onChange={(e) => setCarouselCtaText(e.target.value)}
                                                            className="w-full bg-transparent text-[11px] font-bold text-gray-900 dark:text-gray-100 outline-none resize-none"
                                                            rows={2}
                                                        />
                                                    )}
                                                </div>
                                                {!item.isPageCard && (
                                                    <select
                                                        value={cta}
                                                        onChange={(e) => setCta(e.target.value)}
                                                        className="px-2 py-1 rounded-md bg-white dark:bg-[#3a3b3c] border border-gray-300 dark:border-white/10 text-[10px] font-bold text-gray-900 dark:text-white"
                                                    >
                                                        {CTA_OPTIONS.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Inline TikTok Link Bar + Advanced Video Tools (only on video formats) */}
                            {activeFormatMeta.accept?.includes("video") && (
                                <>
                                    <div className="pt-2 border-t border-gray-100 dark:border-white/5">
                                        <label className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1.5 mb-2">
                                            <LinkIcon size={13} className="text-pink-500" />
                                            <span>ឬទាញយកវីដេអូពី TikTok Link (Optional)</span>
                                        </label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                                type="text"
                                                value={tiktokUrl || ""}
                                                onChange={(e) => setTiktokUrl(e.target.value)}
                                                placeholder="បិទភ្ជាប់ Link វីដេអូ TikTok ទីនេះ..."
                                                className="flex-1 bg-gray-50 dark:bg-white/5 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 outline-none focus:border-pink-500"
                                            />
                                            <Button
                                                type="button"
                                                onClick={handleLoadTiktok}
                                                isLoading={isLoadingVideo}
                                                className="h-10 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold shrink-0"
                                            >
                                                ទាញយកវីដេអូ
                                            </Button>
                                        </div>
                                    </div>

                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvanced(v => !v)}
                                            className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>ការកំណត់វីដេអូបន្ថែម (Advanced)</span>
                                            <ChevronDown size={14} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                                        </button>
                                        {showAdvanced && (
                                            <div className="grid grid-cols-3 gap-2.5 mt-3">
                                                {[
                                                    { id: "safeMode", label: "Safe Mode" },
                                                    { id: "pitchShift", label: "កែសំឡេង" },
                                                    { id: "flip", label: "ត្រឡប់វីដេអូ" }
                                                ].map(opt => (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => setAiOptions(prev => ({ ...prev, [opt.id]: !prev[opt.id] }))}
                                                        className={`p-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                                                            aiOptions[opt.id]
                                                                ? "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400"
                                                                : "bg-gray-50 dark:bg-black/30 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400"
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* STEP 3: Schedule & Publish */}
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/5 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                    ជំហានទី ៣៖ បង្ហោះ ឬកំណត់ម៉ោង
                                </h3>

                                {/* Auto-Reply Bot Toggle */}
                                <label className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 cursor-pointer select-none w-fit">
                                    <input
                                        type="checkbox"
                                        checked={autoReplyBot}
                                        onChange={(e) => setAutoReplyBot(e.target.checked)}
                                        className="w-4 h-4 rounded text-purple-600"
                                    />
                                    <MessageSquare size={14} className="text-purple-600 dark:text-purple-400" />
                                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                                        បើក Bot ឆ្លើយខមិនស្វ័យប្រវត្តិ
                                    </span>
                                </label>
                            </div>

                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                                    <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10">
                                        {[
                                            { id: "now", label: "⚡ ផុសឥឡូវនេះ" },
                                            { id: "schedule", label: "📅 កក់ម៉ោងផុស" }
                                        ].map(mode => (
                                            <button
                                                key={mode.id}
                                                type="button"
                                                onClick={() => setPublishMode(mode.id)}
                                                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                                                    publishMode === mode.id
                                                        ? "bg-white dark:bg-gray-800 text-blue-600 shadow-xs"
                                                        : "text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                                                }`}
                                            >
                                                {mode.label}
                                            </button>
                                        ))}
                                    </div>

                                    {publishMode === "schedule" && (
                                        <input
                                            type="datetime-local"
                                            value={scheduleTime}
                                            onChange={(e) => setScheduleTime(e.target.value)}
                                            className="bg-gray-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white outline-none focus:border-blue-500"
                                        />
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                                    {extensionInstalled && activeFormatMeta.useBusinessSuite && (
                                        <button
                                            type="button"
                                            onClick={handlePublishViaBusinessSuite}
                                            disabled={isOpeningComposer || isSubmitting}
                                            className="px-4 h-12 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60 border bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-lg shadow-emerald-500/20"
                                        >
                                            {isOpeningComposer ? (
                                                <>
                                                    <Loader2 size={15} className="animate-spin" />
                                                    <span>កំពុងបើក Business Suite...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Zap size={15} />
                                                    <span>ផុសតាម Business Suite (Extension)</span>
                                                </>
                                            )}
                                        </button>
                                    )}

                                    <Button
                                        type="button"
                                        onClick={handleSubmit}
                                        isLoading={isSubmitting || isOpeningComposer}
                                        className={`w-full md:w-auto px-8 h-12 rounded-xl text-sm font-bold text-white shadow-lg cursor-pointer ${
                                            publishMode === "schedule"
                                                ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20"
                                                : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                                        }`}
                                    >
                                        {publishMode === "schedule"
                                            ? "📅 កក់ពេលបង្ហោះ"
                                            : isDarkPost && activeFormatMeta.needsAdAccount
                                            ? "🕶️ បង្កើត Dark Post (PE)"
                                            : "🚀 បង្ហោះទៅ Facebook ឥឡូវ"}
                                    </Button>
                                </div>
                            </div>

                            {extensionInstalled && activeFormatMeta.useBusinessSuite && (
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                    <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                                        💡 ប្រើប៊ូតុង <strong>«ផុសតាម Business Suite (Extension)»</strong> ដើម្បីឱ្យ Extension បញ្ចូលវីដេអូ &amp; Caption ផ្ទាល់លើ Browser អ្នក (មិនជាប់ FB #1 និងសុវត្ថិភាព ១០០%)។
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handlePublishViaBusinessSuite}
                                        disabled={isOpeningComposer}
                                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shrink-0 cursor-pointer"
                                    >
                                        បើក Business Suite ឥឡូវ
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Queue Tab */
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/5 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-bold text-gray-900 dark:text-white">
                                បញ្ជីផុសកំពុងរង់ចាំម៉ោង ({queue.length})
                            </h2>
                            <button
                                type="button"
                                onClick={fetchQueue}
                                className="p-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 text-gray-500 cursor-pointer"
                                title="Refresh"
                            >
                                <RefreshCw size={15} className={isLoadingQueue ? "animate-spin" : ""} />
                            </button>
                        </div>

                        {isLoadingQueue ? (
                            <div className="py-12 flex items-center justify-center gap-2 text-xs text-gray-400">
                                <Loader2 size={16} className="animate-spin" />
                                <span>កំពុងផ្ទុកបញ្ជី...</span>
                            </div>
                        ) : queue.length === 0 ? (
                            <div className="py-14 text-center text-gray-400 text-xs sm:text-sm">
                                មិនទាន់មានផុសកំពុងរង់ចាំម៉ោងនៅឡើយទេ។
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {queue.map(post => {
                                    const timeValue = post.scheduleTime || post.scheduledAt;
                                    return (
                                        <div
                                            key={post.id}
                                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl gap-3"
                                        >
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                                                    <Clock size={18} />
                                                </div>
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                            post.status === "failed"
                                                                ? "bg-rose-500/15 text-rose-500"
                                                                : post.status === "expired"
                                                                ? "bg-amber-500/15 text-amber-500"
                                                                : "bg-blue-500/15 text-blue-500"
                                                        }`}>
                                                            {post.status || "scheduled"}
                                                        </span>
                                                        <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                                                            {post.caption || "(ផុសគ្មានអត្ថបទ)"}
                                                        </p>
                                                    </div>
                                                    {Array.isArray(post.lastError) && post.lastError[0]?.error && (
                                                        <p className="text-[11px] text-rose-500 line-clamp-2">
                                                            {post.lastError[0].error}
                                                        </p>
                                                    )}
                                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                                                        <span>
                                                            📅 {timeValue ? new Date(timeValue).toLocaleString() : "ភ្លាមៗ"}
                                                        </span>
                                                        {Array.isArray(post.accounts) && post.accounts.length > 0 && (
                                                            <span>
                                                                • ផេក៖ {post.accounts.map(a => a.name || a.id).join(", ")}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => cancelScheduledPost(post.id)}
                                                className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl text-xs font-bold cursor-pointer shrink-0"
                                            >
                                                <Trash2 size={14} />
                                                <span>បោះបង់</span>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Full Screen Video Preview Modal */}
            <AnimatePresence>
                {previewVideoModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
                        onClick={() => setPreviewVideoModal(null)}
                    >
                        <div
                            className="relative max-w-4xl max-h-[90vh] w-full bg-black rounded-2xl overflow-hidden border border-white/10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <video src={previewVideoModal} controls autoPlay playsInline className="w-full max-h-[90vh] object-contain" />
                            <button
                                type="button"
                                onClick={() => setPreviewVideoModal(null)}
                                className="absolute top-3 right-3 p-2 bg-black/60 rounded-full text-white cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple={Boolean(activeFormatMeta.multiImage)}
                onChange={handleFileChange}
                accept={activeFormatMeta.accept || "video/*,image/*"}
            />
        </DashboardLayout>
    );
}
