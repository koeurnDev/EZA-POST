import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Scissors,
  Trash2,
  Play,
  Pause,
  Magnet,
  ZoomIn,
  ZoomOut,
  Type,
  Volume2,
  Clock,
  Maximize2
} from 'lucide-react';

function formatTimeCode(seconds) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function formatRulerTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const TIMELINE_KM_SEGMENTER = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter('km', { granularity: 'word' })
  : null;
const TIMELINE_WORDS_CACHE = new Map();

function tokenizeWords(text) {
  if (!text) return [];
  if (TIMELINE_WORDS_CACHE.has(text)) return TIMELINE_WORDS_CACHE.get(text);

  const preSpaced = text
    .replace(/([\u1780-\u17FF])([A-Za-z0-9])/g, '$1 $2')
    .replace(/([A-Za-z0-9])([\u1780-\u17FF])/g, '$1 $2')
    .replace(/[\s\u200b]+/g, ' ')
    .trim();
  let words = null;
  try {
    if (TIMELINE_KM_SEGMENTER) {
      words = Array.from(TIMELINE_KM_SEGMENTER.segment(preSpaced))
        .filter((s) => s.isWordLike)
        .map((s) => s.segment.trim())
        .filter(Boolean);
    }
  } catch (e) {}

  if (!words || words.length === 0) {
    words = preSpaced.split(/\s+/).filter(Boolean);
  }

  if (TIMELINE_WORDS_CACHE.size > 500) TIMELINE_WORDS_CACHE.clear();
  TIMELINE_WORDS_CACHE.set(text, words);
  return words;
}

export default function WaveformTimeline({
  jobId,
  duration = 0,
  currentTime = 0,
  segments = [],
  onSeekRequest,
  onSegmentsChange
}) {
  const [peaks, setPeaks] = useState([]);
  const [zoom, setZoom] = useState(1); // 1x to 4x
  const [isSnapping, setIsSnapping] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSegId, setSelectedSegId] = useState(null);

  const scrollContainerRef = useRef(null);
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { segId, type: 'start'|'end'|'move', startX, origStart, origEnd }
  const [isScrubbingRuler, setIsScrubbingRuler] = useState(false);

  // Monitor playback state from media element
  useEffect(() => {
    const checkMedia = () => {
      const el = document.querySelector('video') || document.querySelector('audio');
      if (el) {
        setIsPlaying(!el.paused);
      }
    };
    const interval = setInterval(checkMedia, 250);
    return () => clearInterval(interval);
  }, []);

  // Fetch audio waveform peaks
  useEffect(() => {
    if (!jobId) return;
    fetch(`/api/v1/media/${jobId}/waveform?peaks=400`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.peaks) {
          setPeaks(data.peaks);
        }
      })
      .catch((err) => console.error('Waveform fetch error:', err));
  }, [jobId]);

  // Keep active segment in sync with currentTime
  useEffect(() => {
    const active = segments.find(
      (s) => currentTime >= s.start && currentTime <= s.end
    );
    if (active) {
      setSelectedSegId(active.id);
    }
  }, [currentTime, segments]);

  // Auto-scroll timeline to keep playhead in view when playing
  useEffect(() => {
    if (!scrollContainerRef.current || zoom <= 1 || !duration) return;
    const container = scrollContainerRef.current;
    const progress = currentTime / duration;
    const targetScrollLeft = progress * container.scrollWidth - container.clientWidth / 2;
    // Only smooth scroll if playing or far off
    if (isPlaying) {
      container.scrollLeft = targetScrollLeft;
    }
  }, [currentTime, duration, isPlaying, zoom]);

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    const el = document.querySelector('video') || document.querySelector('audio');
    if (el) {
      if (el.paused) {
        el.play();
        setIsPlaying(true);
      } else {
        el.pause();
        setIsPlaying(false);
      }
    }
  };

  // Convert mouse X to timeline seconds
  const getTimeFromEvent = useCallback(
    (e) => {
      if (!trackRef.current || !duration) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      return ratio * duration;
    },
    [duration]
  );

  // Ruler Scrubbing
  const handleRulerMouseDown = (e) => {
    setIsScrubbingRuler(true);
    const targetTime = getTimeFromEvent(e);
    if (onSeekRequest) onSeekRequest(targetTime);
  };

  useEffect(() => {
    const handleRulerMouseMove = (e) => {
      if (!isScrubbingRuler) return;
      const targetTime = getTimeFromEvent(e);
      if (onSeekRequest) onSeekRequest(targetTime);
    };

    const handleRulerMouseUp = () => {
      if (isScrubbingRuler) {
        setIsScrubbingRuler(false);
      }
    };

    if (isScrubbingRuler) {
      window.addEventListener('mousemove', handleRulerMouseMove);
      window.addEventListener('mouseup', handleRulerMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleRulerMouseMove);
        window.removeEventListener('mouseup', handleRulerMouseUp);
      };
    }
  }, [isScrubbingRuler, getTimeFromEvent, onSeekRequest]);

  // Drag Segment (Trim Start, Trim End, or Move)
  const startDrag = (e, seg, type) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedSegId(seg.id);
    setDragging({
      segId: seg.id,
      type,
      startX: e.clientX,
      origStart: seg.start,
      origEnd: seg.end
    });
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!dragging || !trackRef.current || !duration || !onSegmentsChange) return;
      const rect = trackRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragging.startX;
      const deltaTime = (deltaX / rect.width) * duration;

      const updated = segments.map((s) => {
        if (s.id !== dragging.segId) return s;

        let newStart = s.start;
        let newEnd = s.end;

        if (dragging.type === 'start') {
          newStart = Math.max(0, Math.min(dragging.origEnd - 0.2, dragging.origStart + deltaTime));
          // Snapping to playhead
          if (isSnapping && Math.abs(newStart - currentTime) < 0.15) {
            newStart = currentTime;
          }
          return { ...s, start: Math.round(newStart * 100) / 100 };
        } else if (dragging.type === 'end') {
          newEnd = Math.min(duration, Math.max(dragging.origStart + 0.2, dragging.origEnd + deltaTime));
          // Snapping to playhead
          if (isSnapping && Math.abs(newEnd - currentTime) < 0.15) {
            newEnd = currentTime;
          }
          return { ...s, end: Math.round(newEnd * 100) / 100 };
        } else if (dragging.type === 'move') {
          const segDur = dragging.origEnd - dragging.origStart;
          newStart = dragging.origStart + deltaTime;
          if (newStart < 0) newStart = 0;
          if (newStart + segDur > duration) newStart = duration - segDur;

          if (isSnapping && Math.abs(newStart - currentTime) < 0.15) {
            newStart = currentTime;
          }
          newEnd = newStart + segDur;

          return {
            ...s,
            start: Math.round(newStart * 100) / 100,
            end: Math.round(newEnd * 100) / 100
          };
        }
        return s;
      });

      onSegmentsChange(updated);
    },
    [dragging, duration, segments, onSegmentsChange, isSnapping, currentTime]
  );

  const handleMouseUp = useCallback(() => {
    if (dragging) setDragging(null);
  }, [dragging]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // CapCut Split Tool (✂️ Split at Playhead)
  const handleSplitAtPlayhead = () => {
    if (!segments.length || !onSegmentsChange) return;

    // Find the segment containing the playhead
    const targetIdx = segments.findIndex(
      (s) => currentTime > s.start + 0.15 && currentTime < s.end - 0.15
    );

    if (targetIdx === -1) return;

    const targetSeg = segments[targetIdx];
    const words = tokenizeWords(targetSeg.text);

    let textA = targetSeg.text;
    let textB = '';

    if (words.length > 1) {
      const dur = targetSeg.end - targetSeg.start;
      const ratio = (currentTime - targetSeg.start) / dur;
      const splitIdx = Math.max(1, Math.min(words.length - 1, Math.round(words.length * ratio)));
      textA = words.slice(0, splitIdx).join(' ');
      textB = words.slice(splitIdx).join(' ');
    } else {
      textA = targetSeg.text;
      textB = targetSeg.text;
    }

    const segA = {
      ...targetSeg,
      end: Math.round(currentTime * 100) / 100,
      text: textA
    };

    const segB = {
      id: Date.now() + Math.random(),
      start: Math.round(currentTime * 100) / 100,
      end: targetSeg.end,
      text: textB
    };

    const newSegments = [...segments];
    newSegments.splice(targetIdx, 1, segA, segB);
    onSegmentsChange(newSegments);
    setSelectedSegId(segB.id);
  };

  // CapCut Delete Tool (🗑️ Delete Selected / Active Segment)
  const handleDeleteSegment = () => {
    if (!segments.length || !onSegmentsChange) return;
    const toDeleteId = selectedSegId || segments.find((s) => currentTime >= s.start && currentTime <= s.end)?.id;
    if (!toDeleteId) return;

    const updated = segments.filter((s) => s.id !== toDeleteId);
    onSegmentsChange(updated);
    setSelectedSegId(null);
  };

  // Generate CapCut Time Ruler Ticks
  const renderRulerTicks = () => {
    if (!duration || duration <= 0) return null;

    let majorStep = 2; // seconds
    if (zoom === 1) {
      majorStep = duration > 60 ? 10 : duration > 20 ? 5 : 2;
    } else if (zoom === 2) {
      majorStep = duration > 60 ? 5 : 2;
    } else {
      majorStep = 1;
    }

    const ticks = [];
    for (let t = 0; t <= duration; t += majorStep) {
      const leftPercent = (t / duration) * 100;
      ticks.push(
        <div
          key={`major-${t}`}
          style={{ left: `${leftPercent}%` }}
          className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
        >
          <span className="text-[9px] font-mono text-slate-400 select-none -translate-x-1/2">
            {formatRulerTime(t)}
          </span>
          <div className="w-[1px] h-2 bg-slate-600 mt-0.5" />
        </div>
      );

      // Minor ticks in-between
      const subTicksCount = 4;
      const subStep = majorStep / subTicksCount;
      for (let s = 1; s < subTicksCount; s++) {
        const subTime = t + s * subStep;
        if (subTime < duration) {
          const subLeftPercent = (subTime / duration) * 100;
          ticks.push(
            <div
              key={`sub-${subTime}`}
              style={{ left: `${subLeftPercent}%` }}
              className="absolute bottom-0 w-[1px] h-1 bg-slate-700/60 pointer-events-none"
            />
          );
        }
      }
    }
    return ticks;
  };

  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-[#0e121b] border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden select-none">
      {/* 1. CapCut Pro Action Toolbar */}
      <div className="h-8 px-3 bg-[#131722] border-b border-slate-800 flex items-center justify-between text-xs shrink-0">
        {/* Left: Playhead Tools (Split, Delete, Play, Snap) */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Play / Pause */}
          <button
            onClick={handleTogglePlay}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </button>

          <div className="h-3.5 w-[1px] bg-slate-800 mx-0.5" />

          {/* Split at Playhead */}
          <button
            onClick={handleSplitAtPlayhead}
            title="Split កាត់ Segment នៅត្រង់ Playhead (Ctrl+B / S)"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-[11px] font-khmer border border-slate-700/80 group"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
            <span className="hidden sm:inline">Split</span>
          </button>

          {/* Delete Segment */}
          <button
            onClick={handleDeleteSegment}
            title="Delete លុប Segment ដែលជ្រើសរើស"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-all text-[11px] font-khmer border border-slate-700/80"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>

          {/* Snap Magnet Toggle */}
          <button
            onClick={() => setIsSnapping(!isSnapping)}
            title={isSnapping ? 'Snapping បើក' : 'Snapping បិទ'}
            className={`p-1 rounded transition-colors ${
              isSnapping ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Live Timecode Display (HH:MM:SS.ms) */}
        <div className="font-mono text-slate-200 text-xs tracking-wider font-semibold bg-slate-900/80 px-2.5 py-0.5 rounded border border-slate-800">
          <span className="text-indigo-400">{formatTimeCode(currentTime)}</span>
          <span className="text-slate-500 mx-1">/</span>
          <span className="text-slate-400">{formatTimeCode(duration)}</span>
        </div>

        {/* Right: CapCut Zoom Controls */}
        <div className="flex items-center gap-1.5 text-slate-400">
          <button
            onClick={() => setZoom(Math.max(1, zoom - 0.5))}
            disabled={zoom <= 1}
            title="Zoom Out"
            className="p-1 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ZoomOut className="w-3 h-3" />
          </button>

          <input
            type="range"
            min="1"
            max="4"
            step="0.5"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-16 sm:w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            title={`Zoom: ${zoom}x`}
          />

          <button
            onClick={() => setZoom(Math.min(4, zoom + 0.5))}
            disabled={zoom >= 4}
            title="Zoom In"
            className="p-1 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ZoomIn className="w-3 h-3" />
          </button>

          <button
            onClick={() => setZoom(1)}
            title="Fit to Screen"
            className={`p-1 rounded text-[10px] transition-colors ${zoom === 1 ? 'text-indigo-400 font-bold' : 'hover:text-white'}`}
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 2. CapCut Multi-Track Studio Layout */}
      <div className="flex flex-1 min-h-0 bg-[#0e121b]">
        {/* Left Sticky Track Headers Sidebar */}
        <div className="w-16 sm:w-20 bg-[#121622] border-r border-slate-800 flex flex-col shrink-0 select-none z-20">
          {/* Ruler Corner */}
          <div className="h-6 border-b border-slate-800 flex items-center justify-center text-[10px] font-mono text-slate-500">
            <Clock className="w-3 h-3 text-slate-500" />
          </div>

          {/* Subtitle Track Label */}
          <div className="h-8 border-b border-slate-800 flex items-center gap-1 px-1.5 text-amber-400 font-medium text-[10px] sm:text-xs bg-[#161b29]">
            <Type className="w-3 h-3 shrink-0" />
            <span className="truncate">Text</span>
          </div>

          {/* Audio Waveform Track Label */}
          <div className="h-8 flex items-center gap-1 px-1.5 text-cyan-400 font-medium text-[10px] sm:text-xs bg-[#121622]">
            <Volume2 className="w-3 h-3 shrink-0" />
            <span className="truncate">Audio</span>
          </div>
        </div>

        {/* Right Scrollable Multi-Track Lanes with Synchronized Playhead */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto no-scrollbar relative"
        >
          <div
            ref={trackRef}
            style={{ width: `${zoom * 100}%` }}
            className="relative min-w-full flex flex-col select-none"
          >
            {/* Top Time Ruler Track */}
            <div
              onMouseDown={handleRulerMouseDown}
              className="h-6 bg-[#131722] border-b border-slate-800 relative cursor-pointer hover:bg-[#161c2b] transition-colors"
            >
              {renderRulerTicks()}
            </div>

            {/* Track 1: CapCut Auto-Caption Subtitle Track */}
            <div
              onClick={(e) => {
                if (dragging) return;
                const t = getTimeFromEvent(e);
                if (onSeekRequest) onSeekRequest(t);
              }}
              className="h-8 bg-[#0a0d14] border-b border-slate-800/80 relative overflow-hidden"
            >
              {duration > 0 &&
                segments.map((seg) => {
                  const left = Math.max(0, (seg.start / duration) * 100);
                  const width = Math.max(0.6, ((seg.end - seg.start) / duration) * 100);
                  const isSelected = selectedSegId === seg.id;
                  const isCurrent = currentTime >= seg.start && currentTime <= seg.end;

                  return (
                    <div
                      key={seg.id}
                      style={{
                        left: `${left}%`,
                        width: `${width}%`
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSegId(seg.id);
                        if (onSeekRequest) onSeekRequest(seg.start);
                      }}
                      className={`absolute top-0.5 bottom-0.5 rounded-md flex items-center group transition-all duration-100 z-10 ${
                        isSelected || isCurrent
                          ? 'bg-[#d97706] border-2 border-white shadow-[0_0_12px_rgba(245,158,11,0.6)] text-white'
                          : 'bg-[#b45309]/50 hover:bg-[#b45309]/80 border border-amber-500/60 text-amber-100'
                      }`}
                      title={`[${seg.start}s - ${seg.end}s]: ${seg.text}`}
                    >
                      {/* Left Drag Handle (Trim Start) */}
                      <div
                        onMouseDown={(e) => startDrag(e, seg, 'start')}
                        className={`w-2 h-full rounded-l cursor-ew-resize flex items-center justify-center transition-all ${
                          isSelected || isCurrent
                            ? 'bg-white opacity-100'
                            : 'bg-amber-300/40 group-hover:bg-white/80 opacity-0 group-hover:opacity-100'
                        }`}
                        title="ទាញកែម៉ោងដើម (Trim Start)"
                      >
                        <div className="w-[1px] h-3 bg-slate-900" />
                      </div>

                      {/* Center Move Content */}
                      <div
                        onMouseDown={(e) => startDrag(e, seg, 'move')}
                        className="flex-1 px-1.5 h-full flex items-center overflow-hidden cursor-grab active:cursor-grabbing"
                      >
                        <span className="text-[10px] sm:text-[11px] font-khmer truncate select-none leading-none font-medium">
                          {seg.text}
                        </span>
                      </div>

                      {/* Right Drag Handle (Trim End) */}
                      <div
                        onMouseDown={(e) => startDrag(e, seg, 'end')}
                        className={`w-2 h-full rounded-r cursor-ew-resize flex items-center justify-center transition-all ${
                          isSelected || isCurrent
                            ? 'bg-white opacity-100'
                            : 'bg-amber-300/40 group-hover:bg-white/80 opacity-0 group-hover:opacity-100'
                        }`}
                        title="ទាញកែម៉ោងចប់ (Trim End)"
                      >
                        <div className="w-[1px] h-3 bg-slate-900" />
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Track 2: CapCut Audio Waveform Track */}
            <div
              onClick={(e) => {
                if (dragging) return;
                const t = getTimeFromEvent(e);
                if (onSeekRequest) onSeekRequest(t);
              }}
              className="h-8 bg-[#0b0e15] relative overflow-hidden flex items-center px-1 cursor-pointer"
            >
              {/* Waveform Bars Background */}
              <div className="absolute inset-0 flex items-center justify-between px-1 gap-[1.5px]">
                {peaks.length > 0
                  ? peaks.map((p, i) => {
                      const heightPercent = Math.max(12, p * 90);
                      const isPassed = (i / peaks.length) * 100 <= playheadPercent;
                      return (
                        <div
                          key={i}
                          style={{ height: `${heightPercent}%` }}
                          className={`flex-1 min-w-[1px] rounded-full transition-colors duration-75 ${
                            isPassed ? 'bg-cyan-400' : 'bg-slate-700/80'
                          }`}
                        />
                      );
                    })
                  : Array.from({ length: 160 }).map((_, i) => (
                      <div
                        key={i}
                        style={{ height: `${Math.sin(i * 0.25) * 35 + 40}%` }}
                        className="flex-1 min-w-[1.5px] rounded-full bg-slate-800/80"
                      />
                    ))}
              </div>
            </div>

            {/* CapCut Signature Playhead (Spans Ruler + Text + Audio Tracks) */}
            <div
              style={{ left: `${playheadPercent}%` }}
              className="absolute top-0 bottom-0 pointer-events-none z-30"
            >
              {/* Top Ruler Pointer Pin / Head */}
              <div className="absolute top-0 -translate-x-1/2 flex flex-col items-center">
                <div className="w-3.5 h-3.5 bg-white shadow-lg rounded-t-sm flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                </div>
                <div
                  className="w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[6px] border-t-white"
                />
              </div>

              {/* Vertical Playhead Cursor Line */}
              <div className="absolute top-4 bottom-0 w-[1.5px] bg-white -ml-[0.75px] shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
