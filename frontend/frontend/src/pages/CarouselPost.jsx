```javascript
import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Upload, X, Image as ImageIcon, Video, Calendar, Send, CheckCircle, Loader2 } from "lucide-react";

const CarouselPost = () => {
    const [videoFile, setVideoFile] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [caption, setCaption] = useState("");
    const [scheduleTime, setScheduleTime] = useState("");
    const [accounts, setAccounts] = useState([]);
    const [selectedAccounts, setSelectedAccounts] = useState([]);
    const [uploading, setUploading] = useState(false);

    // Fetch Pages
    useEffect(() => {
        const fetchPages = async () => {
            try {
                const res = await axios.get(`${ import.meta.env.VITE_API_BASE_URL } /user/pages`, {
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
        };
        video.src = URL.createObjectURL(file);
    };

    const { getRootProps: getVideoRootProps, getInputProps: getVideoInputProps, isDragActive: isVideoDragActive } = useDropzone({
        onDrop: onDropVideo,
        accept: { 'video/*': ['.mp4', '.mov'] },
        maxFiles: 1
    });

    // Image Dropzone
    const onDropImage = (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file) return;

        const img = new Image();
        img.onload = () => {
            if (img.width !== img.height) {
                toast("⚠️ Image will be auto-padded to 1:1", {
                    icon: "ℹ️",
                    style: { borderRadius: '10px', background: '#333', color: '#fff' },
                });
            }
            setImageFile(Object.assign(file, { preview: URL.createObjectURL(file) }));
        };
        img.src = URL.createObjectURL(file);
    };

    const { getRootProps: getImageRootProps, getInputProps: getImageInputProps, isDragActive: isImageDragActive } = useDropzone({
        onDrop: onDropImage,
        accept: { 'image/*': ['.jpg', '.jpeg', '.png'] },
        maxFiles: 1
    });

    const handleSubmit = async () => {
        if (!videoFile || !imageFile) return toast.error("Please upload both video and image");
        if (selectedAccounts.length === 0) return toast.error("Please select at least one page");

        setUploading(true);
        const formData = new FormData();
        formData.append("video", videoFile);
        formData.append("image", imageFile);
        formData.append("caption", caption);
        formData.append("accounts", JSON.stringify(selectedAccounts));
        if (scheduleTime) formData.append("scheduleTime", scheduleTime);

        try {
            await axios.post(`${ import.meta.env.VITE_API_BASE_URL } /posts/mixed - carousel`, formData, {
                withCredentials: true,
                headers: { "Content-Type": "multipart/form-data" },
            });
            toast.success("Carousel Posted Successfully!");
            setVideoFile(null);
            setImageFile(null);
            setCaption("");
            setScheduleTime("");
            setSelectedAccounts([]);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Failed to post carousel");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 md:p-12">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-10 text-center">
                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 mb-2">
                        Mixed Media Carousel
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 text-lg">
                        Create engaging stories with Video & Image side-by-side.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Media Uploads */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Video Upload */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700 transition-all hover:shadow-2xl">
                                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                    <h2 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                        <Video className="w-5 h-5 text-blue-500" /> Video Part
                                    </h2>
                                    <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Auto-Pad 1:1</span>
                                </div>
                                <div {...getVideoRootProps()} className={`relative h - 64 m - 4 rounded - xl border - 2 border - dashed transition - all cursor - pointer flex flex - col justify - center items - center
                                    ${ isVideoDragActive ? 'border-blue-500 bg-blue-50 dark:bg-gray-700' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700' } `}>
                                    <input {...getVideoInputProps()} />
                                    {videoFile ? (
                                        <div className="relative w-full h-full group">
                                            <video src={videoFile.preview} className="w-full h-full object-contain rounded-lg" controls />
                                            <button onClick={(e) => { e.stopPropagation(); setVideoFile(null); }} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center p-6">
                                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Upload className="w-8 h-8" />
                                            </div>
                                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Drag & drop video</p>
                                            <p className="text-xs text-gray-400 mt-1">MP4, MOV (Max 500MB)</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Image Upload */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700 transition-all hover:shadow-2xl">
                                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-gray-700 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                    <h2 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                        <ImageIcon className="w-5 h-5 text-purple-500" /> Image Part
                                    </h2>
                                    <span className="text-xs font-medium px-2 py-1 bg-purple-100 text-purple-700 rounded-full">Auto-Pad 1:1</span>
                                </div>
                                <div {...getImageRootProps()} className={`relative h - 64 m - 4 rounded - xl border - 2 border - dashed transition - all cursor - pointer flex flex - col justify - center items - center
                                    ${ isImageDragActive ? 'border-purple-500 bg-purple-50 dark:bg-gray-700' : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-gray-50 dark:hover:bg-gray-700' } `}>
                                    <input {...getImageInputProps()} />
                                    {imageFile ? (
                                        <div className="relative w-full h-full group">
                                            <img src={imageFile.preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                                            <button onClick={(e) => { e.stopPropagation(); setImageFile(null); }} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center p-6">
                                            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Upload className="w-8 h-8" />
                                            </div>
                                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Drag & drop image</p>
                                            <p className="text-xs text-gray-400 mt-1">JPG, PNG</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Caption */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                ✨ Caption & Hashtags
                            </label>
                            <textarea
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                                rows="4"
                                placeholder="Write something engaging..."
                            />
                        </div>
                    </div>

                    {/* Right Column: Settings & Publish */}
                    <div className="space-y-6">
                        {/* Page Selection */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-500" /> Select Pages
                            </h3>
                            <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                                {accounts.map(page => (
                                    <div
                                        key={page.id}
                                        onClick={() => {
                                            setSelectedAccounts(prev =>
                                                prev.includes(page.id) ? prev.filter(id => id !== page.id) : [...prev, page.id]
                                            );
                                        }}
                                        className={`flex items - center gap - 3 p - 3 rounded - xl cursor - pointer border transition - all ${
    selectedAccounts.includes(page.id)
    ? "bg-blue-50 border-blue-500 dark:bg-blue-900/20 dark:border-blue-500"
    : "bg-gray-50 border-transparent hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600"
} `}
                                    >
                                        <div className={`w - 5 h - 5 rounded - full border - 2 flex items - center justify - center ${ selectedAccounts.includes(page.id) ? 'border-blue-500 bg-blue-500' : 'border-gray-300' } `}>
                                            {selectedAccounts.includes(page.id) && <CheckCircle className="w-3 h-3 text-white" />}
                                        </div>
                                        <img src={page.picture} alt={page.name} className="w-10 h-10 rounded-full border border-gray-200" />
                                        <span className="font-medium text-gray-700 dark:text-gray-200 truncate">{page.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Schedule */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-orange-500" /> Schedule
                            </h3>
                            <input
                                type="datetime-local"
                                value={scheduleTime}
                                onChange={(e) => setScheduleTime(e.target.value)}
                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={uploading || !videoFile || !imageFile || selectedAccounts.length === 0}
                            className={`w - full py - 4 rounded - xl text - lg font - bold text - white shadow - lg transition - all transform hover: scale - [1.02] active: scale - [0.98] flex items - center justify - center gap - 2
                                ${
    uploading
        ? "bg-gray-400 cursor-not-allowed"
        : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-blue-500/30"
} `}
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin" /> Publishing...
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5" /> Publish Carousel
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CarouselPost;
```
