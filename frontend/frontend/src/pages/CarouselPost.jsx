import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { toast } from "react-hot-toast";

const CarouselPost = () => {
    const [videoFile, setVideoFile] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [caption, setCaption] = useState("");
    const [scheduleTime, setScheduleTime] = useState("");
    const [accounts, setAccounts] = useState([]);
    const [selectedAccounts, setSelectedAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
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

    // Video Dropzone (Left Box)
    const onDropVideo = (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file) return;

        // Check Video Dimensions (Warn if not 1:1)
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            if (video.videoWidth !== video.videoHeight) {
                toast("⚠️ Video is not 1:1. Black padding will be added automatically.", {
                    icon: "ℹ️",
                    style: {
                        borderRadius: '10px',
                        background: '#333',
                        color: '#fff',
                    },
                });
            }
            setVideoFile(Object.assign(file, {
                preview: URL.createObjectURL(file)
            }));
        };
        video.src = URL.createObjectURL(file);
    };

    const { getRootProps: getVideoRootProps, getInputProps: getVideoInputProps } = useDropzone({
        onDrop: onDropVideo,
        accept: { 'video/*': ['.mp4', '.mov'] },
        maxFiles: 1
    });

    // Image Dropzone (Right Box)
    const onDropImage = (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file) return;

        // Check Image Dimensions (Warn if not 1:1)
        const img = new Image();
        img.onload = () => {
            if (img.width !== img.height) {
                toast("⚠️ Image is not 1:1. Black padding will be added automatically.", {
                    icon: "ℹ️",
                    style: {
                        borderRadius: '10px',
                        background: '#333',
                        color: '#fff',
                    },
                });
            }
            setImageFile(Object.assign(file, {
                preview: URL.createObjectURL(file)
            }));
        };
        img.src = URL.createObjectURL(file);
    };

    const { getRootProps: getImageRootProps, getInputProps: getImageInputProps } = useDropzone({
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
            await axios.post(`${import.meta.env.VITE_API_BASE_URL}/posts/mixed-carousel`, formData, {
                withCredentials: true,
                headers: { "Content-Type": "multipart/form-data" },
            });
            toast.success("Carousel Posted Successfully!");
            // Reset
            setVideoFile(null);
            setImageFile(null);
            setCaption("");
            setScheduleTime("");
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || "Failed to post carousel");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-white">🎠 Mixed Media Carousel</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Left Box: Video */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        🎥 Video (Left)
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Auto-Pad Supported</span>
                    </h2>
                    <div {...getVideoRootProps()} className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors h-64 flex flex-col justify-center items-center bg-gray-50 dark:bg-gray-900">
                        <input {...getVideoInputProps()} />
                        {videoFile ? (
                            <div className="relative w-full h-full">
                                <video src={videoFile.preview} className="w-full h-full object-contain rounded" controls />
                                <button onClick={(e) => { e.stopPropagation(); setVideoFile(null); }} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">✕</button>
                            </div>
                        ) : (
                            <div className="text-gray-500">
                                <p className="text-4xl mb-2">📹</p>
                                <p>Drag & drop video here</p>
                                <p className="text-xs mt-2 text-gray-400">MP4, MOV (Auto-padded to 1:1)</p>
                            </div>
                        )}
                    </div>
                    {/* Right Box: Image */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            🖼️ Image (Right)
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Auto-Pad Supported</span>
                        </h2>
                        <div {...getImageRootProps()} className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors h-64 flex flex-col justify-center items-center bg-gray-50 dark:bg-gray-900">
                            <input {...getImageInputProps()} />
                            {imageFile ? (
                                <div className="relative w-full h-full">
                                    <img src={imageFile.preview} alt="Preview" className="w-full h-full object-contain rounded" />
                                    <button onClick={(e) => { e.stopPropagation(); setImageFile(null); }} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">✕</button>
                                </div>
                            ) : (
                                <div className="text-gray-500">
                                    <p className="text-4xl mb-2">🖼️</p>
                                    <p>Drag & drop image here</p>
                                    <p className="text-xs mt-2 text-gray-400">JPG, PNG (Auto-padded to 1:1)</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Caption</label>
                    <textarea
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        rows="3"
                        placeholder="Write something..."
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Select Pages</label>
                    <div className="flex flex-wrap gap-3">
                        {accounts.map(page => (
                            <button
                                key={page.id}
                                onClick={() => {
                                    setSelectedAccounts(prev =>
                                        prev.includes(page.id) ? prev.filter(id => id !== page.id) : [...prev, page.id]
                                    );
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${selectedAccounts.includes(page.id)
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                                    }`}
                            >
                                <img src={page.picture} alt={page.name} className="w-6 h-6 rounded-full" />
                                {page.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Schedule (Optional)</label>
                        <input
                            type="datetime-local"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={uploading || !videoFile || !imageFile || selectedAccounts.length === 0}
                    className={`w-full py-4 rounded-xl text-lg font-bold text-white transition-all transform hover:scale-[1.01] ${uploading
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl"
                        }`}
                >
                    {uploading ? "Processing & Uploading..." : "🚀 Publish Carousel"}
                </button>
            </div>
        </div >
    );
};

export default CarouselPost;
