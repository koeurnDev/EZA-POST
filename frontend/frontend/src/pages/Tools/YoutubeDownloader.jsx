import React, { useState, useEffect } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Search, Download, Youtube, Loader2, CheckCircle, Video, PlaySquare, CheckSquare, Square, X, Music, Layers, Sparkles } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function YoutubeDownloader() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Single Video State
    const [videoData, setVideoData] = useState(null);
    const [progress, setProgress] = useState(0);
    const [progressStatus, setProgressStatus] = useState("");
    const [downloadingMp3, setDownloadingMp3] = useState(false);
    const [downloadingMp4, setDownloadingMp4] = useState(false);
    const [selectedQuality, setSelectedQuality] = useState(1080);
    const [selectedAudioQuality, setSelectedAudioQuality] = useState(320);
    const [finalUrl, setFinalUrl] = useState(null);

    // Playlist/Channel State
    const [isPlaylist, setIsPlaylist] = useState(false);
    const [playlistTitle, setPlaylistTitle] = useState("");
    const [playlistVideos, setPlaylistVideos] = useState([]);
    const [selectedVideoIds, setSelectedVideoIds] = useState(new Set());
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    useEffect(() => setMounted(true), []);

    // ⏳ Simulated Progress (Single Video Only)
    useEffect(() => {
        let interval;
        if (downloadingMp4 || downloadingMp3) {
            setFinalUrl(null);
            setProgress(0);
            setProgressStatus("Initializing...");

            interval = setInterval(() => {
                setProgress(old => {
                    const isFastMode = selectedQuality <= 720 && !downloadingMp3;
                    const increment = isFastMode ? Math.random() * 8 : Math.random() * 2;
                    const newProgress = old + increment;
                    if (newProgress > 95) return 95;

                    if (newProgress < 20) setProgressStatus("Downloading from YouTube...");
                    else if (newProgress < 50) setProgressStatus("Extracting Streams...");
                    else if (newProgress < 80) {
                        if (isFastMode) setProgressStatus("Verifying file integrity...");
                        else setProgressStatus("Merging Video & Audio (FFmpeg)...");
                    } else setProgressStatus("Finalizing file...");

                    return newProgress;
                });
            }, 800);
        } else {
            setProgress(0);
            setProgressStatus("");
        }
        return () => clearInterval(interval);
    }, [downloadingMp4, downloadingMp3, selectedQuality]);

    // 🔍 Step 1: Lookup
    const handleLookup = async () => {
        if (!url.includes("youtube.com") && !url.includes("youtu.be")) return toast.error("Invalid YouTube URL");

        setLoading(true);
        setVideoData(null);
        setIsPlaylist(false);
        setPlaylistVideos([]);
        setSelectedVideoIds(new Set());
        setProgress(0);

        try {
            const res = await api.post("/tools/youtube/lookup", { url }, { timeout: 60000 });
            if (res.data.success) {
                if (res.data.isPlaylist) {
                    setIsPlaylist(true);
                    setPlaylistTitle(res.data.playlistTitle || "Channel Videos");
                    setPlaylistVideos(res.data.videos.map(v => ({ ...v, status: 'idle' })));
                    toast.success(`Found ${res.data.videos.length} videos!`);
                } else {
                    setVideoData(res.data.video);
                    if (res.data.video.resolutions && res.data.video.resolutions.length > 0) {
                        const has1080 = res.data.video.resolutions.includes(1080);
                        const has720 = res.data.video.resolutions.includes(720);
                        if (has1080) setSelectedQuality(1080);
                        else if (has720) setSelectedQuality(720);
                        else setSelectedQuality(res.data.video.resolutions[0]);
                    }
                    toast.success("Video found!");
                }
            }
        } catch (err) {
            toast.error("Failed to find video");
        } finally {
            setLoading(false);
        }
    };

    // 📥 Single Download
    const handleDownload = async (format) => {
        if (format === 'mp3') setDownloadingMp3(true);
        else setDownloadingMp4(true);
        const toastId = toast.loading("Starting Process...");

        try {
            const res = await api.post("/tools/youtube/download", {
                url,
                quality: format === 'mp3' ? selectedAudioQuality : selectedQuality,
                format
            }, { timeout: 1800000 });

            if (res.data.success) {
                setProgress(100);
                setProgressStatus("Ready!");
                setFinalUrl(res.data.url);
                toast.success("Ready! Download starting.", { id: toastId });
                triggerDownload(res.data.url, `youtube-${Date.now()}.${format}`);
            }
        } catch (err) {
            toast.error("Download failed or timed out.", { id: toastId });
        } finally {
            if (format === 'mp3') setDownloadingMp3(false);
            else setDownloadingMp4(false);
            setTimeout(() => setProgress(0), 1000);
        }
    };

    const toggleVideoSelection = (id) => {
        const newSet = new Set(selectedVideoIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedVideoIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedVideoIds.size === playlistVideos.length) {
            setSelectedVideoIds(new Set());
        } else {
            setSelectedVideoIds(new Set(playlistVideos.map(v => v.id)));
        }
    };

    const processBatch = async () => {
        if (selectedVideoIds.size === 0) return toast.error("Select videos first!");
        setIsBulkProcessing(true);
        const queue = playlistVideos.filter(v => selectedVideoIds.has(v.id) && v.status !== 'ready');

        toast.success(`Processing ${queue.length} videos (5 at a time)...`);
        const CONCURRENCY = 5;

        const processOne = async (video) => {
            setPlaylistVideos(prev => prev.map(v => v.id === video.id ? { ...v, status: 'processing' } : v));
            try {
                const res = await api.post("/tools/youtube/download", {
                    url: video.url,
                    quality: 720,
                    format: 'mp4'
                }, { timeout: 180000 });
                if (res.data.success) {
                    setPlaylistVideos(prev => prev.map(v => v.id === video.id ? { ...v, status: 'ready', downloadUrl: res.data.url } : v));
                    triggerDownload(res.data.url, `${video.title.replace(/[^a-z0-9]/gi, '_')}.mp4`);
                } else {
                    setPlaylistVideos(prev => prev.map(v => v.id === video.id ? { ...v, status: 'error' } : v));
                }
            } catch (err) {
                setPlaylistVideos(prev => prev.map(v => v.id === video.id ? { ...v, status: 'error' } : v));
            }
        };

        for (let i = 0; i < queue.length; i += CONCURRENCY) {
            const chunk = queue.slice(i, i + CONCURRENCY);
            await Promise.all(chunk.map(v => processOne(v)));
        }

        setIsBulkProcessing(false);
        toast.success("Batch processing complete!");
    };

    const triggerDownload = (url, name) => {
        const filename = url.split('/').pop();
        const downloadUrl = `${api.defaults.baseURL}/download?file=${filename}`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearLookup = () => {
        setVideoData(null);
        setIsPlaylist(false);
        setPlaylistVideos([]);
        setUrl("");
    };

    return (
        <DashboardLayout>
            {/* Ambient Background Blobs (YouTube Red Theme) */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/20 rounded-full blur-[120px] opacity-50 animate-blob" />
                <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] bg-rose-500/20 rounded-full blur-[120px] opacity-50 animate-blob animation-delay-2000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-orange-600/20 rounded-full blur-[120px] opacity-50 animate-blob animation-delay-4000" />
            </div>

            <div className={`relative z-10 p-6 max-w-6xl mx-auto transition-opacity duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

                {/* Header */}
                <div className="text-center mb-10 space-y-3">
                    <div className="inline-flex items-center justify-center p-3 rounded-full bg-red-600 shadow-lg shadow-red-500/30 mb-2 border border-red-400/20">
                        <Youtube size={32} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                        YouTube <span className="bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">Downloader</span>
                    </h1>
                    <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                        Download single videos, playlists, or channels in 4K & HD quality.
                    </p>
                </div>

                {/* 🔍 Input Section */}
                <div className="max-w-2xl mx-auto space-y-6 mb-12">
                    <div className="relative flex items-center bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-xl border border-white/20 dark:border-white/10 shadow-xl shadow-red-500/5 hover:shadow-red-500/10 transition-all duration-300">
                        <div className="pl-5 pr-3 text-gray-400">
                            <Search size={22} />
                        </div>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                            placeholder="Paste Channel, Playlist or Video link..."
                            className="w-full bg-transparent py-4 pr-4 text-base text-gray-900 dark:text-white placeholder:text-gray-400 border-none shadow-none outline-none font-medium"
                            style={{ caretColor: '#ef4444' }}
                        />
                        {url && (
                            <button onClick={() => setUrl("")} className="p-2 mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                <X size={20} />
                            </button>
                        )}
                    </div>

                    {!videoData && !isPlaylist && (
                        <button
                            onClick={handleLookup}
                            disabled={!url || loading}
                            className={`w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 ${loading ? 'opacity-80 font-black' : ''}`}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={24} />
                                    <span>Extracting YouTube Meta...</span>
                                </>
                            ) : (
                                <>
                                    <Search size={24} />
                                    Search for Content
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* 📂 Playlist / Channel View */}
                {isPlaylist && (
                    <div className="bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-3xl overflow-hidden shadow-2xl border border-white/20 dark:border-white/10 animate-in fade-in slide-in-from-bottom-6 duration-500">
                        <div className="p-6 md:p-8 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex items-center gap-4">
                                <button onClick={clearLookup} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                                    <X size={20} />
                                </button>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <PlaySquare className="text-red-600" />
                                        {playlistTitle}
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{playlistVideos.length} videos found in this feed</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={toggleSelectAll}
                                    className="px-5 py-2.5 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 backdrop-blur-md rounded-xl text-sm font-bold transition-all border border-white/20"
                                >
                                    {selectedVideoIds.size === playlistVideos.length ? "Deselect All" : "Select All"}
                                </button>
                                <button
                                    onClick={processBatch}
                                    disabled={isBulkProcessing || selectedVideoIds.size === 0}
                                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-red-500/30"
                                >
                                    {isBulkProcessing ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                                    {isBulkProcessing ? "Batch Processing..." : `Download Selected (${selectedVideoIds.size})`}
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto hidden md:block">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="p-5 w-16 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedVideoIds.size === playlistVideos.length}
                                                onChange={toggleSelectAll}
                                                className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                            />
                                        </th>
                                        <th className="p-5">Media</th>
                                        <th className="p-5">Video Info</th>
                                        <th className="p-5 w-32">Status</th>
                                        <th className="p-5 w-40 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {playlistVideos.map((video) => (
                                        <tr key={video.id} className={`group hover:bg-white/40 dark:hover:bg-white/5 transition-colors ${selectedVideoIds.has(video.id) ? "bg-red-500/5" : ""}`}>
                                            <td className="p-5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedVideoIds.has(video.id)}
                                                    onChange={() => toggleVideoSelection(video.id)}
                                                    className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-5 w-32">
                                                <div className="relative rounded-xl overflow-hidden shadow-md">
                                                    <img src={video.thumbnail || "https://via.placeholder.com/120x90?text=No+Thumb"} className="w-24 h-16 object-cover" alt="thumb" />
                                                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1 py-0.5 rounded font-bold">
                                                        {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : "LIVE"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <p className="font-bold text-gray-900 dark:text-white line-clamp-2 mb-1 group-hover:text-red-500 transition-colors">{video.title}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">720p Ready</span>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                {video.status === 'processing' && <span className="inline-flex items-center gap-1.5 text-orange-500 text-xs font-bold bg-orange-500/10 px-2.5 py-1 rounded-full"><Loader2 size={12} className="animate-spin" /> Preparing</span>}
                                                {video.status === 'ready' && <span className="inline-flex items-center gap-1.5 text-green-500 text-xs font-bold bg-green-500/10 px-2.5 py-1 rounded-full"><CheckCircle size={12} /> Ready</span>}
                                                {video.status === 'error' && <span className="inline-flex items-center gap-1.5 text-red-500 text-xs font-bold bg-red-500/10 px-2.5 py-1 rounded-full">Failed</span>}
                                                {video.status === 'idle' && <span className="text-gray-400 text-xs font-medium">Waiting...</span>}
                                            </td>
                                            <td className="p-5 text-right">
                                                {video.status === 'ready' && video.downloadUrl && (
                                                    <button
                                                        onClick={() => triggerDownload(video.downloadUrl, `${video.title}.mp4`)}
                                                        className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-red-500/20 transition-all active:scale-95"
                                                    >
                                                        <Download size={14} /> SAVE
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 📱 Mobile Grid View (2 Columns) */}
                        <div className="md:hidden grid grid-cols-2 gap-3 p-4 bg-gray-50/30 dark:bg-black/20">
                            {playlistVideos.map((video) => (
                                <div
                                    key={video.id}
                                    onClick={() => toggleVideoSelection(video.id)}
                                    className={`relative flex flex-col bg-white dark:bg-black/40 rounded-2xl overflow-hidden border transition-all active:scale-[0.98] ${selectedVideoIds.has(video.id) ? 'border-red-500 ring-4 ring-red-500/10 shadow-lg' : 'border-white/10'}`}
                                >
                                    {/* Thumbnail */}
                                    <div className="relative aspect-video">
                                        <img src={video.thumbnail || "https://via.placeholder.com/120x90?text=No+Thumb"} className="w-full h-full object-cover" alt="thumb" />
                                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[8px] px-1 py-0.5 rounded font-black backdrop-blur-sm">
                                            {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : "LIVE"}
                                        </div>

                                        {/* Selection Checkbox */}
                                        <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center border transition-all ${selectedVideoIds.has(video.id) ? 'bg-red-600 border-red-600 shadow-lg' : 'bg-black/20 border-white/50'}`}>
                                            {selectedVideoIds.has(video.id) && <CheckSquare size={12} className="text-white" />}
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-3 flex-1 flex flex-col justify-between">
                                        <div>
                                            <h4 className="text-[11px] font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight mb-2">
                                                {video.title}
                                            </h4>
                                        </div>

                                        <div className="space-y-2 mt-auto">
                                            {/* Status Badge */}
                                            <div className="flex items-center min-h-[14px]">
                                                {video.status === 'processing' && <span className="text-[9px] font-black text-orange-500 uppercase tracking-tighter flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Pending</span>}
                                                {video.status === 'ready' && <span className="text-[9px] font-black text-green-500 uppercase tracking-tighter flex items-center gap-1"><CheckCircle size={10} /> Ready</span>}
                                                {video.status === 'error' && <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter">Failed</span>}
                                                {video.status === 'idle' && <span className="text-[9px] font-medium text-gray-400">Waiting</span>}
                                            </div>

                                            {/* Download Button */}
                                            {video.status === 'ready' && video.downloadUrl && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        triggerDownload(video.downloadUrl, `${video.title}.mp4`);
                                                    }}
                                                    className="w-full py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black shadow-md active:scale-90 transition-transform flex items-center justify-center gap-1"
                                                >
                                                    <Download size={10} /> SAVE
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 🎬 Single Video Result Card */}
                {!isPlaylist && videoData && (
                    <div className="max-w-5xl mx-auto bg-white/60 dark:bg-black/40 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/20 dark:border-white/10 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex flex-col lg:flex-row">

                            {/* Left: Preview */}
                            <div className="w-full lg:w-1/2 relative">
                                <img src={videoData.thumbnail} className="w-full h-full object-cover aspect-video lg:aspect-auto" alt="Thumb" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-black shadow-lg">
                                            {videoData.author?.[0] || 'Y'}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold text-sm leading-none mb-1">{videoData.author || "YouTube Channel"}</p>
                                            <span className="text-white/60 text-xs font-medium">Ready in High Quality</span>
                                        </div>
                                    </div>
                                    <span className="bg-black/40 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full border border-white/20 tracking-widest uppercase">
                                        {Math.floor(videoData.duration / 60)}:{(videoData.duration % 60).toString().padStart(2, '0')}
                                    </span>
                                </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="w-full lg:w-1/2 p-8 lg:p-10 flex flex-col">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex flex-wrap gap-2">
                                        {['8K/4K Support', 'Original High Bitrate', 'Secure'].map(tag => (
                                            <span key={tag} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-black tracking-tighter uppercase border border-red-500/10">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                    <button onClick={clearLookup} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>

                                <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight mb-8">
                                    {videoData.title}
                                </h3>

                                <div className="space-y-6">
                                    {/* Video Format Selector */}
                                    <div className="bg-gray-100/50 dark:bg-white/5 p-6 rounded-3xl border border-white/10">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2.5 bg-red-600 rounded-xl shadow-lg shadow-red-500/20">
                                                <Video size={20} className="text-white" />
                                            </div>
                                            <span className="font-black text-gray-900 dark:text-white uppercase tracking-wider text-sm">Video Quality</span>
                                        </div>

                                        <div className="flex flex-wrap gap-3 mb-6">
                                            {videoData.resolutions?.map(res => (
                                                <button
                                                    key={res}
                                                    onClick={() => setSelectedQuality(res)}
                                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${selectedQuality === res
                                                        ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-500/30 ring-4 ring-red-500/10'
                                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-red-500/50'}`}
                                                >
                                                    {res}p {res >= 1080 ? 'HD' : ''}
                                                </button>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => handleDownload('mp4')}
                                            disabled={downloadingMp4 || downloadingMp3}
                                            className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl font-black tracking-widest uppercase text-sm shadow-xl hover:bg-black dark:hover:bg-gray-100 transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                                        >
                                            {downloadingMp4 ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                                            {downloadingMp4 ? "Sourcing Streams..." : "Start Video Download"}
                                        </button>
                                    </div>

                                    {/* Audio Format */}
                                    <div className="bg-gray-100/50 dark:bg-white/5 p-6 rounded-3xl border border-white/10">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
                                                <Music size={20} className="text-white" />
                                            </div>
                                            <span className="font-black text-gray-900 dark:text-white uppercase tracking-wider text-sm">Audio Extractor</span>
                                        </div>

                                        <div className="flex flex-wrap gap-3 mb-6">
                                            {[320, 192, 128].map(rate => (
                                                <button
                                                    key={rate}
                                                    onClick={() => setSelectedAudioQuality(rate)}
                                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${selectedAudioQuality === rate
                                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-indigo-500/50'}`}
                                                >
                                                    {rate}Kbps
                                                </button>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => handleDownload('mp3')}
                                            disabled={downloadingMp4 || downloadingMp3}
                                            className="w-full py-4 border-2 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl font-black tracking-widest uppercase text-sm hover:border-indigo-500 transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                                        >
                                            {downloadingMp3 ? <Loader2 className="animate-spin" size={20} /> : <Music size={20} />}
                                            {downloadingMp3 ? "Converting to MP3..." : "Extract Audio"}
                                        </button>
                                    </div>

                                    {/* Progress Banner */}
                                    {(downloadingMp4 || downloadingMp3) && (
                                        <div className="mt-4 p-4 bg-red-600/10 dark:bg-red-500/5 border border-red-500/20 rounded-2xl animate-in fade-in duration-300">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest animate-pulse">
                                                    {progressStatus}
                                                </span>
                                                <span className="text-xs font-black text-gray-500">{Math.round(progress)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2 overflow-hidden shadow-inner">
                                                <div
                                                    className="bg-red-600 h-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                                                    style={{ width: `${progress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Info Cards (Empty State) */}
                {!videoData && !isPlaylist && !loading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-5xl mx-auto">
                        {[
                            { title: "Smart Extraction", desc: "4K, 1080p, and MP3 quality options", icon: <Sparkles size={20} /> },
                            { title: "Bulk Support", desc: "Download entire playlists in one click", icon: <Layers size={20} /> },
                            { title: "Direct Link", desc: "High-speed servers for faster downloads", icon: <Zap size={20} /> }
                        ].map((item, i) => (
                            <div key={i} className="p-8 bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 rounded-3xl text-center hover:bg-white/60 dark:hover:bg-white/10 transition-all hover:scale-[1.02] group shadow-xl shadow-black/5">
                                <div className="w-14 h-14 mx-auto bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all transform group-hover:rotate-6 mb-5">
                                    {item.icon}
                                </div>
                                <h3 className="font-black text-gray-900 dark:text-white mb-2 uppercase tracking-wide">{item.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

// Inline helper for Zap icon (if not imported)
function Zap({ size, className }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
    );
}
