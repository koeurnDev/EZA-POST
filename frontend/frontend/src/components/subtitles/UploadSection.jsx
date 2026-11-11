import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileAudio, FileVideo, Cpu, AlertCircle, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { extractAudioFromVideo } from '../../utils/audioExtractor';

export default function UploadSection({ onJobCompleted, isProcessing, setIsProcessing }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('km');
  const [modelSize, setModelSize] = useState('large-v3-turbo');
  const [customGlossary, setCustomGlossary] = useState('');
  const [showGlossary, setShowGlossary] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [currentStep, setCurrentStep] = useState(1); // 1: Upload, 2: AI Listening, 3: Syncing
  const fileInputRef = useRef(null);

  useEffect(() => {
    let timer;
    if (isProcessing) {
      setElapsedSec(0);
      timer = setInterval(() => {
        setElapsedSec((s) => s + 1);
      }, 1000);
    } else {
      setElapsedSec(0);
    }
    return () => clearInterval(timer);
  }, [isProcessing]);

  const loadDemoSample = async () => {
    setIsProcessing(true);
    setErrorMsg('');
    setProgressStatus('កំពុងផ្ទុកគម្រោងគំរូ...');
    try {
      const res = await fetch('/api/v1/demo/load-sample', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to load demo');
      const job = await res.json();
      setIsProcessing(false);
      onJobCompleted(job);
    } catch (e) {
      setIsProcessing(false);
      setErrorMsg(e.message);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file) => {
    setErrorMsg('');
    const validExts = ['.mp3', '.wav', '.m4a', '.mp4', '.mov', '.webm', '.aac'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validExts.includes(ext)) {
      setErrorMsg(`ប្រភេទឯកសារមិនត្រឹមត្រូវ។ គាំទ្រតែ៖ ${validExts.join(', ')}`);
      return;
    }
    setSelectedFile(file);
  };

  const startTranscription = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMsg('');
    setUploadProgress(0);
    setCurrentStep(1);
    setProgressStatus('កំពុងរៀបចំឯកសារ...');

    try {
      const isVideo = selectedFile.type?.startsWith('video/') || 
                      ['.mp4', '.mov', '.webm', '.mkv'].some(ext => selectedFile.name.toLowerCase().endsWith(ext));

      let audioBlob = null;

      // For video files, attempt fast client-side 16kHz mono audio extraction
      if (isVideo) {
        setProgressStatus('កំពុងទាញយកសំឡេងពីវីដេអូ...');
        try {
          audioBlob = await extractAudioFromVideo(selectedFile);
        } catch (e) {
          audioBlob = null;
        }
      }

      setProgressStatus('កំពុង Upload ទៅកាន់ Cloudflare R2...');

      const formData = new FormData();
      formData.append('file', selectedFile);
      if (audioBlob) {
        formData.append('audio', audioBlob, 'audio.wav');
      }
      formData.append('model_size', modelSize);
      formData.append('language', selectedLanguage);
      formData.append('vad_filter', 'false');
      if (customGlossary.trim()) {
        formData.append('initial_prompt', customGlossary.trim());
      }

      // Use XMLHttpRequest for real-time upload progress tracking
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/v1/transcribe');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          const loadedMB = (event.loaded / (1024 * 1024)).toFixed(1);
          const totalMB = (event.total / (1024 * 1024)).toFixed(1);
          setUploadProgress(percent);
          if (percent < 100) {
            setCurrentStep(1);
            setProgressStatus(`កំពុង Upload: ${percent}% (${loadedMB}MB / ${totalMB}MB)...`);
          } else {
            setCurrentStep(2);
            setProgressStatus('⚡ AI Gemini 2.5 Flash កំពុងស្តាប់ និងបម្លែងសំឡេងខ្មែរ...');
          }
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const jobData = JSON.parse(xhr.responseText);
            const jobId = jobData.job_id;

            // Generate instant local blob URL for 0ms video preview loading
            const localMediaUrl = URL.createObjectURL(selectedFile);

            // If Gemini Flash Lite already completed inline during upload, finish immediately!
            if (jobData.status === 'COMPLETED' && Array.isArray(jobData.segments)) {
              setCurrentStep(3);
              setIsProcessing(false);
              setProgressStatus('');
              setUploadProgress(100);
              onJobCompleted({
                ...jobData,
                srt_url: jobData.srt_url || `/api/v1/jobs/${jobId}/export/srt`,
                vtt_url: jobData.vtt_url || `/api/v1/jobs/${jobId}/export/vtt`,
                ass_url: jobData.ass_url || `/api/v1/jobs/${jobId}/export/ass`,
                txt_url: jobData.txt_url || `/api/v1/jobs/${jobId}/export/txt`,
                media_url: localMediaUrl || jobData.media_url,
                media_type: isVideo ? 'video' : 'audio'
              });
              return;
            }

            // Fast poll for job completion
            let pollAttempts = 0;
            const interval = setInterval(async () => {
              pollAttempts++;
              if (pollAttempts > 120) {
                clearInterval(interval);
                setIsProcessing(false);
                setErrorMsg('ការបម្លែងសំឡេងយូរខុសធម្មតា (Timeout)។ សូមសាកល្បងម្ដងទៀត!');
                return;
              }

              try {
                const res = await fetch(`/api/v1/jobs/${jobId}`);
                if (!res.ok) throw new Error('Failed to query job status');
                const job = await res.json();

                if (job.status === 'QUEUED') {
                  setCurrentStep(2);
                  setProgressStatus('⏳ កំពុងរៀបចំក្នុងជួរ AI...');
                } else if (job.status === 'EXTRACTING_AUDIO') {
                  setCurrentStep(2);
                  setProgressStatus('កំពុងសម្រួលសំឡេង...');
                } else if (job.status === 'TRANSCRIBING') {
                  setCurrentStep(2);
                  setProgressStatus('⚡ AI Gemini 2.5 Flash កំពុងស្តាប់សំឡេងខ្មែរ...');
                } else if (job.status === 'COMPLETED') {
                  clearInterval(interval);
                  setCurrentStep(3);
                  setIsProcessing(false);
                  setProgressStatus('');
                  setUploadProgress(100);
                  onJobCompleted({
                    ...job,
                    media_url: localMediaUrl || job.media_url,
                    media_type: isVideo ? 'video' : 'audio'
                  });
                } else if (job.status === 'FAILED') {
                  clearInterval(interval);
                  setIsProcessing(false);
                  setErrorMsg(job.error || 'ការបម្លែងសំឡេងបានបរាជ័យ');
                }
              } catch (err) {
                if (pollAttempts > 30) {
                  clearInterval(interval);
                  setIsProcessing(false);
                  setErrorMsg(err.message || 'Error checking job status');
                }
              }
            }, 1000);
          } catch (e) {
            setIsProcessing(false);
            setErrorMsg('ការឆ្លើយតបពី Server មិនត្រឹមត្រូវ');
          }
        } else {
          setIsProcessing(false);
          try {
            const errData = JSON.parse(xhr.responseText);
            setErrorMsg(errData.error || errData.detail || `Upload បរាជ័យ (Code ${xhr.status})`);
          } catch {
            setErrorMsg(`Upload បរាជ័យ (Code ${xhr.status})`);
          }
        }
      };

      xhr.onerror = () => {
        setIsProcessing(false);
        setErrorMsg('បាត់បង់ការតភ្ជាប់ទៅកាន់ Server សូមពិនិត្យមើល Internet របស់អ្នក!');
      };

      xhr.send(formData);

    } catch (err) {
      setIsProcessing(false);
      setErrorMsg(err.message || 'មានបញ្ហាក្នុងការចាប់ផ្តើមការងារ');
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-xl">
      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
          dragActive
            ? 'border-indigo-500 bg-indigo-500/10'
            : selectedFile
            ? 'border-emerald-500/50 bg-emerald-500/5'
            : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-800/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,.m4a,.mp4,.mov,.webm,.aac"
          className="hidden"
          onChange={handleFileChange}
          disabled={isProcessing}
        />

        {selectedFile ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              {selectedFile.type.includes('video') ? <FileVideo className="w-6 h-6" /> : <FileAudio className="w-6 h-6" />}
            </div>
            <p className="font-semibold text-slate-200">{selectedFile.name}</p>
            <p className="text-xs text-slate-400">
              {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • ចុចដើម្បីប្តូរ
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200 font-khmer">
                អូសទម្លាក់ឯកសារ ឬ <span className="text-indigo-400 underline font-semibold">ចុចជ្រើសរើស</span>
              </p>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                MP3, WAV, M4A, MP4 (max 150MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Custom Glossary / Special Names (Optional) */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowGlossary(!showGlossary)}
          className="text-[11px] text-slate-400 hover:text-indigo-300 font-khmer transition-colors focus:outline-none"
        >
          <span>{showGlossary ? '− បិទប្រអប់ពាក្យពិសេស' : '+ បន្ថែមពាក្យពិសេស (Custom Glossary)'}</span>
        </button>

        {showGlossary && (
          <div className="mt-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
            <input
              type="text"
              value={customGlossary}
              onChange={(e) => setCustomGlossary(e.target.value)}
              disabled={isProcessing}
              placeholder="ឧទាហរណ៍៖ EZA Post, Seab Koeurn, ABA, Claude, ChatGPT..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-khmer"
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {['ChatGPT', 'Claude', 'Gemini', 'AI Agent', 'EZA Post'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    const current = customGlossary.split(',').map((s) => s.trim()).filter(Boolean);
                    if (!current.includes(tag)) {
                      setCustomGlossary([...current, tag].join(', '));
                    }
                  }}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 hover:text-indigo-300 border border-slate-700 text-[10px] text-slate-300 rounded-md transition-colors font-mono cursor-pointer"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="mt-3 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-400 text-xs font-khmer">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action / Progress Buttons */}
      <div className="mt-4 flex flex-col gap-3">
        {isProcessing && (
          <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-3 animate-in fade-in">
            {/* 3 Steps indicator */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-khmer">
              <div className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl transition-all ${
                uploadProgress >= 100 ? 'bg-emerald-500/15 text-emerald-400 font-semibold' : 'bg-indigo-500/20 text-indigo-300 font-semibold animate-pulse'
              }`}>
                <span>{uploadProgress >= 100 ? '✓' : '1.'}</span>
                <span className="truncate">Upload {uploadProgress > 0 && uploadProgress < 100 ? `(${uploadProgress}%)` : 'រួចរាល់'}</span>
              </div>

              <div className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl transition-all ${
                currentStep === 2 ? 'bg-indigo-500/25 text-indigo-300 font-semibold ring-1 ring-indigo-500/40 animate-pulse' :
                currentStep > 2 ? 'bg-emerald-500/15 text-emerald-400 font-semibold' :
                'bg-slate-900/60 text-slate-500'
              }`}>
                <span>{currentStep > 2 ? '✓' : '2.'}</span>
                <span className="truncate">AI ស្តាប់សំឡេង</span>
              </div>

              <div className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl transition-all ${
                currentStep === 3 ? 'bg-indigo-500/25 text-indigo-300 font-semibold ring-1 ring-indigo-500/40 animate-pulse' :
                'bg-slate-900/60 text-slate-500'
              }`}>
                <span>3.</span>
                <span className="truncate">តម្រឹម Subtitle</span>
              </div>
            </div>

            {/* Live Status text & Elapsed Time */}
            <div className="flex items-center justify-between text-xs font-khmer pt-0.5">
              <span className="flex items-center gap-2 text-slate-200 font-medium truncate">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                <span className="truncate">{progressStatus || 'AI កំពុងដំណើរការ...'}</span>
              </span>
              <span className="font-mono text-indigo-400 font-bold bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800 text-[11px] shrink-0">
                {elapsedSec < 10 ? `00:0${elapsedSec}` : `00:${elapsedSec}`}s
              </span>
            </div>

            {/* Visual Animated Progress Bar */}
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
              {uploadProgress < 100 ? (
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full" />
              )}
            </div>

            <p className="text-[11px] text-slate-400 text-center font-khmer pt-0.5">
              ⚡ បច្ចេកវិទ្យា Gemini 2.5 Flash ដំណើរការលឿនខ្ពស់ រង់ចាំប្រហែល 5-15 វិនាទី
            </p>
          </div>
        )}

        <div className="flex items-center gap-2.5 w-full justify-end">
          <button
            type="button"
            onClick={loadDemoSample}
            disabled={isProcessing}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium transition-all font-khmer whitespace-nowrap shadow-sm"
          >
            <span>សាកល្បង (Demo)</span>
          </button>

          <button
            onClick={startTranscription}
            disabled={!selectedFile || isProcessing}
            className={`flex-1 sm:flex-initial px-6 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-2 font-khmer whitespace-nowrap ${
              !selectedFile || isProcessing
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 active:scale-95 font-semibold'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>កំពុងបម្លែង... ({elapsedSec}s)</span>
              </>
            ) : (
              <span>បម្លែងជា Subtitle</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

