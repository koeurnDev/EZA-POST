import React, { useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Search, Download, Check, AlertCircle, Play, Save, User, Grid, CheckSquare, Square } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function TikTokDownloader() {
    const [activeTab, setActiveTab] = useState("single"); // 'single' | 'profile'

    // Single Video State
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [videoData, setVideoData] = useState(null);
    const [saving, setSaving] = useState(false);
    const [downloadHistory, setDownloadHistory] = useState([]);

    // Profile Bulk State
    const [profileInput, setProfileInput] = useState("");
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileData, setProfileData] = useState(null); // { profile, videos }
    const [selectedVideos, setSelectedVideos] = useState(new Set());

    // 🔍 Step 1: Single Video Lookup
    const handleLookup = async () => {
        if (!url.includes("tiktok.com")) return toast.error("Please enter a valid TikTok URL");
        setLoading(true);
        setVideoData(null);
        const toastId = toast.loading("Fetching video info...");
        try {
            const res = await api.post("/tools/tiktok/lookup", { url });
            if (res.data.success) {
                setVideoData(res.data.video);
                toast.success(
                    (t) => (
                        <div className="flex flex-col gap-2">
                            <p className="font-semibold">✅ Video found!</p>
                            <button
                                onClick={() => {
                                    handleDownloadAnother();
                                    toast.dismiss(t.id);
                                }}
                                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                            >
                                🔄 Download Another
                            </button>
                        </div>
                    ),
                    { id: toastId, duration: 5000 }
                );
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to find video", { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    // 👤 Step 1: Profile Lookup
    const handleProfileLookup = async () => {
        if (!profileInput) return toast.error("Enter a username or URL");
        setProfileLoading(true);
        setProfileData(null);
        setSelectedVideos(new Set());
        const toastId = toast.loading("Fetching profile videos...");
        try {
            const res = await api.post("/tools/tiktok/profile", { username: profileInput });
            if (res.data.success) {
                setProfileData(res.data);
                toast.success(`Found ${res.data.videos.length} videos!`, { id: toastId });
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to fetch profile", { id: toastId });
        } finally {
            setProfileLoading(false);
        }
    };

    // 📥 Step 2: Download Single (Save to App)
    const handleSaveToApp = async () => {
        if (!videoData) return;
        setSaving(true);
        const toastId = toast.loading("Downloading to library...");
        try {
            const res = await api.post("/tools/tiktok/download", {
                url: videoData.no_watermark_url,
                title: videoData.title
            });
            if (res.data.success) toast.success("Saved to Library! Ready for post.", { id: toastId });
        } catch (err) {
            toast.error("Failed to save video", { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    // 🔄 Download Another Handler
    const handleDownloadAnother = () => {
        if (videoData) {
            setDownloadHistory(prev => [{
                id: Date.now(),
                title: videoData.title,
                thumbnail: videoData.thumbnail,
                url: videoData.no_watermark_url,
                timestamp: new Date().toLocaleTimeString()
            }, ...prev]);
        }
        setUrl('');
        setVideoData(null);
        // Focus input after short delay
        setTimeout(() => {
            document.querySelector('input[type="text"]')?.focus();
        }, 100);
    };

    // ☑️ Selection Logic
    const toggleSelect = (id) => {
        const newSet = new Set(selectedVideos);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedVideos(newSet);
    };

    const toggleSelectAll = () => {
        if (!profileData) return;
        if (selectedVideos.size === profileData.videos.length) {
            setSelectedVideos(new Set()); // Deselect all
        } else {
            const allIds = new Set(profileData.videos.map(v => v.id));
            setSelectedVideos(allIds);
        }
    };

    // 📦 Bulk Download
    const handleBulkDownload = () => {
        const videosToDownload = profileData.videos.filter(v => selectedVideos.has(v.id));
        if (videosToDownload.length === 0) return toast.error("Select videos first");

        toast((t) => (
            <div>
                <p className="font-bold">Starting {videosToDownload.length} downloads...</p>
                <p className="text-xs mt-1">⚠️ If only 1 downloads, check your browser address bar for "Pop-ups blocked" and allow them!</p>
            </div>
        ), { duration: 5000, icon: '🚀' });

        videosToDownload.forEach((v, idx) => {
            setTimeout(() => {
                const targetUrl = v.no_watermark_url || v.images[0];
                const safeFilename = `tiktok-${v.id}`;
                // Use Proxy to force download
                const proxyUrl = `http://localhost:5000/api/tools/tiktok/proxy?url=${encodeURIComponent(targetUrl)}&filename=${safeFilename}`;

                const link = document.createElement('a');
                link.href = proxyUrl;
                // link.download is ignored by some browsers on cross-origin, but Proxy Content-Disposition fixes it.
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }, idx * 1000); // 1s stagger to be gentle
        });
    };

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
                        TikTok <span className="text-pink-500">Master Tool</span>
                    </h1>
                    <p className="text-gray-500">Download Single Videos (No Watermark) or Bulk User Profiles.</p>
                </div>

                {/* 📑 Tabs */}
                <div className="flex justify-center gap-4 mb-8">
                    <button
                        onClick={() => setActiveTab("single")}
                        className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === "single"
                            ? "bg-gray-900 text-white dark:bg-white dark:text-black shadow-lg"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                            }`}
                    >
                        <Play size={18} /> Single Video
                    </button>
                    <button
                        onClick={() => setActiveTab("profile")}
                        className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === "profile"
                            ? "bg-gray-900 text-white dark:bg-white dark:text-black shadow-lg"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                            }`}
                    >
                        <User size={18} /> Bulk Profile
                    </button>
                </div>

                {/* ==================== SINGLE VIDEO TAB ==================== */}
                {activeTab === "single" && (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                        {/* 🔍 Search Box */}
                        <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 flex items-center gap-2 mb-8 transform transition-all hover:scale-[1.005]">
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                                placeholder="Paste TikTok link here (e.g., https://vt.tiktok.com/...)"
                                className="flex-1 bg-transparent p-4 outline-none text-lg text-gray-700 dark:text-gray-200"
                            />
                            <button
                                onClick={handleLookup}
                                disabled={loading}
                                className="bg-pink-600 hover:bg-pink-700 text-white px-8 py-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? "Searching..." : <><Search size={20} /> Search</>}
                            </button>
                        </div>

                        {/* 🎥 Result Card */}
                        {videoData && (
                            <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row animate-in fade-in slide-in-from-bottom-4 duration-500">

                                {/* 🖼️ Preview Area (Video OR Image Grid) */}
                                <div className="w-full md:w-1/3 bg-black/5 md:bg-black relative group overflow-y-auto max-h-[600px] border-r border-gray-100 dark:border-gray-700">
                                    {videoData.images && videoData.images.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-1 p-1">
                                            {videoData.images.map((img, idx) => (
                                                <div key={idx} className="relative group/img aspect-[3/4] overflow-hidden rounded-sm">
                                                    <img src={img} className="w-full h-full object-cover" alt={`Slide ${idx}`} />
                                                    <a
                                                        href={img}
                                                        download={`tiktok-slide-${idx}.jpg`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity"
                                                    >
                                                        <Download className="text-white" size={24} />
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="aspect-[9/16] md:aspect-auto h-full bg-black flex items-center justify-center">
                                            <video
                                                src={videoData.no_watermark_url}
                                                className="w-full h-full object-contain"
                                                controls
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Info & Actions */}
                                <div className="w-full md:w-2/3 p-8 flex flex-col">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-2 mb-2">
                                        {videoData.title || "Untitled TikTok"}
                                    </h3>
                                    <div className="flex items-center gap-2 text-gray-500 mb-6">
                                        <span className="font-semibold text-pink-500">@{videoData.author}</span>
                                        <span>•</span>
                                        {videoData.images?.length > 0 ? (
                                            <span className="flex items-center gap-1"><Check size={14} /> {videoData.images.length} Images</span>
                                        ) : (
                                            <span>No Watermark Video</span>
                                        )}
                                    </div>

                                    <div className="mt-auto space-y-3">
                                        {videoData.images?.length > 0 ? (
                                            <button
                                                onClick={() => {
                                                    videoData.images.forEach((img, idx) => {
                                                        setTimeout(() => {
                                                            const link = document.createElement('a');
                                                            link.href = img;
                                                            link.download = `tiktok-slide-${idx}-${Date.now()}.jpg`;
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            document.body.removeChild(link);
                                                        }, idx * 300); // Stagger downloads
                                                    });
                                                    toast.success(`Downloading ${videoData.images.length} images...`);
                                                }}
                                                className="w-full py-4 border-2 border-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/10 text-pink-600 dark:text-pink-400 font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                                            >
                                                <Download size={20} /> Download All Images ({videoData.images.length})
                                            </button>
                                        ) : (
                                            <a
                                                href={videoData.no_watermark_url}
                                                target="_blank"
                                                download
                                                className="w-full py-4 border-2 border-gray-200 dark:border-gray-700 hover:border-gray-900 dark:hover:border-white text-gray-700 dark:text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                                            >
                                                <Download size={20} /> Download Video
                                            </a>
                                        )}

                                        {!videoData.images?.length && (
                                            <button
                                                onClick={handleSaveToApp}
                                                disabled={saving}
                                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
                                            >
                                                {saving ? "Saving..." : <><Save size={20} /> Save to Library (For Scheduling)</>}
                                            </button>
                                        )}

                                        <p className="text-center text-xs text-gray-400 mt-2">
                                            {videoData.images?.length > 0
                                                ? "Images will be downloaded individually."
                                                : "Saved videos can be found in your 'Bulk Upload' local files."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 📜 Download History */}
                        {downloadHistory.length > 0 && (
                            <div className="mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 p-6 rounded-2xl border border-blue-100 dark:border-gray-700">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        📜 Download History ({downloadHistory.length})
                                    </h3>
                                    <button
                                        onClick={() => setDownloadHistory([])}
                                        className="px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                                    >
                                        Clear All
                                    </button>
                                </div>
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {downloadHistory.map((item) => (
                                        <div key={item.id} className="flex items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                                            <img src={item.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
                                                <p className="text-xs text-gray-500">{item.timestamp}</p>
                                            </div>
                                            <a
                                                href={item.url}
                                                download
                                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                            >
                                                <Download size={16} /> Download
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ==================== BULK PROFILE TAB ==================== */}
                {activeTab === "profile" && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        {/* 🔍 Profile Search */}
                        <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 flex items-center gap-2 mb-8 max-w-2xl mx-auto">
                            <span className="pl-4 text-gray-400 font-bold select-none">@</span>
                            <input
                                type="text"
                                value={profileInput}
                                onChange={(e) => setProfileInput(e.target.value.replace('@', ''))}
                                onKeyDown={(e) => e.key === "Enter" && handleProfileLookup()}
                                placeholder="username (e.g. khabylame)"
                                className="flex-1 bg-transparent p-4 outline-none text-lg text-gray-700 dark:text-gray-200"
                            />
                            <button
                                onClick={handleProfileLookup}
                                disabled={profileLoading}
                                className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black px-8 py-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {profileLoading ? "Loading..." : "Get Videos"}
                            </button>
                        </div>

                        {/* 📊 Profile Results */}
                        {profileData && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold dark:text-white">Uploaded Videos</h2>
                                        <p className="text-gray-500">Found {profileData.videos.length} latest videos from @{profileData.profile.username}</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={toggleSelectAll}
                                            className="px-4 py-2 text-sm font-semibold bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            {selectedVideos.size === profileData.videos.length ? "Deselect All" : "Select All"}
                                        </button>
                                        {selectedVideos.size > 0 && (
                                            <button
                                                onClick={handleBulkDownload}
                                                className="px-6 py-2 text-sm font-bold bg-pink-600 text-white rounded-lg hover:bg-pink-700 shadow-lg shadow-pink-500/30 transition-all animate-bounce-short"
                                            >
                                                Download ({selectedVideos.size})
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* 🖼️ Video Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {profileData.videos.map((video) => {
                                        const isSelected = selectedVideos.has(video.id);
                                        return (
                                            <div
                                                key={video.id}
                                                onClick={() => toggleSelect(video.id)}
                                                className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 ${isSelected ? "border-pink-500 ring-2 ring-pink-500/20" : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                                                    }`}
                                            >
                                                <div className="aspect-[3/4] bg-gray-100 relative">
                                                    <img src={video.cover} className="w-full h-full object-cover" alt="Cover" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                                    {video.images.length > 0 && (
                                                        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                                                            <Grid size={10} /> Slideshow
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Checkbox Overlay */}
                                                <div className="absolute top-2 left-2">
                                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${isSelected ? "bg-pink-500 text-white" : "bg-black/40 text-transparent border border-white/50"
                                                        }`}>
                                                        <Check size={16} />
                                                    </div>
                                                </div>

                                                <div className="p-3 bg-white dark:bg-gray-800">
                                                    <p className="text-sm font-medium line-clamp-2 h-10 text-gray-800 dark:text-gray-200">{video.title}</p>
                                                    <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                                                        <span>{video.stats.plays} plays</span>
                                                        <span>{video.duration}s</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ✨ Features Grid */}
                {!videoData && activeTab === "single" && ( // Only show features for single tab when no video is found
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-center opacity-50">
                        <div className="p-4">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Check size={24} />
                            </div>
                            <h3 className="font-bold mb-1">No Watermark</h3>
                            <p className="text-sm">Get the clean original video.</p>
                        </div>
                        <div className="p-4">
                            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Play size={24} />
                            </div>
                            <h3 className="font-bold mb-1">Full HD & 4K</h3>
                            <p className="text-sm">Best available quality (1080p/4K).</p>
                        </div>
                        <div className="p-4">
                            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Save size={24} />
                            </div>
                            <h3 className="font-bold mb-1">Instant Schedule</h3>
                            <p className="text-sm">Save directly to app to post.</p>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
