import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Upload, X, Image as ImageIcon, Video, Calendar, Send, CheckCircle, Loader2, ArrowRight, Plus } from "lucide-react";

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
        accept: { "video/*": [] },
        maxFiles: 1,
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
        accept: { "image/*": [] },
        maxFiles: 1,
    });

    // Handle Submit
    const handleSubmit = async () => {
        if (!videoFile || !imageFile) return toast.error("Please upload both video and image!");
        if (selectedAccounts.length === 0) return toast.error("Please select at least one page!");

        setUploading(true);
        const formData = new FormData();
        formData.append("video", videoFile);
        formData.append("image", imageFile);
        formData.append("caption", caption);
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
                setImageFile(null);
                setCaption("");
                setScheduleTime("");
                setSelectedAccounts([]);
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
        <div className="max-w-6xl mx-auto pb-20">
            {/* Header */}
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-pink-600 bg-clip-text text-transparent">
                    Mixed Media Carousel
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    Combine Video & Image into a seamless carousel experience.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start relative">

                {/* 🔵 Step 1: Video Card */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-400 to-blue-600 rounded-2xl opacity-75 group-hover:opacity-100 transition duration-200 blur"></div>
                    <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">1</div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Video Part</h2>
                            </div>
                            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-full border border-blue-100 dark:border-blue-800">
                                Left Side
                            </span>
                        </div>

                        <div {...getVideoRootProps()} className={`flex-1 min-h-[300px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all
                            ${isVideoDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                            ${videoFile ? 'border-none p-0' : 'p-8'}`}>
                            <input {...getVideoInputProps()} />
                            {videoFile ? (
                                <div className="relative w-full h-full rounded-xl overflow-hidden shadow-lg">
                                    <video src={videoFile.preview} className="w-full h-full object-cover" controls />
                                    <button onClick={(e) => { e.stopPropagation(); setVideoFile(null); }} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md transition-colors">
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
                    </div>
                </div>

                {/* ➕ Visual Connector (Desktop) */}
                <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full shadow-xl border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-400">
                        <Plus size={24} />
                    </div>
                </div>

                {/* 🌸 Step 2: Image Card */}
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-400 to-pink-600 rounded-2xl opacity-75 group-hover:opacity-100 transition duration-200 blur"></div>
                    <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 dark:text-pink-400 font-bold text-lg">2</div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Image Part</h2>
                            </div>
                            <span className="px-3 py-1 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 text-xs font-semibold rounded-full border border-pink-100 dark:border-pink-800">
                                Right Side
                            </span>
                        </div>

                        <div {...getImageRootProps()} className={`flex-1 min-h-[300px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all
                            ${isImageDragActive ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/10' : 'border-gray-300 dark:border-gray-700 hover:border-pink-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                            ${imageFile ? 'border-none p-0' : 'p-8'}`}>
                            <input {...getImageInputProps()} />
                            {imageFile ? (
                                <div className="relative w-full h-full rounded-xl overflow-hidden shadow-lg">
                                    <img src={imageFile.preview} className="w-full h-full object-cover" alt="Preview" />
                                    <button onClick={(e) => { e.stopPropagation(); setImageFile(null); }} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md transition-colors">
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <ImageIcon size={32} />
                                    </div>
                                    <p className="text-gray-600 dark:text-gray-300 font-medium">Drag & drop image here</p>
                                    <p className="text-xs text-gray-400 mt-2">JPG, PNG (Auto-padded to 1:1)</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 📝 Step 3: Details & Publish */}
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-lg">3</div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Finalize & Publish</h2>
                </div>

                <div className="space-y-6">
                    {/* Caption */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Caption</label>
                        <textarea
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-32"
                            placeholder="Write something engaging..."
                        />
                    </div>

                    {/* Schedule */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Schedule (Optional)</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="datetime-local"
                                value={scheduleTime}
                                onChange={(e) => setScheduleTime(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Page Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select Pages</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={uploading}
                        className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all transform hover:scale-[1.01] active:scale-[0.99]
                            ${uploading ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-pink-600 hover:shadow-xl"}`}
                    >
                        {uploading ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="animate-spin" /> Processing...
                            </span>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                <Send size={20} /> Publish Mixed Carousel
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CarouselPost;
