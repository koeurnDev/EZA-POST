import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import UploadSection from "../components/subtitles/UploadSection";
import MediaPreviewPlayer from "../components/subtitles/MediaPreviewPlayer";
import SubtitleEditor from "../components/subtitles/SubtitleEditor";
import WaveformTimeline from "../components/subtitles/WaveformTimeline";
import { Sparkles, Wand2, Film, ArrowLeft, FileText, Play, Pause, Send, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

export default function SubtitleStudio() {
  const location = useLocation();
  const navigate = useNavigate();

  const [completedJob, setCompletedJob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mobileTab, setMobileTab] = useState("editor"); // 'editor' | 'preview'
  const [isMobilePlaying, setIsMobilePlaying] = useState(false);

  // Synchronized playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [seekTarget, setSeekTarget] = useState(null);

  // Subtitle styling state
  const [fontClass, setFontClass] = useState("font-noto");
  const [stylePreset, setStylePreset] = useState("ocean_blue");
  const [position, setPosition] = useState("bottom");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [isBounceEnabled, setIsBounceEnabled] = useState(true);

  // Check if incoming state has video passed from Post.jsx or Tools
  useEffect(() => {
    if (location.state?.videoUrl && !completedJob) {
      toast.success("បានផ្ទុកវីដេអូពី EZA-POST! ចុច 'បម្លែងជា Subtitle' ដើម្បីចាប់ផ្តើម។", { duration: 4000 });
    }
  }, [location.state]);

  const handleSeekRequest = (time) => {
    setSeekTarget({ time: parseFloat(time), token: Date.now() + Math.random() });
    setCurrentTime(parseFloat(time));
  };

  const handleSendToPost = () => {
    if (!completedJob) return;
    const fullText = (completedJob.segments || []).map((s) => s.text).join(" ").trim();
    const suggestedCaption = fullText.length > 300 ? fullText.substring(0, 300) + "..." : fullText;

    toast.success("បានបញ្ជូនវីដេអូ និង Subtitle ទៅកាន់ទំព័របង្កើតផុស! 🚀");
    navigate("/post", {
      state: {
        rawVideoUrl: completedJob.media_url,
        videoUrl: completedJob.media_url,
        filename: completedJob.filename,
        subtitles: completedJob.segments,
        suggestedCaption: suggestedCaption,
      },
    });
  };

  const activeSub = completedJob?.segments?.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  return (
    <DashboardLayout>
      <div className={completedJob ? "w-full flex flex-col gap-2.5 lg:h-[calc(100dvh-5.5rem)] lg:min-h-[600px]" : "max-w-4xl mx-auto py-2 sm:py-4"}>
        {!completedJob ? (
          <div className="flex flex-col gap-4 sm:gap-5">
            {/* Header Hero */}
            <div className="text-center max-w-2xl mx-auto space-y-2 px-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Khmer AI Subtitle Studio</span>
              </div>
              <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white font-khmer">
                បម្លែងសំឡេងជា <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">Subtitle ខ្មែរ</span> ស្វ័យប្រវត្តិ
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-khmer">
                ដំណើរការដោយ Google Gemini 3 Flash + Whisper Edge ASR ត្រឹមតែ 4-6 វិនាទី រួចផុសទៅកាន់ Facebook Pages ភ្លាមៗ
              </p>
            </div>

            {/* Upload Section */}
            <UploadSection
              onJobCompleted={(job) => {
                setCompletedJob(job);
                setCurrentTime(0);
              }}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
            />
          </div>
        ) : (
          /* Studio Workspace: Responsive on Phone, Laptop & Large Desktop */
          <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
            {/* Top Workspace Navigation Bar */}
            <div className="flex items-center justify-between gap-2 shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 sm:px-3 py-1.5 rounded-xl shadow-xs">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <button
                  onClick={() => setCompletedJob(null)}
                  className="flex items-center gap-1 text-xs text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors font-khmer shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Upload ថ្មី</span>
                </button>

                <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-khmer bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="font-medium truncate max-w-[110px] sm:max-w-xs">{completedJob.filename}</span>
                </div>
              </div>

              {/* Action Button: Send to Facebook Post Composer */}
              <button
                onClick={handleSendToPost}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all shadow-sm font-khmer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">បង្កើតផុស Facebook 🚀</span>
                <span className="xs:hidden">ផុស FB 🚀</span>
              </button>
            </div>

            {/* Mobile Tab Switcher */}
            <div className="lg:hidden flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-xl shrink-0 font-khmer shadow-xs">
              <button
                onClick={() => setMobileTab("editor")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  mobileTab === "editor" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>📝 Subtitles ({completedJob.segments?.length || 0})</span>
              </button>
              <button
                onClick={() => setMobileTab("preview")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  mobileTab === "preview" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>🎬 Video Preview</span>
              </button>
            </div>

            {/* Split Grid: Video Preview on Left, Editor on Right */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
              <div
                className={`lg:col-span-5 h-[56dvh] min-h-[340px] lg:h-full overflow-hidden ${
                  mobileTab === "preview" ? "block" : "hidden lg:block"
                }`}
              >
                <MediaPreviewPlayer
                  mediaUrl={completedJob.media_url}
                  mediaType={completedJob.media_type || "video"}
                  segments={completedJob.segments}
                  currentTime={currentTime}
                  onTimeUpdate={(t) => setCurrentTime(t)}
                  onSeekRequest={seekTarget}
                  fontClass={fontClass}
                  stylePreset={stylePreset}
                  position={position}
                  aspectRatio={aspectRatio}
                  onAspectRatioChange={setAspectRatio}
                  isBounceEnabled={isBounceEnabled}
                  onBounceToggle={setIsBounceEnabled}
                />
              </div>

              <div
                className={`lg:col-span-7 h-[calc(100dvh-15.5rem)] min-h-[380px] lg:h-full overflow-hidden ${
                  mobileTab === "editor" ? "block" : "hidden lg:block"
                }`}
              >
                <SubtitleEditor
                  job={completedJob}
                  currentTime={currentTime}
                  onSeekRequest={handleSeekRequest}
                  fontClass={fontClass}
                  setFontClass={setFontClass}
                  stylePreset={stylePreset}
                  setStylePreset={setStylePreset}
                  position={position}
                  setPosition={setPosition}
                  aspectRatio={aspectRatio}
                  setAspectRatio={setAspectRatio}
                  isBounceEnabled={isBounceEnabled}
                  setIsBounceEnabled={setIsBounceEnabled}
                  onJobUpdated={(updated) => setCompletedJob(updated)}
                />
              </div>
            </div>

            {/* Bottom Dock: Audio Waveform Timeline */}
            <div className={`shrink-0 pt-0.5 ${mobileTab === "preview" ? "block" : "hidden lg:block"}`}>
              <WaveformTimeline
                jobId={completedJob.job_id}
                duration={completedJob.duration}
                currentTime={currentTime}
                segments={completedJob.segments}
                onSeekRequest={handleSeekRequest}
                onSegmentsChange={(updated) => {
                  setCompletedJob({ ...completedJob, segments: updated });
                }}
              />
            </div>

            {/* Mobile Bottom Mini Player Bar */}
            {mobileTab === "editor" && (
              <div className="lg:hidden shrink-0 bg-slate-900/98 backdrop-blur-md border border-slate-800 rounded-2xl px-3 py-2 flex flex-col gap-1.5 text-xs font-khmer shadow-2xl">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 animate-ping"></span>
                    <p className="text-[11px] text-slate-200 truncate font-khmer">
                      {activeSub ? activeSub.text : "ជ្រើសរើស Subtitle ដើម្បីស្តាប់..."}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">
                    {currentTime.toFixed(1)}s / {(completedJob.duration || 0).toFixed(1)}s
                  </span>
                </div>

                <div className="flex items-center justify-between pt-0.5 border-t border-slate-800/60">
                  <button
                    onClick={() => {
                      const el = document.querySelector("video") || document.querySelector("audio");
                      if (el) {
                        if (el.paused) {
                          el.play();
                          setIsMobilePlaying(true);
                        } else {
                          el.pause();
                          setIsMobilePlaying(false);
                        }
                      }
                    }}
                    className="h-8 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all text-xs font-semibold"
                  >
                    {isMobilePlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        <span>ផ្អាក</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>ចាក់ស្តាប់</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setMobileTab("preview")}
                    className="h-8 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-indigo-300 font-semibold text-xs flex items-center gap-1.5 border border-slate-700/80 active:scale-95 transition-all"
                  >
                    <Film className="w-3.5 h-3.5 text-indigo-400" />
                    <span>មើលវីដេអូ</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

