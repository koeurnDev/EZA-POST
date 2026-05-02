import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MotionDiv = motion.div;
const MotionAnimatePresence = AnimatePresence;
import DashboardLayout from "../layouts/DashboardLayout";
import { UploadCloud, Calendar, Clock, Check, X, Loader, FileVideo, AlertCircle, Trash2, Send, Filter, Settings } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";

export default function BulkPost() {
    // State
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [availablePages, setAvailablePages] = useState([]);
    const [selectedPage, setSelectedPage] = useState("");

    // Scheduler State
    const [startDate, setStartDate] = useState("");
    const [intervalHours, setIntervalHours] = useState(24); // Default 1 day
    const [commonCaption, setCommonCaption] = useState("");

    // Processed Items
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
        setFiles(prev => [...prev, ...selected]);
    };

    // 🚀 Start Bulk Upload
    const startUpload = async () => {
        const pendingItems = items.filter(i => i.status === "pending");
        if (pendingItems.length === 0) return toast.error("No pending files to upload");

        setUploading(true);
        const toastId = toast.loading(`Uploading ${pendingItems.length} videos...`);

        try {
            const CHUNK_SIZE = 5;
            for (let i = 0; i < pendingItems.length; i += CHUNK_SIZE) {
                const chunk = pendingItems.slice(i, i + CHUNK_SIZE);
                const formData = new FormData();
                chunk.forEach(item => formData.append("videos", item.file));

                toast.loading(`Uploading batch ${Math.floor(i / CHUNK_SIZE) + 1}...`, { id: toastId });

                const res = await api.post("/upload/video", formData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });

                if (res.data.success) {
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
            applyAutoSchedule(items);
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
                caption: item.caption || commonCaption,
                scheduleTime: scheduledTime.toISOString()
            };
        }));
    }, [startDate, intervalHours, commonCaption]);

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
                <MotionDiv 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/30">
                            <UploadCloud size={24} />
                        </div>
                        Bulk Upload
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Upload up to 50 videos and auto-schedule them with human-like intervals.</p>
                </MotionDiv>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* 👈 Left Panel: Controls (Col-span 4) */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* 1. Page Selection */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Filter size={16} /> 1. Target Page
                            </h3>
                            <select
                                value={selectedPage}
                                onChange={(e) => setSelectedPage(e.target.value)}
                                className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white font-medium"
                            >
                                {availablePages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        {/* 2. Common Settings */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Settings size={16} /> 2. Auto-Scheduler
                            </h3>

                            <div className="space-y-5">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 block">Start Date & Time</label>
                                    <input
                                        type="datetime-local"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 block">Post Frequency</label>
                                    <select
                                        value={intervalHours}
                                        onChange={(e) => setIntervalHours(Number(e.target.value))}
                                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white font-medium"
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
                                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 block">Common Caption</label>
                                    <textarea
                                        value={commonCaption}
                                        onChange={(e) => setCommonCaption(e.target.value)}
                                        placeholder="Add a caption for all videos..."
                                        className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white h-24 resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. Action */}
                        <Button
                            onClick={handleSubmit}
                            disabled={uploading || items.length === 0}
                            isLoading={uploading}
                            fullWidth
                            size="large"
                            className="rounded-3xl py-6 text-lg"
                        >
                            <Send size={20} /> Schedule {items.length} Posts
                        </Button>
                    </div>

                    {/* 👉 Right Panel: File List (Col-span 8) */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Drop Zone */}
                        <MotionDiv 
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className="block w-full border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 rounded-3xl p-10 text-center cursor-pointer transition-all"
                        >
                            <input type="file" id="bulk-file-input" multiple accept="video/*" onChange={handleFileSelect} className="hidden" />
                            <div onClick={() => document.getElementById('bulk-file-input').click()} className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <UploadCloud size={32} />
                            </div>
                            <h3 onClick={() => document.getElementById('bulk-file-input').click()} className="text-xl font-bold text-gray-900 dark:text-white">Click to Select Videos</h3>
                            <p onClick={() => document.getElementById('bulk-file-input').click()} className="text-gray-500 dark:text-gray-400 mt-2">MP4, MOV, WEBM (Max 50MB each)</p>
                        </MotionDiv>

                        {/* File Table */}
                        <MotionAnimatePresence>
                            {items.length > 0 && (
                                <MotionDiv 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm"
                                >
                                    <div className="p-5 bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                        <h3 className="font-bold text-gray-900 dark:text-white">Upload Queue ({items.length})</h3>
                                        {items.some(i => i.status === "pending") && (
                                            <Button
                                                onClick={startUpload}
                                                isLoading={uploading}
                                                size="small"
                                                variant="primary"
                                                className="rounded-full"
                                            >
                                                <UploadCloud size={16} /> Start Upload
                                            </Button>
                                        )}
                                    </div>
                                    <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
                                        {items.map((item, idx) => (
                                            <MotionDiv 
                                                key={item.id} 
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
                                                        <FileVideo className="text-gray-400 dark:text-gray-500" size={24} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="overflow-hidden">
                                                                <h4 className="font-bold text-gray-900 dark:text-white truncate">{item.name}</h4>
                                                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{item.size}</p>
                                                            </div>
                                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-tighter ${item.status === 'uploaded' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                                item.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                                                }`}>
                                                                {item.status}
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                                                            <input
                                                                type="text"
                                                                placeholder="Override caption..."
                                                                value={item.caption}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setItems(prev => prev.map((i, x) => x === idx ? { ...i, caption: val } : i));
                                                                }}
                                                                className="text-xs p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-1 focus:ring-blue-500 outline-none w-full"
                                                            />
                                                            <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-2 rounded-lg border border-gray-100 dark:border-gray-700">
                                                                <Calendar size={14} className="text-blue-500" />
                                                                <span className="font-medium">
                                                                    {item.scheduleTime ? new Date(item.scheduleTime).toLocaleString() : "Syncing..."}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setItems(prev => prev.filter((_, x) => x !== idx))}
                                                        className="p-2 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </MotionDiv>
                                        ))}
                                    </div>
                                </MotionDiv>
                            )}
                        </MotionAnimatePresence>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
