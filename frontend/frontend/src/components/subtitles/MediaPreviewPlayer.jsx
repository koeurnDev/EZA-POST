import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Film, Palette, Type, Sparkles, Smartphone, Monitor, Square } from 'lucide-react';

const KM_SEGMENTER = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter('km', { granularity: 'word' })
  : null;

const TOKEN_CACHE = new Map();

export const tokenizeKhmerSegments = (text) => {
  if (!text) return [];
  if (TOKEN_CACHE.has(text)) return TOKEN_CACHE.get(text);

  let result = null;
  try {
    if (KM_SEGMENTER) {
      result = Array.from(KM_SEGMENTER.segment(text));
    }
  } catch (e) {}

  if (!result) {
    result = text.split(/(\s+)/).map(s => ({ segment: s, isWordLike: s.trim().length > 0 }));
  }

  if (TOKEN_CACHE.size > 500) TOKEN_CACHE.clear();
  TOKEN_CACHE.set(text, result);
  return result;
};

export const tokenizeKhmerWords = (text) => {
  return tokenizeKhmerSegments(text).filter(s => s.isWordLike).map(s => s.segment);
};

export function getSubtitleTextShadow(preset) {
  if (preset === 'ocean_blue' || preset === 'grape_pill' || preset === 'soft_ai' || preset === 'boxed' || preset === 'comic_pop') {
    return 'none';
  }
  if (preset === 'cyberpunk') {
    return '0 0 12px rgba(6,182,212,0.8), 0 2px 4px rgba(0,0,0,0.7)';
  }
  if (preset === 'fire_hustle') {
    return '0 2px 6px rgba(0,0,0,0.7)';
  }
  if (preset === 'viral') {
    return '0 2px 5px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.8)';
  }
  // Soft, clean directional drop shadow for maximum Khmer legibility (no harsh muddy black borders)
  return '0 2px 6px rgba(0,0,0,0.75)';
}

export default function MediaPreviewPlayer({
  mediaUrl,
  mediaType = 'video',
  segments = [],
  currentTime,
  onTimeUpdate,
  activeSegmentId,
  fontClass = 'font-khmer',
  stylePreset = 'viral',
  position = 'bottom',
  onSeekRequest,
  aspectRatio = '16:9',
  onAspectRatioChange,
  isBounceEnabled = true,
  onBounceToggle
}) {
  const mediaRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [currentSegment, setCurrentSegment] = useState(null);

  const [localAspectRatio, setLocalAspectRatio] = useState('16:9');
  const [localBounce, setLocalBounce] = useState(true);
  const [syncOffset, setSyncOffset] = useState(0.18); // Default 180ms audio-lead: text appears right on speech onset, never lags behind voice

  const currentAspectRatio = aspectRatio || localAspectRatio;
  const currentBounce = isBounceEnabled !== undefined ? isBounceEnabled : localBounce;

  const handleAspectRatioSwitch = (ratio) => {
    setLocalAspectRatio(ratio);
    if (onAspectRatioChange) onAspectRatioChange(ratio);
  };

  const handleBounceSwitch = () => {
    const next = !currentBounce;
    setLocalBounce(next);
    if (onBounceToggle) onBounceToggle(next);
  };

  // Ultra-responsive 60FPS sync loop using requestAnimationFrame while playing
  const animFrameRef = useRef(null);
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const tick = () => {
      if (mediaRef.current && !mediaRef.current.paused) {
        onTimeUpdate(mediaRef.current.currentTime);
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  // Update current subtitle text and active segment based on playback time + sync offset
  const effectiveTime = Math.max(0, currentTime + syncOffset);

  useEffect(() => {
    const current = segments.find(
      (s) => effectiveTime >= s.start && effectiveTime <= s.end
    );
    setCurrentSegment(current || null);
    setCurrentText(current ? current.text : '');
  }, [effectiveTime, segments]);

  // Compute Word-Level Active Kinetic Highlight with Natural Khmer Word Spacing
  const renderKineticWords = () => {
    if (!currentSegment || !currentSegment.text) return null;
    const text = currentSegment.text.trim();
    if (!text) return null;

    if (!currentBounce) {
      return <span>{text}</span>;
    }

    const segments = tokenizeKhmerSegments(text);
    const wordSegments = segments.filter((s) => s.isWordLike);
    if (wordSegments.length <= 1) {
      return (
        <span className={currentBounce ? 'animate-word-pop inline-block' : 'inline'}>
          {text}
        </span>
      );
    }

    const segDuration = Math.max(0.1, currentSegment.end - currentSegment.start);
    const elapsed = Math.max(0, Math.min(segDuration, effectiveTime - currentSegment.start));
    const progress = Math.max(0, Math.min(1, elapsed / segDuration));
    const activeWordIndex = Math.min(
      Math.floor(progress * wordSegments.length),
      wordSegments.length - 1
    );

    let wordIdxCounter = 0;
    return segments.map((item, idx) => {
      if (!item.isWordLike) {
        return <span key={idx}>{item.segment}</span>;
      }

      const isActive = wordIdxCounter === activeWordIndex;
      const isPast = wordIdxCounter < activeWordIndex;
      wordIdxCounter++;

      // Pure inline styling to never break Khmer syllables, ligatures or subscripts
      let tokenClass = 'transition-all duration-150 ';
      if (isActive) {
        if (currentBounce) {
          tokenClass += 'animate-word-pop inline-block ';
        } else {
          tokenClass += 'inline ';
        }

        if (stylePreset === 'ocean_blue') {
          tokenClass += 'text-[#0284c7] font-black drop-shadow-[0_0_8px_rgba(2,132,199,0.35)]';
        } else if (stylePreset === 'cyberpunk') {
          tokenClass += 'text-cyan-400 font-black drop-shadow-[0_0_14px_rgba(56,189,248,0.95)]';
        } else if (stylePreset === 'hormozi_green') {
          tokenClass += 'text-lime-400 font-black drop-shadow-[0_0_14px_rgba(163,230,53,0.95)]';
        } else if (stylePreset === 'viral') {
          tokenClass += 'text-yellow-400 font-black drop-shadow-[0_0_14px_rgba(250,204,21,0.95)]';
        } else if (stylePreset === 'fire_hustle') {
          tokenClass += 'bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent font-black drop-shadow-[0_2px_10px_rgba(249,115,22,0.95)] px-0.5';
        } else if (stylePreset === 'grape_pill') {
          tokenClass += 'bg-yellow-400 text-slate-950 font-black px-2 py-0.5 rounded-lg shadow-lg';
        } else if (stylePreset === 'soft_ai') {
          tokenClass += 'text-indigo-300 font-extrabold underline decoration-indigo-400 decoration-2 underline-offset-4';
        } else if (stylePreset === 'ali_highlighter') {
          tokenClass += 'text-yellow-300 font-black underline decoration-yellow-400 decoration-4 underline-offset-4';
        } else if (stylePreset === 'comic_pop') {
          tokenClass += 'text-rose-600 underline font-black decoration-rose-500 decoration-2';
        } else if (stylePreset === 'neon_pink') {
          tokenClass += 'text-pink-400 font-black drop-shadow-[0_0_14px_rgba(244,114,182,0.95)]';
        } else if (stylePreset === 'boxed') {
          tokenClass += 'text-yellow-300 font-black drop-shadow-[0_0_10px_rgba(250,204,21,0.9)]';
        } else {
          // Classic White
          tokenClass += 'text-cyan-400 font-black drop-shadow-[0_0_12px_rgba(56,189,248,0.9)]';
        }
      } else if (isPast) {
        tokenClass += 'inline ';
        if (stylePreset === 'ocean_blue' || stylePreset === 'comic_pop') {
          tokenClass += 'opacity-100 text-slate-900 font-black';
        } else {
          tokenClass += 'opacity-100 text-white font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]';
        }
      } else {
        // Upcoming words: Clean dimmed translucent dark white / soft gray ("សរក្រមៅ សាមញ្ញ ស្អាត")
        tokenClass += 'inline ';
        if (stylePreset === 'ocean_blue') {
          tokenClass += 'opacity-40 text-slate-400 font-bold';
        } else if (stylePreset === 'comic_pop') {
          tokenClass += 'opacity-35 text-slate-900 font-bold';
        } else {
          tokenClass += 'opacity-35 text-white/50 font-bold';
        }
      }

      return (
        <span key={idx} className={tokenClass}>
          {item.segment}
        </span>
      );
    });
  };

  // Handle external seek requests
  useEffect(() => {
    if (onSeekRequest !== null && onSeekRequest !== undefined && mediaRef.current) {
      const targetTime = typeof onSeekRequest === 'object' ? onSeekRequest.time : onSeekRequest;
      if (typeof targetTime === 'number' && !isNaN(targetTime)) {
        mediaRef.current.currentTime = targetTime;
      }
    }
  }, [onSeekRequest]);

  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.pause();
    } else {
      mediaRef.current.play().catch(() => {});
    }
  };

  const lastUpdateTimeRef = useRef(0);
  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      const now = performance.now();
      // Throttle React state propagation to ~10 FPS (every 100ms) to ensure mobile 60fps butter-smooth scrolling
      if (now - lastUpdateTimeRef.current >= 100 || mediaRef.current.paused) {
        lastUpdateTimeRef.current = now;
        onTimeUpdate(mediaRef.current.currentTime);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration);
      const vw = mediaRef.current.videoWidth;
      const vh = mediaRef.current.videoHeight;
      if (vh > vw) {
        handleAspectRatioSwitch('9:16');
      } else if (vw > 0 && vh > 0) {
        handleAspectRatioSwitch('16:9');
      }
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    if (mediaRef.current) {
      mediaRef.current.currentTime = newTime;
      onTimeUpdate(newTime);
    }
  };

  const toggleMute = () => {
    if (!mediaRef.current) return;
    mediaRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatSeconds = (sec) => {
    if (isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Subtitle style classes based on user preferences
  const getSubtitleStyle = () => {
    let classes = 'text-center font-bold px-3 py-1.5 transition-all duration-150 leading-relaxed whitespace-pre-wrap break-words max-w-[90%] ';

    if (stylePreset === 'ocean_blue') {
      classes += 'text-slate-900 font-black text-base md:text-xl tracking-wide select-none';
    } else if (stylePreset === 'cyberpunk') {
      classes += 'text-cyan-400 text-base md:text-lg tracking-wide select-none';
    } else if (stylePreset === 'viral') {
      classes += 'text-yellow-400 text-base md:text-lg tracking-wide select-none';
    } else if (stylePreset === 'hormozi_green') {
      classes += 'text-white text-base md:text-lg tracking-wide select-none';
    } else if (stylePreset === 'fire_hustle') {
      classes += 'text-white text-base md:text-lg tracking-wide select-none';
    } else if (stylePreset === 'cyberpunk') {
      classes += 'text-cyan-400 text-base md:text-lg tracking-wide select-none';
    } else if (stylePreset === 'grape_pill') {
      classes += 'bg-gradient-to-r from-violet-600 to-purple-600 text-white font-black rounded-full shadow-lg px-5 py-1.5 text-sm md:text-base border border-violet-400/30 select-none';
    } else if (stylePreset === 'soft_ai') {
      classes += 'bg-slate-900/75 backdrop-blur-xl text-white font-bold rounded-2xl px-5 py-2 border border-white/20 shadow-lg text-sm md:text-base select-none';
    } else if (stylePreset === 'ali_highlighter') {
      classes += 'text-white text-base md:text-lg select-none';
    } else if (stylePreset === 'comic_pop') {
      classes += 'bg-amber-300 text-slate-950 font-black px-4 py-1.5 rounded-xl shadow-md border border-slate-900 text-sm md:text-base select-none';
    } else if (stylePreset === 'neon_pink') {
      classes += 'text-pink-400 text-base md:text-lg tracking-wide select-none';
    } else if (stylePreset === 'boxed') {
      classes += 'text-white bg-black/80 backdrop-blur-md rounded-lg text-sm md:text-base border border-white/10 shadow-lg px-4 py-1.5';
    } else {
      // Classic White
      classes += 'text-white text-base md:text-lg select-none';
    }

    return classes;
  };

  const getPositionClass = () => {
    if (position === 'top') {
      return currentAspectRatio === '9:16' ? 'top-16' : 'top-8';
    }
    if (position === 'middle') {
      return 'top-1/2 -translate-y-1/2';
    }
    // Bottom: In 9:16 vertical mode, lift up to avoid TikTok/Reels bottom action bar
    return currentAspectRatio === '9:16' ? 'bottom-24' : 'bottom-12';
  };

  const getContainerAspectClass = () => {
    if (currentAspectRatio === '9:16') {
      return 'aspect-[9/16] h-full max-w-full mx-auto';
    }
    if (currentAspectRatio === '1:1') {
      return 'aspect-square h-full max-w-full mx-auto';
    }
    return 'aspect-video w-full max-h-full mx-auto';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col h-full">
      {/* Top Reframe & Kinetic Word Animation Toolbar */}
      <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-slate-800/90 p-0.5 rounded-lg border border-slate-700/80 shadow-inner">
            <button
              type="button"
              onClick={() => handleAspectRatioSwitch('16:9')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                currentAspectRatio === '16:9'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3 h-3" />
              <span>16:9</span>
            </button>
            <button
              type="button"
              onClick={() => handleAspectRatioSwitch('9:16')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                currentAspectRatio === '9:16'
                  ? 'bg-gradient-to-r from-pink-500 to-indigo-600 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3 h-3 text-pink-300" />
              <span>9:16</span>
            </button>
            <button
              type="button"
              onClick={() => handleAspectRatioSwitch('1:1')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                currentAspectRatio === '1:1'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Square className="w-3 h-3" />
              <span>1:1</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Audio-Subtitle Sync Offset Adjuster */}
          <div className="flex items-center bg-slate-800/90 px-2 py-0.5 rounded-lg border border-slate-700/80 text-[11px] gap-1 font-khmer">
            <span className="text-slate-400">Sync សំឡេង៖</span>
            <button
              type="button"
              onClick={() => setSyncOffset((prev) => Math.min(0.6, parseFloat((prev + 0.05).toFixed(2))))}
              className="px-1.5 py-0.5 rounded hover:bg-slate-700 text-emerald-400 font-bold"
              title="ឱ្យអក្សរចេញមុនសំឡេង 0.05 វិនាទី"
            >
              +
            </button>
            <span className={`font-mono font-bold ${syncOffset > 0 ? 'text-emerald-400' : syncOffset < 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {syncOffset > 0 ? `+${syncOffset}s` : `${syncOffset}s`}
            </span>
            <button
              type="button"
              onClick={() => setSyncOffset((prev) => Math.max(-0.4, parseFloat((prev - 0.05).toFixed(2))))}
              className="px-1.5 py-0.5 rounded hover:bg-slate-700 text-amber-400 font-bold"
              title="ឱ្យអក្សរចេញក្រោយ 0.05 វិនាទី"
            >
              -
            </button>
            {syncOffset !== 0.18 && (
              <button
                type="button"
                onClick={() => setSyncOffset(0.18)}
                className="text-[10px] text-indigo-400 hover:underline ml-0.5"
                title="កំណត់លំនាំដើមស្វ័យប្រវត្តិតាមស្តង់ដារ (+0.18s)"
              >
                Auto
              </button>
            )}
          </div>

          {/* Kinetic Word Pop Animation Toggle (MrBeast / Hormozi Style) */}
          <button
            type="button"
            onClick={handleBounceSwitch}
            className={`px-2 py-0.5 rounded-lg border text-[11px] font-medium transition-all flex items-center gap-1 ${
              currentBounce
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
            }`}
            title="បើក/បិទចលនាលោតពាក្យ Kinetic Pop (MrBeast / Hormozi Style)"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>⚡ Word Pop {currentBounce ? '✓' : ''}</span>
          </button>
        </div>
      </div>

      {/* Player Display Container */}
      <div className="flex-1 min-h-0 bg-slate-950 p-2 flex justify-center items-center relative overflow-hidden">
        <div className={`relative h-full max-h-full ${getContainerAspectClass()} bg-black flex items-center justify-center overflow-hidden rounded-xl shadow-inner group border border-slate-800/80`}>
          {/* Keyframe Styles for Spring Pop */}
          <style>{`
            @keyframes wordBounceSpring {
              0% { transform: scale(0.92) translateY(0); opacity: 0.85; }
              35% { transform: scale(1.24) translateY(-3px); opacity: 1; }
              70% { transform: scale(1.08) translateY(-1px); opacity: 1; }
              100% { transform: scale(1.14) translateY(-1.5px); opacity: 1; }
            }
            .animate-word-pop {
              animation: wordBounceSpring 0.24s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
              display: inline-block;
              transform-origin: center bottom;
            }
          `}</style>

          {/* Clean Dark Underlay for 9:16 and 1:1 Auto-Reframe (Zero Mobile GPU Overhead) */}
          {mediaType === 'video' && currentAspectRatio !== '16:9' && (
            <div className="absolute inset-0 w-full h-full bg-slate-950/90 pointer-events-none" />
          )}

          {mediaType === 'video' ? (
            <video
              ref={mediaRef}
              src={mediaUrl}
              preload="auto"
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onClick={togglePlay}
              className="w-full h-full object-contain cursor-pointer relative z-10"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 p-8">
              <audio
                ref={mediaRef}
                src={mediaUrl}
                preload="auto"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 animate-pulse">
                <Volume2 className="w-8 h-8" />
              </div>
            </div>
          )}

          {/* Live Subtitle Overlay with Word-Level Kinetic Animation */}
          {currentText && (
            <div
              className={`absolute left-0 right-0 px-6 flex justify-center pointer-events-none z-20 ${getPositionClass()}`}
            >
              <div
                key={currentSegment?.id || 'sub'}
                className={`${getSubtitleStyle()} ${fontClass} animate-in fade-in-0 zoom-in-95 duration-150`}
                style={{
                  textShadow: getSubtitleTextShadow(stylePreset)
                }}
              >
                {renderKineticWords()}
              </div>
            </div>
          )}

          {/* Big Center Play Button Overlay on Pause */}
          {!isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all z-10"
            >
              <Play className="w-7 h-7 ml-1" />
            </button>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div className="px-3 py-2 bg-slate-900/90 border-t border-slate-800 space-y-2 shrink-0">
        {/* Progress Scrubber */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 w-12 text-right">
            {formatSeconds(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.01}
            value={currentTime || 0}
            onChange={handleSeek}
            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
          />
          <span className="text-xs font-mono text-slate-400 w-12">
            {formatSeconds(duration)}
          </span>
        </div>

        {/* Playback Controls & Styling shortcuts */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                if (mediaRef.current) {
                  mediaRef.current.currentTime = Math.max(0, mediaRef.current.currentTime - 3);
                }
              }}
              title="Skip back 3s"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all text-xs flex items-center gap-1 font-mono"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>3s</span>
            </button>

            <div className="flex items-center gap-1.5 ml-2">
              <button onClick={toggleMute} className="text-slate-400 hover:text-slate-200">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (mediaRef.current) {
                    mediaRef.current.volume = val;
                    mediaRef.current.muted = false;
                  }
                  setIsMuted(false);
                }}
                className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>

          {/* Quick Indicator */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Subtitle Preview Sync</span>
          </div>
        </div>
      </div>
    </div>
  );
}

