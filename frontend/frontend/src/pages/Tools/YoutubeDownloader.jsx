import React, { useState } from "react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { Search, Download, Youtube, Loader2, CheckCircle, Video, PlaySquare, CheckSquare, Square } from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function YoutubeDownloader() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);

    // Single Video State
    const [videoData, setVideoData] = useState(null);
    const [progress, setProgress] = useState(0);
    const [progressStatus, setProgressStatus] = useState("");
    const [downloadingMp3, setDownloadingMp3] = useState(false);
    const [downloadingMp4, setDownloadingMp4] = useState(false);
    const [selectedQuality, setSelectedQuality] = useState(1080);
    const [finalUrl, setFinalUrl] = useState(null);

    // Playlist/Channel State
    const [isPlaylist, setIsPlaylist] = useState(false);
    const [playlistTitle, setPlaylistTitle] = useState("");
    const [playlistVideos, setPlaylistVideos] = useState([]); // Array of { id, title, thumbnail, duration, status: 'idle'|'processing'|'ready'|'error', downloadUrl }
    const [selectedVideoIds, setSelectedVideoIds] = useState(new Set());
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    // ⏳ Simulated Progress (Single Video Only)
    React.useEffect(() => {
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
                    // 📂 Handle Playlist
                    setIsPlaylist(true);
                    setPlaylistTitle(res.data.playlistTitle || "Channel Videos");
                    setPlaylistVideos(res.data.videos.map(v => ({ ...v, status: 'idle' })));
                    toast.success(`Found ${res.data.videos.length} videos!`);
                } else {
                    // 🎬 Handle Single Video
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
                quality: selectedQuality,
                format
            }, { timeout: 1800000 }); // 30 minutes timeout for large files

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

    // 📂 Bulk Processing Logic
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

        toast.success(`Processing ${queue.length} videos...`);

        // Process sequentially to be nice to the server (or concurrent limit 2)
        for (const video of queue) {
            // Update status to processing
            setPlaylistVideos(prev => prev.map(v => v.id === video.id ? { ...v, status: 'processing' } : v));

            try {
                // Default to 720p for fast bulk (or make configurable later)
                // Use existing download endpoint
                const res = await api.post("/tools/youtube/download", {
                    url: video.url,
                    quality: 720, // Default for batch
                    format: 'mp4'
                }, { timeout: 180000 });

                if (res.data.success) {
                    setPlaylistVideos(prev => prev.map(v => v.id === video.id ? { ...v, status: 'ready', downloadUrl: res.data.url } : v));
                } else {
                    setPlaylistVideos(prev => prev.map(v => v.id === video.id ? { ...v, status: 'error' } : v));
                }
            } catch (err) {
                console.error(err);
                setPlaylistVideos(prev => prev.map(v => v.id === video.id ? { ...v, status: 'error' } : v));
            }
        }

        setIsBulkProcessing(false);
        toast.success("Batch processing complete!");
    };

    const triggerDownload = (url, name) => {
        // Convert relative /uploads/temp/... path to absolute /api/download?file=...
        // The URL from backend is typically "/uploads/temp/videos/filename.mp4"
        const filename = url.split('/').pop();
        const downloadUrl = `${api.defaults.baseURL}/download?file=${filename}`;

        // window.open(downloadUrl, '_blank'); // Sometimes better for IDM
        // OR
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', name); // Hint name
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto px-4 py-8">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">
                        YouTube <span className="text-red-600">Premium Downloader</span>
                    </h1>
                    <p className="text-gray-500">Download Channels, Playlists, or Single Videos in HD.</p>
                </div>

                {/* 🔍 Search Box */}
                <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 flex items-center gap-2 mb-8">
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                        placeholder="Paste Channel or Video link here..."
                        className="flex-1 bg-transparent p-4 outline-none text-lg text-gray-700 dark:text-gray-200"
                    />
                    <button
                        onClick={handleLookup}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <><Search size={20} /> Search</>}
                    </button>
                </div>

                {/* 📂 Playlist / Channel Result */}
                {isPlaylist && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <PlaySquare className="text-red-600" />
                                    {playlistTitle}
                                </h2>
                                <p className="text-sm text-gray-500">{playlistVideos.length} videos found</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={toggleSelectAll}
                                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                                >
                                    {selectedVideoIds.size === playlistVideos.length ? "Deselect All" : "Select All"}
                                </button>
                                <button
                                    onClick={processBatch}
                                    disabled={isBulkProcessing || selectedVideoIds.size === 0}
                                    className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-red-500/30"
                                >
                                    {isBulkProcessing ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                                    {isBulkProcessing ? "Processing..." : `Process Selected (${selectedVideoIds.size})`}
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-sm uppercase">
                                    <tr>
                                        <th className="p-4 w-12 text-center">
                                            <button onClick={toggleSelectAll}>
                                                {selectedVideoIds.size === playlistVideos.length ? <CheckSquare size={20} /> : <Square size={20} />}
                                            </button>
                                        </th>
                                        <th className="p-4">Thumbnail</th>
                                        <th className="p-4">Title</th>
                                        <th className="p-4 w-32">Status</th>
                                        <th className="p-4 w-40 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {playlistVideos.map((video) => (
                                        <tr key={video.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${selectedVideoIds.has(video.id) ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                                            <td className="p-4 text-center">
                                                <button onClick={() => toggleVideoSelection(video.id)} className="text-gray-400 hover:text-red-500">
                                                    {selectedVideoIds.has(video.id) ?
                                                        <CheckSquare className="text-red-600" size={20} /> :
                                                        <Square size={20} />
                                                    }
                                                </button>
                                            </td>
                                            <td className="p-4 w-24">
                                                <img src={video.thumbnail || "https://via.placeholder.com/120x90?text=No+Thumb"} className="w-20 h-14 object-cover rounded-md shadow-sm" alt="thumb" />
                                            </td>
                                            <td className="p-4">
                                                <p className="font-semibold text-gray-800 dark:text-gray-200 line-clamp-2">{video.title}</p>
                                                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded mt-1 inline-block">
                                                    {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : "N/A"}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {video.status === 'processing' && <span className="flex items-center gap-1 text-orange-500 text-sm font-medium"><Loader2 size={14} className="animate-spin" /> Preparing</span>}
                                                {video.status === 'ready' && <span className="flex items-center gap-1 text-green-600 text-sm font-medium"><CheckCircle size={14} /> Ready</span>}
                                                {video.status === 'error' && <span className="text-red-500 text-sm font-medium">Failed</span>}
                                                {video.status === 'idle' && <span className="text-gray-400 text-sm">--</span>}
                                            </td>
                                            <td className="p-4 text-right">
                                                {video.status === 'ready' && video.downloadUrl && (
                                                    <a
                                                        href={video.downloadUrl}
                                                        download
                                                        className="inline-flex items-center gap-1 bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
                                                    >
                                                        <Download size={14} /> Save
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 🎥 Single Video Result */}
                {!isPlaylist && videoData && (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col md:flex-row">
                            <div className="w-full md:w-5/12 relative">
                                <img src={videoData.thumbnail} className="w-full h-full object-cover aspect-video" alt="Thumb" />
                                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                                    {Math.floor(videoData.duration / 60)}:{(videoData.duration % 60).toString().padStart(2, '0')}
                                </div>
                            </div>

                            <div className="w-full md:w-7/12 p-6 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-2 mb-2">
                                        {videoData.title}
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-4">Channel: {videoData.author}</p>

                                    <div className="flex gap-2 flex-wrap text-sm text-gray-600 dark:text-gray-400 mb-4">
                                        {videoData.resolutions?.some(r => r >= 2160) && <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-bold rounded">4K Ultra HD</span>}
                                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 font-bold rounded">Audio Included</span>
                                    </div>
                                </div>

                                <div className="mt-6 flex flex-col gap-3">
                                    {/* ⚙️ Quality Selector */}
                                    {videoData.resolutions && (
                                        <div className="mb-2">
                                            <label className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Video Quality:</label>
                                            <select
                                                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-red-500 text-gray-700 dark:text-white transition-all hover:bg-white dark:hover:bg-gray-600 cursor-pointer"
                                                value={selectedQuality}
                                                onChange={(e) => setSelectedQuality(Number(e.target.value))}
                                            >
                                                {videoData.resolutions.map(res => (
                                                    <option key={res} value={res}>
                                                        {res}p {res >= 1080 ? '(High Quality - Slow)' : '(⚡ Lightning Fast)'}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* 🎬 Download Video Button */}
                                    <button
                                        onClick={() => handleDownload('mp4')}
                                        disabled={downloadingMp4 || downloadingMp3}
                                        className={`w-full py-4 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all ${downloadingMp4
                                            ? "bg-red-800 text-red-100 cursor-not-allowed opacity-90"
                                            : "bg-red-600 hover:bg-red-700 text-white shadow-red-500/30"
                                            }`}
                                    >
                                        {downloadingMp4 ? (
                                            <> <Loader2 className="animate-spin" size={24} /> Generating {selectedQuality}p Video... </>
                                        ) : (
                                            <> <Video size={24} /> Download Video ({selectedQuality}p) </>
                                        )}
                                    </button>

                                    {/* 🎵 Download Audio Button */}
                                    <button
                                        onClick={() => handleDownload('mp3')}
                                        disabled={downloadingMp4 || downloadingMp3}
                                        className={`w-full py-4 font-bold rounded-xl flex items-center justify-center gap-2 transition-all border ${downloadingMp3
                                            ? "bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                                            : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600"
                                            }`}
                                    >
                                        {downloadingMp3 ? (
                                            <> <Loader2 className="animate-spin" size={24} /> Converting to MP3 Audio... </>
                                        ) : (
                                            <> <div className="font-black bg-gray-200 dark:bg-gray-600 px-2 rounded text-xs">MP3</div> Download Audio Only </>
                                        )}
                                    </button>

                                    {/* ℹ️ Processing Info with Progress Bar */}
                                    {(downloadingMp4 || downloadingMp3) && (
                                        <div className="mt-4">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-sm font-medium text-red-600 dark:text-red-400 animate-pulse">
                                                    {progressStatus}
                                                </span>
                                                <span className="text-xs text-gray-500">{Math.round(progress)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className="bg-red-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                                                    style={{ width: `${progress}%` }}
                                                ></div>
                                            </div>
                                            <p className="text-center text-xs text-gray-400 mt-2">
                                                High-Quality downloads require processing on our server before sending to you.
                                            </p>
                                        </div>
                                    )}

                                    {/* 🟢 IDM / Manual Download Button */}
                                    {finalUrl && !downloadingMp4 && !downloadingMp3 && (
                                        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl text-center animate-in zoom-in duration-300">
                                            <p className="text-green-700 dark:text-green-300 font-bold mb-2">File Ready!</p>
                                            <a
                                                href={finalUrl}
                                                download
                                                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-green-500/30 transition-all transform hover:scale-105"
                                            >
                                                <Download size={20} /> Download Now (IDM Friendly)
                                            </a>
                                            <p className="text-xs text-gray-500 mt-2">
                                                If it didn't start, click above. Right-click to use IDM.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
