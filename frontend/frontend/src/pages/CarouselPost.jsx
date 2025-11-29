import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Upload, X, Image as ImageIcon, Video, Calendar, Send, CheckCircle, Loader2, ArrowRight, Plus, Trash2 } from "lucide-react";

const CarouselPost = () => {
    const [videoFile, setVideoFile] = useState(null);
    const [imageFiles, setImageFiles] = useState([]); // Array of images
    const [caption, setCaption] = useState("");
    const [scheduleTime, setScheduleTime] = useState("");
    const [accounts, setAccounts] = useState([]);
    const [selectedAccounts, setSelectedAccounts] = useState([]);
    const [uploading, setUploading] = useState(false);

    // New State for TikTok & Cloudinary
    const [activeTab, setActiveTab] = useState("upload"); // 'upload' | 'tiktok'
    const [tiktokUrl, setTiktokUrl] = useState("");
    const [loadingTiktok, setLoadingTiktok] = useState(false);
    const [videoUrl, setVideoUrl] = useState(null); // Cloudinary URL

    // CTA Preferences (UI Only for now)
    const [ctaLike, setCtaLike] = useState(false);
    const [ctaFollow, setCtaFollow] = useState(false);

    // Fetch Pages
    useEffect(() => {
        const fetchPages = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/user/pages`, {
                    withCredentials: true,
                });
                setAccounts(res.data.accounts || []);
            } catch (err) {
                console.error("Failed to fetch pages", err);
                toast.error("Failed to load Facebook pages");
            }
        };
        fetchPages();
    }, []);

    // Handle TikTok Fetch
    const handleTikTokFetch = async (e) => {
        e.preventDefault();
        if (!tiktokUrl) return;

        setLoadingTiktok(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/posts/tiktok/fetch`, { url: tiktokUrl }, {
                withCredentials: true
            });

            if (res.data.success) {
                setVideoUrl(res.data.video.url); // Cloudinary URL
                setVideoFile(null); // Clear manual file
                toast.success("TikTok Video Loaded! 🎵");
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Failed to fetch TikTok");
        } finally {
            setLoadingTiktok(false);
        }
    };

    // Video Dropzone
    const onDropVideo = (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file) return;

        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            if (video.videoWidth !== video.videoHeight) {
                toast("⚠️ Video will be auto-padded to 1:1", {
                    icon: "ℹ️",
                    style: { borderRadius: '10px', background: '#333', color: '#fff' },
                });
            }
            setVideoFile(Object.assign(file, { preview: URL.createObjectURL(file) }));
            setVideoUrl(null); // Clear TikTok URL
        };
        video.src = URL.createObjectURL(file);
    };

    const { getRootProps: getVideoRootProps, getInputProps: getVideoInputProps, isDragActive: isVideoDragActive } = useDropzone({
        onDrop: onDropVideo,
        accept: { "video/*": [] },
        maxFiles: 1,
    });

    // Image Dropzone (Multiple)
    const onDropImages = (acceptedFiles) => {
        const newImages = acceptedFiles.map(file => Object.assign(file, { preview: URL.createObjectURL(file) }));
        setImageFiles(prev => [...prev, ...newImages]);
        toast.success(`${newImages.length} image(s) added!`);
    };

    const { getRootProps: getImageRootProps, getInputProps: getImageInputProps, isDragActive: isImageDragActive } = useDropzone({
        onDrop: onDropImages,
        accept: { "image/*": [] },
        multiple: true, // ✅ Enable multiple files
    });

    const removeImage = (index) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Handle Submit
    const handleSubmit = async () => {
        if ((!videoFile && !videoUrl) || imageFiles.length === 0) return toast.error("Please upload a video and at least one image!");
        if (selectedAccounts.length === 0) return toast.error("Please select at least one page!");

        setUploading(true);
        const formData = new FormData();

        // Handle Video (File or URL)
        if (videoFile) formData.append("video", videoFile);
        if (videoUrl) formData.append("videoUrl", videoUrl);

        // Handle Images (Multiple)
        imageFiles.forEach(file => {
            formData.append("images", file);
        });

        // Append CTA to caption
        let finalCaption = caption;
        if (ctaLike) finalCaption += "\n\n👉 Like our Page for more!";
        if (ctaFollow) finalCaption += "\n\n👉 Follow us for updates!";

        formData.append("caption", finalCaption);
        formData.append("accounts", JSON.stringify(selectedAccounts));
        if (scheduleTime) formData.append("scheduleTime", scheduleTime);

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/posts/mixed-carousel`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
                withCredentials: true,
            });

            if (res.data.success) {
                toast.success("Mixed Carousel Published! 🚀");
                setVideoFile(null);
                setVideoUrl(null);
                setImageFiles([]);
                setCaption("");
                setScheduleTime("");
                setTiktokUrl("");
                setSelectedAccounts([]);
                setCtaLike(false);
                setCtaFollow(false);
            } else {
                toast.error("Failed to publish post");
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const toggleAccount = (id) => {
        setSelectedAccounts(prev =>
            prev.includes(id) ? prev.filter(accId => accId !== id) : [...prev, id]
        );
    };

    return (
        <div className="max-w-7xl mx-auto pb-20 px-4">
            {/* Header */}
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-pink-600 bg-clip-text text-transparent">
                    Mixed Media Carousel
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    Create engaging carousels with 1 Video + Multiple Images.
                </p>
            </div>

            {/* 2.1 Top Section — Page Selection & Caption */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Page Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select Pages</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {accounts.map((page) => (
                                <div
                                    key={page.id}
                                    onClick={() => toggleAccount(page.id)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedAccounts.includes(page.id)
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                        : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                                        }`}
                                >
                                    <img src={page.picture} alt={page.name} className="w-10 h-10 rounded-full" />
                                    <span className="font-medium text-sm text-gray-700 dark:text-gray-200 truncate">{page.name}</span>
                                    {selectedAccounts.includes(page.id) && <CheckCircle size={18} className="text-blue-500 ml-auto" />}
                                </div>
                            ))}
                        </div>

                        {/* CTA Preferences */}
                        <div className="mt-4 flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={ctaLike} onChange={(e) => setCtaLike(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">Like Page</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={ctaFollow} onChange={(e) => setCtaFollow(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">Follow Page</span>
                            </label>
                        </div>
                    </div>

                    {/* Caption Box */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Caption</label>
                        <textarea
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-full min-h-[150px]"
                            placeholder="Write something engaging... #hashtags 🚀"
                        />
                    </div>
                </div>
            </div>

            {/* 2.2 Main Body — Split Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start relative mb-8">

                {/* LEFT (Video Zone) */}
                <div className="relative group h-full">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-400 to-blue-600 rounded-2xl opacity-75 group-hover:opacity-100 transition duration-200 blur"></div>
                    <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 h-full flex flex-col min-h-[400px]">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <Video className="text-blue-500" /> Video Zone
                            </h2>
                            {/* Tabs */}
                            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                <button
                                    onClick={() => setActiveTab("upload")}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${activeTab === "upload" ? "bg-white dark:bg-gray-600 shadow text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                    Upload
                                </button>
                                <button
                                    onClick={() => setActiveTab("tiktok")}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${activeTab === "tiktok" ? "bg-white dark:bg-gray-600 shadow text-pink-500" : "text-gray-500 hover:text-gray-700"}`}
                                >
                                    TikTok
                                </button>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col">
                            {activeTab === "upload" ? (
                                <div {...getVideoRootProps()} className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all
                                    ${isVideoDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                                    ${videoFile || videoUrl ? 'border-none p-0' : 'p-8'}`}>
                                    <input {...getVideoInputProps()} />
                                    {videoFile ? (
                                        <div className="relative w-full h-full rounded-xl overflow-hidden shadow-lg">
                                            <video src={videoFile.preview} className="w-full h-full object-cover" controls />
                                            <button onClick={(e) => { e.stopPropagation(); setVideoFile(null); }} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md transition-colors">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : videoUrl ? (
                                        <div className="relative w-full h-full rounded-xl overflow-hidden shadow-lg">
                                            <video src={videoUrl} className="w-full h-full object-cover" controls />
                                            <button onClick={(e) => { e.stopPropagation(); setVideoUrl(null); }} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md transition-colors">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Video size={32} />
                                            </div>
                                            <p className="text-gray-600 dark:text-gray-300 font-medium">Drag & drop video here</p>
                                            <p className="text-xs text-gray-400 mt-2">MP4, MOV (Auto-padded to 1:1)</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col gap-4">
                                    <div className="relative">
                                        <input
                                            type="url"
                                            value={tiktokUrl}
                                            onChange={(e) => setTiktokUrl(e.target.value)}
                                            placeholder="Paste TikTok URL..."
                                            className="w-full pl-4 pr-12 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-pink-500 outline-none"
                                        />
                                        <button
                                            onClick={handleTikTokFetch}
                                            disabled={loadingTiktok || !tiktokUrl}
                                            className="absolute right-2 top-2 bottom-2 px-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50 transition-colors flex items-center justify-center"
                                        >
                                            {loadingTiktok ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    {/* Preview Area for TikTok */}
                                    <div className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden relative">
                                        {videoUrl ? (
                                            <div className="relative w-full h-full">
                                                <video src={videoUrl} className="w-full h-full object-contain" controls />
                                                <button onClick={() => setVideoUrl(null)} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-gray-400 text-sm">Preview will appear here</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT (Image Gallery) */}
                <div className="relative group h-full">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-400 to-pink-600 rounded-2xl opacity-75 group-hover:opacity-100 transition duration-200 blur"></div>
                    <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 h-full flex flex-col min-h-[400px]">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <ImageIcon className="text-pink-500" /> Image Gallery
                            </h2>
                            <span className="px-3 py-1 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 text-xs font-semibold rounded-full border border-pink-100 dark:border-pink-800">
                                {imageFiles.length} Images
                            </span>
                        </div>

                        {/* Image Dropzone */}
                        <div {...getImageRootProps()} className={`min-h-[150px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all mb-4
                            ${isImageDragActive ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/10' : 'border-gray-300 dark:border-gray-700 hover:border-pink-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                            <input {...getImageInputProps()} />
                            <div className="text-center p-4">
                                <Plus className="w-8 h-8 text-pink-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Add Images</p>
                                <p className="text-xs text-gray-400">JPG, PNG (Auto-padded to 1:1)</p>
                            </div>
                        </div>

                        {/* Horizontal Scroll Gallery (Optimized for Mobile) */}
                        <div className="flex-1 overflow-x-auto custom-scrollbar pb-2 snap-x snap-mandatory">
                            <div className="flex gap-3 md:gap-4">
                                {imageFiles.length === 0 && (
                                    <div className="w-full h-32 flex items-center justify-center text-gray-400 text-sm italic border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900/50">
                                        No images selected
                                    </div>
                                )}
                                {imageFiles.map((file, index) => (
                                    <div
                                        key={index}
                                        className={`relative flex-shrink-0 w-24 h-24 md:w-40 md:h-40 rounded-lg md:rounded-xl overflow-hidden shadow-md group/img transition-transform duration-200 hover:scale-105 snap-center
                                            ${index > 3 ? 'hidden md:block' : ''} /* Limit to 4 on mobile */
                                        `}
                                    >
                                        <img
                                            src={file.preview}
                                            alt={`Upload ${index}`}
                                            loading="lazy"
                                            className="w-full h-full object-cover"
                                        />
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                                            className="absolute top-1 right-1 md:top-2 md:right-2 p-1 md:p-1.5 bg-red-500/80 text-white rounded-full hover:bg-red-600 opacity-100 md:opacity-0 group-hover/img:opacity-100 transition-all duration-200"
                                        >
                                            <Trash2 size={12} className="md:w-3.5 md:h-3.5" />
                                        </button>
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] md:text-xs py-0.5 md:py-1 px-2 text-center truncate">
                                            {file.name}
                                        </div>
                                    </div>
                                ))}
                                {imageFiles.length > 4 && (
                                    <div className="md:hidden flex-shrink-0 w-24 h-24 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 text-xs font-bold border border-gray-200 dark:border-gray-700 snap-center">
                                        +{imageFiles.length - 4} more
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2.3 Bottom Section — Action Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 flex flex-col sm:flex-row items-center justify-between gap-6">

                {/* Schedule Picker */}
                <div className="w-full sm:w-auto flex-1 max-w-md">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Schedule Post (Optional)</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="datetime-local"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all duration-200"
                        />
                    </div>
                </div>

                {/* Post Button */}
                <button
                    onClick={handleSubmit}
                    disabled={uploading}
                    className={`w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3
                        ${uploading ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-pink-600 hover:shadow-xl"}`}
                >
                    {uploading ? (
                        <>
                            <Loader2 className="animate-spin" /> Processing...
                        </>
                    ) : (
                        <>
                            <Send size={20} /> {scheduleTime ? "Schedule Post" : "Post Now"}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default CarouselPost;
