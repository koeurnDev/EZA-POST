import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import {
  Radio,
  Video,
  Upload,
  Play,
  Square,
  CheckSquare,
  Clock,
  Activity,
  Layers,
  Repeat,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";
import api from "../../utils/api";
import toast from "react-hot-toast";

export default function LiveStreamer() {
  const [pages, setPages] = useState([]);
  const [selectedPageIds, setSelectedPageIds] = useState(new Set());
  const [loadingPages, setLoadingPages] = useState(true);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [loopMode, setLoopMode] = useState("1"); // "1", "2", "5", "-1" (infinite)
  const [startingStream, setStartingStream] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Active Broadcasts State
  const [activeSessions, setActiveSessions] = useState([]);
  const [loadingActive, setLoadingActive] = useState(false);
  const [stoppingId, setStoppingId] = useState(null);

  const fileInputRef = useRef(null);

  // 1. Fetch connected pages & active broadcasts
  useEffect(() => {
    fetchPages();
    fetchActiveBroadcasts();

    // Poll active streams every 5 seconds
    const interval = setInterval(() => {
      fetchActiveBroadcasts(true);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchPages = async () => {
    try {
      setLoadingPages(true);
      const res = await api.get("/live-stream/pages");
      if (res.data?.success) {
        const pageList = res.data.pages || [];
        setPages(pageList);
        if (pageList.length > 0) {
          // Default select the first page
          setSelectedPageIds(new Set([pageList[0].id]));
        }
      }
    } catch (err) {
      toast.error("មិនអាចទាញយកបញ្ជី Pages: " + (err.response?.data?.error || err.message));
    } finally {
      setLoadingPages(false);
    }
  };

  const fetchActiveBroadcasts = async (silent = false) => {
    try {
      if (!silent) setLoadingActive(true);
      const res = await api.get("/live-stream/active");
      if (res.data?.success) {
        setActiveSessions(res.data.activeSessions || []);
      }
    } catch (err) {
      if (!silent) console.error("Active broadcasts fetch error:", err);
    } finally {
      if (!silent) setLoadingActive(false);
    }
  };

  // Toggle page selection
  const togglePageSelection = (pageId) => {
    const next = new Set(selectedPageIds);
    if (next.has(pageId)) {
      next.delete(pageId);
    } else {
      next.add(pageId);
    }
    setSelectedPageIds(next);
  };

  const handleSelectAllPages = () => {
    if (selectedPageIds.size === pages.length) {
      setSelectedPageIds(new Set());
    } else {
      setSelectedPageIds(new Set(pages.map((p) => p.id)));
    }
  };

  // Video file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2048 * 1024 * 1024) {
        return toast.error("ទំហំវីដេអូត្រូវតែតូចជាង 2GB");
      }
      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
      if (!title) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        setTitle(cleanName);
      }
    }
  };

  // Start Live Stream
  const handleStartBroadcast = async (e) => {
    e.preventDefault();

    if (!videoFile) {
      return toast.error("សូមជ្រើសរើស ឬ Upload វីដេអូសម្រាប់ Live Stream");
    }

    if (selectedPageIds.size === 0) {
      return toast.error("សូមជ្រើសរើស Facebook Page យ៉ាងហោចណាស់មួយ");
    }

    try {
      setStartingStream(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("title", title || "Facebook Live Stream");
      formData.append("description", description || "");
      formData.append("loop", loopMode);
      formData.append("pageIds", JSON.stringify(Array.from(selectedPageIds)));
      formData.append("video", videoFile);

      const res = await api.post("/live-stream/start", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(percent);
        },
      });

      if (res.data?.success) {
        toast.success(`🚀 កំពុងផ្សាយផ្ទាល់លើ ${res.data.targetsCount} Pages!`, {
          duration: 5000,
          icon: "🔴",
        });

        // Reset form
        setVideoFile(null);
        setVideoPreviewUrl(null);
        setTitle("");
        setDescription("");
        if (fileInputRef.current) fileInputRef.current.value = "";

        // Refresh active list
        fetchActiveBroadcasts();
      } else {
        toast.error(res.data?.error || "មិនអាចចាប់ផ្តើម Live Stream បានទេ");
      }
    } catch (err) {
      toast.error("កំហុស: " + (err.response?.data?.error || err.message));
    } finally {
      setStartingStream(false);
      setUploadProgress(0);
    }
  };

  // Stop Live Stream
  const handleStopBroadcast = async (sessionId) => {
    if (!window.confirm("តើអ្នកពិតជាចង់បញ្ចប់ការ Live Stream នេះមែនទេ?")) return;

    try {
      setStoppingId(sessionId);
      const res = await api.post(`/live-stream/stop/${sessionId}`);
      if (res.data?.success) {
        toast.success("បានបញ្ចប់ការ Live Stream ដោយជោគជ័យ");
        fetchActiveBroadcasts();
      } else {
        toast.error(res.data?.error || "មិនអាចបញ្ចប់ Live Stream បានទេ");
      }
    } catch (err) {
      toast.error("កំហុសពេលបញ្ចប់: " + (err.response?.data?.error || err.message));
    } finally {
      setStoppingId(null);
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds && seconds !== 0) return "00:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600/10 via-rose-600/10 to-transparent p-6 rounded-3xl border border-red-500/20 backdrop-blur-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-xl shadow-red-500/25">
                <Radio size={28} />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight">Multi-Page Fake Live Stream</h1>
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                    RTMP Multi-Broadcast
                  </span>
                </div>
                <p className="text-sm opacity-70 mt-1">
                  ផ្សាយផ្ទាល់វីដេអូដែលបានថតទុកស្រាប់ (Pre-recorded) ទៅកាន់ Facebook Pages ជាច្រើនក្នុងពេលតែមួយ
                </p>
              </div>
            </div>

            {/* Active badge */}
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    activeSessions.length > 0 ? "bg-red-500 animate-pulse" : "bg-gray-500"
                  }`}
                />
                {activeSessions.length} កំពុងផ្សាយផ្ទាល់
              </span>
            </div>
          </div>
        </div>

        {/* 🔴 Active Live Broadcasts Monitor */}
        {activeSessions.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              កំពុងផ្សាយផ្ទាល់សកម្ម ({activeSessions.length})
            </h2>

            <div className="grid grid-cols-1 gap-4">
              {activeSessions.map((session) => (
                <div
                  key={session.sessionId}
                  className="bg-red-950/20 border border-red-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-red-600 text-white animate-pulse">
                          🔴 LIVE
                        </span>
                        <h3 className="text-base font-bold text-white">{session.title}</h3>
                        <span className="text-xs font-mono opacity-60">
                          {session.loop === -1 ? "♾️ Loop រហូត" : `${session.loop}x Loop`}
                        </span>
                      </div>

                      {/* Pages target badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs opacity-60">ផេកគោលដៅ:</span>
                        {session.targets?.map((target) => (
                          <div
                            key={target.pageId}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold"
                          >
                            {target.picture && (
                              <img
                                src={target.picture}
                                alt={target.pageName}
                                className="w-4 h-4 rounded-full"
                              />
                            )}
                            <span>{target.pageName}</span>
                          </div>
                        ))}
                      </div>

                      {/* Stream Telemetry */}
                      <div className="flex items-center gap-4 text-xs font-medium opacity-75 pt-1">
                        <span className="flex items-center gap-1.5">
                          <Clock size={14} className="text-orange-400" />
                          រយៈពេល: {formatUptime(session.uptimeSeconds)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Activity size={14} className="text-emerald-400" />
                          FPS: {session.stats?.fps || 30}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Zap size={14} className="text-yellow-400" />
                          Bitrate: {session.stats?.bitrate || "3000k"}
                        </span>
                      </div>
                    </div>

                    {/* Stop Button */}
                    <button
                      onClick={() => handleStopBroadcast(session.sessionId)}
                      disabled={stoppingId === session.sessionId}
                      className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-lg shadow-red-600/30 transition flex items-center justify-center gap-2"
                    >
                      {stoppingId === session.sessionId ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          កំពុងបញ្ឈប់...
                        </>
                      ) : (
                        <>
                          <Square size={16} className="fill-white" />
                          បញ្ឈប់ការ Live
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create Broadcast Form */}
        <form onSubmit={handleStartBroadcast} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Video & Stream Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Video File */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                  <Video size={18} className="text-red-400" />
                  ជំហានទី ១: ជ្រើសរើសវីដេអូ (Video Source)
                </h2>
                {videoFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setVideoFile(null);
                      setVideoPreviewUrl(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-xs text-red-400 hover:underline"
                  >
                    ផ្លាស់ប្តូរវីដេអូ
                  </button>
                )}
              </div>

              {!videoFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/20 hover:border-red-500/50 rounded-2xl p-8 text-center cursor-pointer transition hover:bg-white/5 space-y-3"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="video/mp4,video/quicktime,video/mkv,video/webm"
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
                    <Upload size={26} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">ចុចដើម្បី Upload វីដេអូ ឬអូសទម្លាក់ទីនេះ</p>
                    <p className="text-xs opacity-60 mt-1">គាំទ្រ MP4, MOV, MKV, WebM (អតិបរមា 2GB)</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {videoPreviewUrl && (
                    <video
                      src={videoPreviewUrl}
                      controls
                      className="w-full max-h-64 rounded-xl bg-black object-contain border border-white/10"
                    />
                  )}
                  <div className="flex items-center justify-between text-xs opacity-80 px-1">
                    <span className="font-semibold truncate max-w-xs">{videoFile.name}</span>
                    <span>{(videoFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Stream Info */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Layers size={18} className="text-blue-400" />
                ជំហានទី ២: ព័ត៌មាន Live Stream (Details)
              </h2>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold opacity-75">ចំណងជើង Live Stream (Title)</label>
                  <input
                    type="text"
                    placeholder="ឧទាហរណ៍៖ ការផ្សាយផ្ទាល់កម្មវិធីពិសេស..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold opacity-75">ការពិពណ៌នា / Caption (Description)</label>
                  <textarea
                    rows={4}
                    placeholder="បញ្ចូល Caption, Hashtags (#Live #Video), ឬ Call-to-action..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Target Pages & Loop Settings */}
          <div className="space-y-6">
            {/* Step 3: Target Pages */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                  <Radio size={18} className="text-rose-400" />
                  ជំហានទី ៣: ជ្រើសរើស Pages
                </h2>
                <button
                  type="button"
                  onClick={handleSelectAllPages}
                  className="text-xs text-blue-400 hover:underline"
                >
                  {selectedPageIds.size === pages.length ? "ដោះទាំងអស់" : "ជ្រើសទាំងអស់"}
                </button>
              </div>

              {loadingPages ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : pages.length === 0 ? (
                <div className="p-4 rounded-xl bg-white/5 text-center text-xs opacity-60">
                  មិនមាន Facebook Page ណាបានភ្ជាប់ទេ។ សូមភ្ជាប់ Page ក្នុងទំព័រ Connections។
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {pages.map((p) => {
                    const isSelected = selectedPageIds.has(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => togglePageSelection(p.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                          isSelected
                            ? "bg-red-500/10 border-red-500"
                            : "bg-white/5 border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {p.picture ? (
                            <img
                              src={p.picture}
                              alt={p.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                              {p.name?.[0] || "P"}
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-bold leading-tight line-clamp-1">{p.name}</p>
                            <p className="text-[10px] opacity-60">
                              {p.followersCount ? `${p.followersCount.toLocaleString()} followers` : "Connected"}
                            </p>
                          </div>
                        </div>

                        {isSelected ? (
                          <CheckSquare size={18} className="text-red-500 shrink-0" />
                        ) : (
                          <Square size={18} className="opacity-40 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 4: Loop Settings */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Repeat size={18} className="text-emerald-400" />
                ជំហានទី ៤: ចាក់សារឡើងវិញ (Loop)
              </h2>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "1", label: "ចាក់ 1 ដង", desc: "ចប់បញ្ឈប់ស្វ័យប្រវត្តិ" },
                  { id: "2", label: "ចាក់ 2 ដង", desc: "Repeat 2 ជុំ" },
                  { id: "5", label: "ចាក់ 5 ដង", desc: "Repeat 5 ជុំ" },
                  { id: "-1", label: "♾️ Loop រហូត", desc: "24/7 MMO Stream" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLoopMode(opt.id)}
                    className={`p-3 rounded-xl border text-left transition ${
                      loopMode === opt.id
                        ? "bg-red-500/10 border-red-500 shadow-md shadow-red-500/10"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <p className="text-xs font-bold text-white">{opt.label}</p>
                    <p className="text-[10px] opacity-60 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Launch Button */}
            <div className="space-y-3">
              {startingStream && uploadProgress > 0 && uploadProgress < 100 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>កំពុង Upload វីដេអូ...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-red-500 h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={startingStream || !videoFile || selectedPageIds.size === 0}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-xl shadow-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition transform active:scale-98 flex items-center justify-center gap-2"
              >
                {startingStream ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    កំពុងចាប់ផ្តើម Live Stream...
                  </>
                ) : (
                  <>
                    <Play size={18} className="fill-white" />
                    ចាប់ផ្តើម Live Stream លើ ({selectedPageIds.size}) Pages
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* MMO Tips Card */}
        <div className="bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-transparent p-5 rounded-2xl border border-blue-500/20 text-xs text-blue-200/80 space-y-2">
          <div className="flex items-center gap-2 font-bold text-blue-300 text-sm">
            <ShieldCheck size={18} />
            គន្លឹះបច្ចេកទេស Facebook Live Stream សម្រាប់អ្នកធ្វើ MMO:
          </div>
          <ul className="list-disc list-inside space-y-1 opacity-90 pl-1">
            <li>
              ប្រព័ន្ធប្រើប្រាស់ <strong>FFmpeg H.264 Tee-Muxer</strong> ដែលធ្វើការ Transcode តែម្តង និង Stream ទៅកាន់ Pages ច្រើនដំណាលគ្នាដោយមិនស៊ី CPU ច្រើន។
            </li>
            <li>
              កម្រិតបង្ហាញវីដេអូត្រូវបានសម្រួលដល់ <strong>720p/1080p</strong> ជាមួយ 3000k Bitrate និង 60 Keyframe interval ស្របតាមស្តង់ដារ Facebook Live API v21.0។
            </li>
            <li>
              ជម្រើស <strong>Loop រហូត</strong> ជួយរក្សាការផ្សាយ 24/7 ជាប់លាប់ ដើម្បីទាក់ទាញ Viewers និងបំពេញលក្ខខណ្ឌ Watch Time សម្រាប់ Monitisation។
            </li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}

