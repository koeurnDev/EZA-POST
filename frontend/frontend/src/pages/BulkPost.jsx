import React, { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { UploadCloud, Calendar, Clock, Check, X, Loader, FileVideo, AlertCircle } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";

export default function BulkPost() {
    // State
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0); // Simulated
    const [availablePages, setAvailablePages] = useState([]);
    const [selectedPage, setSelectedPage] = useState("");

    // Scheduler State
    const [startDate, setStartDate] = useState("");
    const [intervalHours, setIntervalHours] = useState(24); // Default 1 day
    const [commonCaption, setCommonCaption] = useState("");

    // Processed Items (After upload logic or local preview)
    const [items, setItems] = useState([]);

    // 🔄 Fetch Pages
    useEffect(() => {
        api.get("/user/pages").then(res => {
            if (res.data.success) {
                setAvailablePages(res.data.accounts);
                if (res.data.accounts.length > 0) setSelectedPage(res.data.accounts[0].id);
            }
        });
    }, []);

    // 📂 Handle File Selection
    const handleFileSelect = (e) => {
        const selected = Array.from(e.target.files);
        if (selected.length > 50) return toast.error("Max 50 files allowed");

        // Create preview items
        const newItems = selected.map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file: file,
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(1) + "MB",
            status: "pending", // pending, uploaded, error
            videoUrl: null,
            caption: "",
            scheduleTime: null
        }));

        setItems(prev => [...prev, ...newItems]);
        setFiles(prev => [...prev, ...selected]); // Keep raw files if needed
    };

    // 🚀 Start Bulk Upload
    const startUpload = async () => {
        const pendingItems = items.filter(i => i.status === "pending");
        if (pendingItems.length === 0) return toast.error("No pending files to upload");

        setUploading(true);
        const toastId = toast.loading(`Uploading ${pendingItems.length} videos...`);

        try {
            // We'll upload in chunks of 5 to avoid timeouts/memory issues
            const CHUNK_SIZE = 5;
            for (let i = 0; i < pendingItems.length; i += CHUNK_SIZE) {
                const chunk = pendingItems.slice(i, i + CHUNK_SIZE);
                const formData = new FormData();
                chunk.forEach(item => formData.append("videos", item.file));

                // Update progress message
                toast.loading(`Uploading batch ${Math.floor(i / CHUNK_SIZE) + 1}...`, { id: toastId });

                const res = await api.post("/upload/video", formData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });

                if (res.data.success) {
                    // Match results back to items by originalName or index
                    // Since backend returns array corresponding to input, we iterate
                    res.data.files.forEach((uploadedFile) => {
                        setItems(prev => prev.map(item => {
                            if (item.name === uploadedFile.originalName && item.status === "pending") {
                                return {
                                    ...item,
                                    status: "uploaded",
                                    videoUrl: uploadedFile.url
                                };
                            }
                            return item;
                        }));
                    });
                }
            }
            toast.success("All uploads complete!", { id: toastId });
            applyAutoSchedule(items); // Re-apply schedule just in case
        } catch (err) {
            console.error(err);
            toast.error("Upload failed", { id: toastId });
        } finally {
            setUploading(false);
        }
    };

    // 🗓️ Auto-Schedule Logic
    const applyAutoSchedule = useCallback(() => {
        if (!startDate) return;

        const start = new Date(startDate);
        setItems(prev => prev.map((item, index) => {
            const scheduledTime = new Date(start.getTime() + index * intervalHours * 60 * 60 * 1000);
            return {
                ...item,
                caption: item.caption || commonCaption, // Apply common caption if empty
                scheduleTime: scheduledTime.toISOString()
            };
        }));
    }, [startDate, intervalHours, commonCaption]);

    // Apply when settings change
    useEffect(() => {
        applyAutoSchedule();
    }, [startDate, intervalHours, commonCaption, applyAutoSchedule]);

    // 📤 Final Submit
    const handleSubmit = async () => {
        const readyItems = items.filter(i => i.status === "uploaded");
        if (readyItems.length === 0) return toast.error("Please upload videos first");
        if (!selectedPage) return toast.error("Please select a page");

        const postsPayload = readyItems.map(item => ({
            caption: item.caption || commonCaption,
            videoUrl: item.videoUrl,
            accounts: [selectedPage],
            scheduleTime: item.scheduleTime
        }));

        const toastId = toast.loading("Scheduling posts...");
        try {
            const res = await api.post("/posts/bulk", { posts: postsPayload });
            if (res.data.success) {
                toast.success(`Successfully scheduled ${res.data.count} posts!`, { id: toastId });
                setItems([]);
                setFiles([]);
            }
        } catch (err) {
            toast.error("Failed to schedule posts", { id: toastId });
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <UploadCloud className="text-blue-500" />
                            Bulk Video Upload
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">Upload up to 50 videos and auto-schedule them.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* 👈 Left Panel: Controls */}
                    <div className="space-y-6">
                        {/* 1. Page Selection */}
                        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">1. Post To</label>
                            <select
                                value={selectedPage}
                                onChange={(e) => setSelectedPage(e.target.value)}
                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900"
                            >
                                {availablePages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        {/* 2. Common Settings */}
                        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="font-bold text-gray-800 dark:text-white mb-4">2. Auto-Scheduler</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Start Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full mt-1 p-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-900"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Frequency</label>
                                    <select
                                        value={intervalHours}
                                        onChange={(e) => setIntervalHours(Number(e.target.value))}
                                        className="w-full mt-1 p-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-900"
                                    >
                                        <option value={1}>Every 1 Hour</option>
                                        <option value={3}>Every 3 Hours</option>
                                        <option value={6}>Every 6 Hours</option>
                                        <option value={12}>Every 12 Hours</option>
                                        <option value={24}>Every 24 Hours (1/Day)</option>
                                        <option value={48}>Every 48 Hours (1/2 Days)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Default Caption</label>
                                    <textarea
                                        value={commonCaption}
                                        onChange={(e) => setCommonCaption(e.target.value)}
                                        placeholder="Caption for all videos..."
                                        className="w-full mt-1 p-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-900 h-24 resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. Action */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 md:p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
                            <button
                                onClick={handleSubmit}
                                disabled={uploading || items.length === 0}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Schedule {items.length} Posts
                            </button>
                        </div>
                    </div>

                    {/* 👉 Right Panel: File List */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Drop Zone */}
                        <label className="block w-full border-3 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 rounded-3xl p-6 md:p-10 text-center cursor-pointer transition-all">
                            <input type="file" multiple accept="video/*" onChange={handleFileSelect} className="hidden" />
                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <UploadCloud size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-200">Click to Select Videos</h3>
                            <p className="text-gray-500 mt-2">MP4, MOV, WEBM (Max 50MB each)</p>
                        </label>

                        {/* File Table */}
                        {items.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                    <h3 className="font-bold">Queue ({items.length})</h3>
                                    {items.some(i => i.status === "pending") && (
                                        <button
                                            onClick={startUpload}
                                            disabled={uploading}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg flex items-center gap-2"
                                        >
                                            {uploading ? <Loader className="animate-spin" size={16} /> : <UploadCloud size={16} />}
                                            {uploading ? "Uploading..." : "Start Upload"}
                                        </button>
                                    )}
                                </div>
                                <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
                                    {items.map((item, idx) => (
                                        <div key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <FileVideo className="text-gray-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate pr-4">{item.name}</h4>
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${item.status === 'uploaded' ? 'bg-green-100 text-green-700' :
                                                            item.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                                                            }`}>
                                                            {item.status.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Caption..."
                                                            value={item.caption}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setItems(prev => prev.map((i, x) => x === idx ? { ...i, caption: val } : i));
                                                            }}
                                                            className="text-sm p-2 rounded border border-gray-200 dark:border-gray-600 dark:bg-gray-900 w-full"
                                                        />
                                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                                            <Calendar size={14} />
                                                            {item.scheduleTime ? new Date(item.scheduleTime).toLocaleString() : "Not scheduled"}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setItems(prev => prev.filter((_, x) => x !== idx))}
                                                    className="text-gray-400 hover:text-red-500"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
