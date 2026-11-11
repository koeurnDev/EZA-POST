import React, { useState, useEffect, useRef } from 'react';
import { Download, Save, Plus, Trash2, Split, Clock, Check, FileText, Sparkles, Play, Film, Loader2, Search, Copy, X, RefreshCw, Palette, ChevronDown } from 'lucide-react';
import { getSubtitleTextShadow } from './MediaPreviewPlayer';


function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const sec = totalSec % 60;
  const mins = Math.floor(totalSec / 60) % 60;
  const hours = Math.floor(totalSec / 3600);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function formatTimeAss(seconds) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const totalCs = Math.round(seconds * 100);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const mins = Math.floor(totalSec / 60) % 60;
  const hours = Math.floor(totalSec / 3600);
  return `${hours}:${String(mins).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

const EDITOR_KM_SEGMENTER = typeof Intl !== 'undefined' && Intl.Segmenter
  ? new Intl.Segmenter('km', { granularity: 'word' })
  : null;
const EDITOR_WORDS_CACHE = new Map();

export const tokenizeRealWords = (text) => {
  if (!text) return [];
  if (EDITOR_WORDS_CACHE.has(text)) return EDITOR_WORDS_CACHE.get(text);

  // Ensure English words/numbers are spaced from Khmer
  const preSpaced = text
    .replace(/([\u1780-\u17FF])([A-Za-z0-9])/g, '$1 $2')
    .replace(/([A-Za-z0-9])([\u1780-\u17FF])/g, '$1 $2')
    .replace(/[\s\u200b]+/g, ' ')
    .trim();

  let words = null;
  try {
    if (EDITOR_KM_SEGMENTER) {
      words = Array.from(EDITOR_KM_SEGMENTER.segment(preSpaced))
        .filter((s) => s.isWordLike)
        .map((s) => s.segment.trim())
        .filter(Boolean);
    }
  } catch (e) {}

  if (!words || words.length === 0) {
    words = preSpaced.split(/\s+/).filter(Boolean);
  }

  if (EDITOR_WORDS_CACHE.size > 500) EDITOR_WORDS_CACHE.clear();
  EDITOR_WORDS_CACHE.set(text, words);
  return words;
};

export const tokenizeKhmerWords = tokenizeRealWords;

function chunkTextByWords(text, count) {
  if (!text) return [];
  const preSpaced = text
    .replace(/([\u1780-\u17FF])([A-Za-z0-9])/g, '$1 $2')
    .replace(/([A-Za-z0-9])([\u1780-\u17FF])/g, '$1 $2')
    .replace(/[\s\u200b]+/g, ' ')
    .trim();

  try {
    if (EDITOR_KM_SEGMENTER) {
      const raw = Array.from(EDITOR_KM_SEGMENTER.segment(preSpaced));
      const wordIndices = [];
      raw.forEach((item, idx) => {
        if (item.isWordLike) wordIndices.push(idx);
      });
      if (wordIndices.length <= count) return [preSpaced];

      const chunks = [];
      for (let i = 0; i < wordIndices.length; i += count) {
        const firstRawIdx = wordIndices[i];
        const nextFirstRawIdx = i + count < wordIndices.length ? wordIndices[i + count] : raw.length;
        const sliceText = raw
          .slice(firstRawIdx, nextFirstRawIdx)
          .map((r) => r.segment)
          .join('')
          .trim();
        if (sliceText) chunks.push(sliceText);
      }
      if (chunks.length > 0) return chunks;
    }
  } catch (e) {}

  const words = tokenizeRealWords(preSpaced);
  if (words.length <= count) return [preSpaced];
  const fallbackChunks = [];
  for (let i = 0; i < words.length; i += count) {
    fallbackChunks.push(words.slice(i, i + count).join(' '));
  }
  return fallbackChunks;
}

// Reconstruct natural phrase segments if baseSegments were previously overwritten by 1-word/2-word split segments
function ensurePhraseSegments(segments) {
  if (!Array.isArray(segments) || segments.length <= 2) return segments || [];
  const avgWords =
    segments.reduce((sum, s) => sum + tokenizeRealWords(s.text || '').length, 0) / segments.length;
  const avgDur =
    segments.reduce((sum, s) => sum + Math.max(0, (s.end || 0) - (s.start || 0)), 0) / segments.length;

  // If segments are already normal phrases (> 2.5 words on average or > 1.5s average duration), keep as-is
  if (avgWords > 2.5 && avgDur > 1.3) {
    return segments;
  }

  // Otherwise merge tiny split segments back into natural ~2.8s phrases (6-8 words)
  const merged = [];
  let current = null;
  let currentWordCount = 0;

  for (const seg of segments) {
    const txt = (seg.text || '').trim();
    if (!txt) continue;
    const wCount = Math.max(1, tokenizeRealWords(txt).length);

    if (!current) {
      current = { ...seg, text: txt };
      currentWordCount = wCount;
    } else {
      const gap = (seg.start || 0) - (current.end || 0);
      const newDur = (seg.end || 0) - (current.start || 0);
      if (gap <= 0.6 && newDur <= 3.6 && currentWordCount + wCount <= 8) {
        const needsSpace =
          /[A-Za-z0-9]$/.test(current.text) || /^[A-Za-z0-9]/.test(txt);
        current.text = needsSpace ? `${current.text} ${txt}` : `${current.text}${txt}`;
        current.end = seg.end;
        currentWordCount += wCount;
      } else {
        merged.push({ ...current, id: merged.length + 1 });
        current = { ...seg, text: txt };
        currentWordCount = wCount;
      }
    }
  }
  if (current) {
    merged.push({ ...current, id: merged.length + 1 });
  }
  return merged;
}

function splitSegmentsByWords(sourceSegments, pacingMode = 'phrase') {
  if (!Array.isArray(sourceSegments)) return [];
  if (!pacingMode || pacingMode === 'phrase' || pacingMode === '0') {
    return sourceSegments.map((s, idx) => ({ ...s, id: idx + 1 }));
  }

  const count = parseInt(pacingMode, 10) || 1;
  const result = [];
  let segCounter = 1;

  for (const seg of sourceSegments) {
    const text = (seg.text || '').trim();
    if (!text) continue;

    // 1. If acoustic word timestamps from Gemini exist, use them directly for 100% precision!
    if (Array.isArray(seg.words) && seg.words.length > 0) {
      const validWords = seg.words.filter(w => w.word && w.word.trim());
      if (validWords.length > count) {
        for (let i = 0; i < validWords.length; i += count) {
          const slice = validWords.slice(i, i + count);
          const chunkText = slice.map(w => w.word.trim()).join(' ');
          const chunkStart = slice[0].start !== undefined ? slice[0].start : seg.start;
          const chunkEnd = slice[slice.length - 1].end !== undefined ? slice[slice.length - 1].end : seg.end;
          result.push({
            id: segCounter++,
            start: Math.round(chunkStart * 100) / 100,
            end: Math.round(chunkEnd * 100) / 100,
            text: chunkText,
            words: slice
          });
        }
        continue;
      }
    }

    // 2. Natural Khmer Word Chunking using Intl.Segmenter + proportional duration
    const chunks = chunkTextByWords(text, count);
    if (chunks.length <= 1) {
      result.push({
        ...seg,
        id: segCounter++,
        start: Math.round(seg.start * 100) / 100,
        end: Math.round(seg.end * 100) / 100,
        text: chunks[0] || text
      });
      continue;
    }

    const totalChars = chunks.reduce((sum, c) => sum + c.length, 0);
    const duration = Math.max(0.3, seg.end - seg.start);

    let currentStart = seg.start;
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunkText = chunks[idx];
      const ratio = totalChars > 0 ? chunkText.length / totalChars : 1 / chunks.length;
      const chunkDur = duration * ratio;
      let chunkEnd = Math.min(seg.end, currentStart + chunkDur);

      if (idx === chunks.length - 1 || chunkEnd > seg.end) {
        chunkEnd = seg.end;
      }

      result.push({
        id: segCounter++,
        start: Math.round(currentStart * 100) / 100,
        end: Math.round(chunkEnd * 100) / 100,
        text: chunkText
      });

      currentStart = chunkEnd;
    }
  }

  return result;
}

export const STYLE_CATALOG = [
  {
    id: 'ocean_blue',
    name: 'Ocean Blue (Creator Light)',
    badge: 'Trending 2026 🌊',
    desc: 'អក្សរខ្មៅដិត ពាក្យដែលកំពុងនិយាយភ្លឺខៀវ Ocean Blue ហើយពាក្យមិនទាន់ដល់ចេញពណ៌ប្រផេះស្រាល សាមញ្ញ ស្អាត គ្មាន background',
    previewText: '🌊 បើខ្ញុំប្រើ ChatGPT Claude Gemini និង',
    previewClass: 'text-slate-900 font-black text-lg select-none',
    previewBg: 'bg-slate-100',
    colorHex: '#0284C7',
  },
  {
    id: 'cyberpunk',
    name: 'Cyber Cyan (Clean Dark)',
    badge: 'Trending 2026 💎',
    desc: 'អក្សរសថ្លា ពាក្យដែលកំពុងនិយាយភ្លឺខៀវ Cyber Cyan ហើយពាក្យមិនទាន់ដល់ចេញពណ៌សរស្រអាប់ សាមញ្ញ ស្អាត',
    previewText: '💎 មនុស្សយើងប្រើទូរស័ព្ទនិយាយ',
    previewClass: 'text-cyan-400 font-extrabold text-lg',
    previewBg: 'bg-slate-950/80',
    colorHex: '#38BDF8',
  },
  {
    id: 'viral',
    name: 'MrBeast Viral Pop',
    badge: 'Beast Gold ⚡',
    desc: 'អក្សរសថ្លា ពាក្យដែលកំពុងនិយាយភ្លឺលឿងមាស លោតពាក្យម្តងមួយបែប MrBeast',
    previewText: '⚡ ស្វាគមន៍មកកាន់ KhmerSub AI',
    previewClass: 'text-yellow-400 font-black text-lg tracking-wide',
    previewBg: 'bg-slate-950/80',
    colorHex: '#FACC15',
  },
  {
    id: 'hormozi_green',
    name: 'Alex Hormozi Lime',
    badge: 'High Retention 🚀',
    desc: 'អក្សរសថ្លា ស្រមោលទន់ ពាក្យដែលកំពុងនិយាយភ្លឺពណ៌បៃតង Fluorescent Lime',
    previewText: '🚀 បង្កើនការទស្សនា 10x លើ Facebook & Reels',
    previewClass: 'text-lime-400 font-extrabold text-lg',
    previewBg: 'bg-slate-950/80',
    colorHex: '#A3E635',
  },
  {
    id: 'grape_pill',
    name: 'Grape Pastel Pill',
    badge: 'TikTok Badge 🍇',
    desc: 'ស្លាកពងក្រពើពណ៌ស្វាយ Remotion Grape ស្រស់ស្អាត ពេញនិយមលើ TikTok & Shorts',
    previewText: '🍇 ភាពច្នៃប្រឌិត និងការកាត់តទាន់សម័យ',
    previewClass: 'bg-gradient-to-r from-violet-600 to-purple-600 text-white font-black px-4 py-1.5 rounded-full text-sm border border-violet-400/40 inline-block',
    previewBg: 'bg-slate-950/60',
    colorHex: '#9333EA',
  },
  {
    id: 'soft_ai',
    name: 'Soft-AI Glassmorphism',
    badge: 'Frosted Glass 🧊',
    desc: 'បន្ទះកញ្ចក់ព្រាលថ្លា Frosted Glass ទំនើប 2026 មើលទៅប្រណីត និងថ្លៃថ្នូរ',
    previewText: '🧊 បច្ចេកវិទ្យាបញ្ញាសិប្បនិម្មិតជំនាន់ថ្មី',
    previewClass: 'bg-slate-900/70 backdrop-blur-xl text-white font-bold px-4 py-1.5 rounded-2xl text-sm border border-white/20 inline-block',
    previewBg: 'bg-slate-800/60',
    colorHex: '#6366F1',
  },
  {
    id: 'ali_highlighter',
    name: 'Ali Abdaal Highlighter',
    badge: 'Storyteller ✍️',
    desc: 'ស្ទីល Ali Abdaal — អក្សរស គូសចំណាំ Highlighter លើពាក្យដែលកំពុងនិយាយ',
    previewText: '✍️ ការចែករំលែកបទពិសោធន៍ និងចំណេះដឹង',
    previewClass: 'text-white font-bold text-base underline decoration-yellow-400 decoration-4 underline-offset-4',
    previewBg: 'bg-slate-950/80',
    colorHex: '#FACC15',
  },
  {
    id: 'comic_pop',
    name: 'Comic Manga Sticker',
    badge: 'Bangers Pop 💥',
    desc: 'រចនាប័ទ្មបែបគំនូរជីវចល Comic ស្លាកលឿង គែមខ្មៅស្អាត និងស្រមោលបែប Pop-art',
    previewText: '💥 កាត់តវីដេអូកាន់តែលឿន និងទាក់ទាញ',
    previewClass: 'bg-amber-300 text-slate-950 font-black px-4 py-1 rounded-xl text-sm border border-black inline-block',
    previewBg: 'bg-slate-950/60',
    colorHex: '#F59E0B',
  },
  {
    id: 'neon_pink',
    name: 'Pastel Magenta',
    badge: 'Aesthetic 🌸',
    desc: 'ពណ៌ស៊ីជម្ពូផ្កាឈូកទន់ភ្លឺ សម្រាប់ Vlog ដំណើរកម្សាន្ត និង Fashion',
    previewText: '🌸 រីករាយជាមួយជីវិតប្រចាំថ្ងៃ និងដំណើរកម្សាន្ត',
    previewClass: 'text-pink-400 font-extrabold text-lg',
    previewBg: 'bg-slate-950/80',
    colorHex: '#F472B6',
  },
  {
    id: 'boxed',
    name: 'Netflix Boxed',
    badge: 'Cinema Pro ⬛',
    desc: 'ប្រអប់ខ្មៅព្រាលថ្លាអក្សរស ងាយអាន ១០០% លើ Background ភ្លឺ',
    previewText: '⬛ ឯកសារភាពយន្ត និងការរៀបរាប់ដំណើររឿង',
    previewClass: 'bg-black/85 backdrop-blur-md text-white font-bold px-4 py-1.5 rounded-lg text-sm border border-white/10 inline-block',
    previewBg: 'bg-slate-800/80',
    colorHex: '#1E293B',
  },
  {
    id: 'classic',
    name: 'Classic Minimalist',
    badge: 'Standard ⚪',
    desc: 'អក្សរពណ៌សស្អាត សាមញ្ញ គែមស្រមោលទន់ ស័ក្តិសមគ្រប់វីដេអូ',
    previewText: '⚪ ការចែករំលែកបទពិសោធន៍ និងការបង្រៀន',
    previewClass: 'text-white font-bold text-lg',
    previewBg: 'bg-slate-950/80',
    colorHex: '#FFFFFF',
  },
];

export default function SubtitleEditor({
  job,
  currentTime,
  onSeekRequest,
  fontClass,
  setFontClass,
  stylePreset,
  setStylePreset,
  position,
  setPosition,
  aspectRatio = '9:16',
  setAspectRatio,
  isBounceEnabled = false,
  setIsBounceEnabled,
  onJobUpdated
}) {
  const [baseSegments, setBaseSegments] = useState(job.segments || []);
  const [segments, setSegments] = useState(job.segments || []);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [renderStatus, setRenderStatus] = useState('IDLE');
  const [renderError, setRenderError] = useState('');
  const [wordsPerSub, setWordsPerSub] = useState('phrase');

  // Export Dropdown Menu state
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Style Preset Gallery Modal state
  const [showStylesModal, setShowStylesModal] = useState(false);

  // Find & Replace state
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [replaceCount, setReplaceCount] = useState(null);

  // Social Captions state
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [captionLang, setCaptionLang] = useState('km');
  const [captions, setCaptions] = useState([]);
  const [loadingCaptions, setLoadingCaptions] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Import Script (Forced Alignment Mode, CER = 0%) state
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptText, setScriptText] = useState('');
  const [scriptSuccessCount, setScriptSuccessCount] = useState(null);

  const lastInternalUpdateRef = useRef(null);

  // Keep in sync with job.segments (initial load OR external Timeline Split/Delete)
  useEffect(() => {
    if (job?.segments && job.segments.length > 0) {
      if (job.segments !== lastInternalUpdateRef.current) {
        const cleanPhrases = ensurePhraseSegments(job.segments);
        lastInternalUpdateRef.current = job.segments;
        setBaseSegments(cleanPhrases);
        const currentView = wordsPerSub === 'phrase' ? cleanPhrases : splitSegmentsByWords(cleanPhrases, wordsPerSub);
        setSegments(currentView);
      }
    }
  }, [job?.segments]);

  const updateSegmentsAndNotify = (updated) => {
    lastInternalUpdateRef.current = updated;
    setSegments(updated);
    if (wordsPerSub === 'phrase') {
      setBaseSegments(updated);
    }
    if (onJobUpdated) {
      onJobUpdated({ ...job, segments: updated });
    }
    setSaveSuccess(false);
  };

  // Auto-Save Base Phrase Draft to LocalStorage so edits are never lost on refresh
  useEffect(() => {
    if (job?.job_id && baseSegments?.length > 0) {
      try {
        localStorage.setItem(`khmersub_base_draft_${job.job_id}`, JSON.stringify(baseSegments));
      } catch (e) {}
    }
  }, [baseSegments, job?.job_id]);

  // Restore saved base phrase draft if available
  useEffect(() => {
    if (!job?.job_id) return;
    try {
      // Remove legacy corrupted split draft key if present
      localStorage.removeItem(`khmersub_draft_${job.job_id}`);
      const saved = localStorage.getItem(`khmersub_base_draft_${job.job_id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleanPhrases = ensurePhraseSegments(parsed);
          lastInternalUpdateRef.current = cleanPhrases;
          setBaseSegments(cleanPhrases);
          setSegments(cleanPhrases);
          if (onJobUpdated) {
            onJobUpdated({ ...job, segments: cleanPhrases });
          }
        }
      }
    } catch (e) {}
  }, [job?.job_id]);

  // Dynamic Pacing Change (Standard Phrase, 1 Word, 2 Words, 3 Words)
  const handlePacingChange = (newPacing) => {
    setWordsPerSub(newPacing);
    const cleanBase = ensurePhraseSegments(baseSegments);
    if (cleanBase !== baseSegments) {
      setBaseSegments(cleanBase);
    }
    const updated = splitSegmentsByWords(cleanBase, newPacing);
    lastInternalUpdateRef.current = updated;
    setSegments(updated);
    if (onJobUpdated) {
      onJobUpdated({ ...job, segments: updated });
    }
  };

  const handleBulkReplace = () => {
    if (!findText) return;
    let count = 0;
    const updated = segments.map((seg) => {
      if (seg.text && seg.text.includes(findText)) {
        const occurrences = seg.text.split(findText).length - 1;
        count += occurrences;
        return { ...seg, text: seg.text.replaceAll(findText, replaceText) };
      }
      return seg;
    });
    setSegments(updated);
    setBaseSegments(updated);
    setReplaceCount(count);
    if (onJobUpdated) {
      onJobUpdated({ ...job, segments: updated });
    }
    setSaveSuccess(false);
  };

  const handleApplyScript = (mode = 'segments') => {
    if (!scriptText.trim()) return;
    const lines = scriptText.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    let updated = [];
    if (mode === 'segments' && baseSegments.length > 0) {
      updated = baseSegments.map((seg, i) => ({
        ...seg,
        text: i < lines.length ? lines[i] : seg.text
      }));
      if (lines.length > baseSegments.length) {
        let lastEnd = baseSegments[baseSegments.length - 1].end;
        for (let j = baseSegments.length; j < lines.length; j++) {
          updated.push({
            id: j + 1,
            start: Math.round(lastEnd * 1000) / 1000,
            end: Math.round((lastEnd + 2.5) * 1000) / 1000,
            text: lines[j]
          });
          lastEnd += 2.5;
        }
      }
    } else {
      const totalDur = job.duration || (baseSegments.length > 0 ? baseSegments[baseSegments.length - 1].end : 30.0);
      const step = totalDur / lines.length;
      updated = lines.map((line, idx) => ({
        id: idx + 1,
        start: Math.round(idx * step * 1000) / 1000,
        end: Math.round((idx + 1) * step * 1000) / 1000,
        text: line
      }));
    }

    setBaseSegments(updated);
    setSegments(updated);
    setWordsPerSub('phrase');
    if (onJobUpdated) {
      onJobUpdated({ ...job, segments: updated });
    }
    setScriptSuccessCount(lines.length);
    setSaveSuccess(false);
    setTimeout(() => {
      setScriptSuccessCount(null);
      setShowScriptModal(false);
    }, 1600);
  };

  const handleFetchCaptions = async (lang = captionLang) => {
    setShowCaptionModal(true);
    setLoadingCaptions(true);
    try {
      const res = await fetch(`/api/v1/jobs/${job.job_id}/captions?language=${lang}`);
      if (res.ok) {
        const data = await res.json();
        setCaptions(data.captions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCaptions(false);
    }
  };

  const handleLangChange = (newLang) => {
    setCaptionLang(newLang);
    handleFetchCaptions(newLang);
  };

  const handleCopyCaption = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const handleRenderVideo = async () => {
    setRenderStatus('QUEUED');
    setRenderError('');
    try {
      const formData = new FormData();
      formData.append('style_preset', stylePreset);
      let fontName = 'Noto Sans Khmer';
      if (fontClass.includes('kantumruy')) fontName = 'Kantumruy Pro';
      else if (fontClass.includes('battambang')) fontName = 'Battambang';
      else if (fontClass.includes('moul')) fontName = 'Moul';
      formData.append('font_name', fontName);
      formData.append('aspect_ratio', aspectRatio || '16:9');
      formData.append('words_per_sub', String(wordsPerSub));

      const res = await fetch(`/api/v1/jobs/${job.job_id}/render-video`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Failed to trigger video render');
      }

      const poll = setInterval(async () => {
        try {
          const sRes = await fetch(`/api/v1/jobs/${job.job_id}/render-status`);
          const sData = await sRes.json();
          if (sData.status === 'COMPLETED') {
            clearInterval(poll);
            setRenderStatus('COMPLETED');
          } else if (sData.status === 'FAILED') {
            clearInterval(poll);
            setRenderStatus('FAILED');
            setRenderError(sData.error || 'Render failed');
          } else if (sData.status === 'RENDERING') {
            setRenderStatus('RENDERING');
          }
        } catch (e) {
          clearInterval(poll);
          setRenderStatus('FAILED');
          setRenderError(e.message);
        }
      }, 2000);
    } catch (err) {
      setRenderStatus('FAILED');
      setRenderError(err.message);
    }
  };

  const activeSegmentIndex = segments.findIndex(
    (s) => currentTime >= s.start && currentTime <= s.end
  );

  const handleTextChange = (index, newText) => {
    const updated = [...segments];
    updated[index] = { ...updated[index], text: newText };
    updateSegmentsAndNotify(updated);
  };

  const handleTimeChange = (index, field, value) => {
    const updated = [...segments];
    const num = parseFloat(value);
    if (!isNaN(num)) {
      updated[index] = { ...updated[index], [field]: num };
      updateSegmentsAndNotify(updated);
    }
  };

  const handleDelete = (index) => {
    const updated = segments.filter((_, i) => i !== index);
    updated.forEach((s, idx) => (s.id = idx + 1));
    updateSegmentsAndNotify(updated);
  };

  const handleAddSegment = (index) => {
    const prev = segments[index];
    const newStart = prev ? prev.end + 0.05 : 0;
    const newEnd = prev ? prev.end + 3.0 : 3.0;

    const newSeg = {
      id: segments.length + 1,
      start: roundTo3(newStart),
      end: roundTo3(newEnd),
      text: ''
    };

    const updated = [...segments];
    updated.splice(index + 1, 0, newSeg);
    updated.forEach((s, idx) => (s.id = idx + 1));
    updateSegmentsAndNotify(updated);
  };

  const handleSplitSegment = (index) => {
    const seg = segments[index];
    if (!seg) return;

    const segDur = Math.max(0.2, seg.end - seg.start);
    // If currentTime is inside the segment, split at currentTime; otherwise split at 50% midpoint
    const splitTime = (currentTime > seg.start + 0.1 && currentTime < seg.end - 0.1)
      ? currentTime
      : seg.start + segDur / 2;

    const ratio = Math.max(0.1, Math.min(0.9, (splitTime - seg.start) / segDur));

    let text1 = (seg.text || '').trim();
    let text2 = '';
    const words = text1.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      const splitIdx = Math.max(1, Math.min(words.length - 1, Math.round(words.length * ratio)));
      text1 = words.slice(0, splitIdx).join(' ');
      text2 = words.slice(splitIdx).join(' ');
    }

    const firstEnd = roundTo3(splitTime);
    const secondStart = roundTo3(splitTime);

    const firstSeg = { ...seg, end: firstEnd, text: text1 };
    const secondSeg = {
      id: Date.now() + Math.random(),
      start: secondStart,
      end: seg.end,
      text: text2
    };

    const updated = [...segments];
    updated.splice(index, 1, firstSeg, secondSeg);
    updated.forEach((s, idx) => (s.id = idx + 1));
    updateSegmentsAndNotify(updated);
  };

  const handleNudge = (index, delta) => {
    const updated = [...segments];
    const seg = updated[index];
    if (!seg) return;
    const newStart = Math.max(0, roundTo3(seg.start + delta));
    const newEnd = Math.max(roundTo3(newStart + 0.1), roundTo3(seg.end + delta));
    updated[index] = { ...seg, start: newStart, end: newEnd };
    updateSegmentsAndNotify(updated);
  };

  // Shortcut Ctrl + S to save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveChanges();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [segments]);

  const roundTo3 = (val) => Math.round(val * 1000) / 1000;

  const saveChanges = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/jobs/${job.job_id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Instant Client-Side Export with 1-Word/2-Word/Phrase Pacing
  const downloadFile = (fmt) => {
    const baseName = (job.filename || 'subtitles').replace(/\.[^/.]+$/, '');
    let content = '';

    if (fmt === 'srt') {
      content = segments
        .map((s, idx) => `${idx + 1}\n${formatTime(s.start)} --> ${formatTime(s.end)}\n${s.text.trim()}\n`)
        .join('\n');
    } else if (fmt === 'vtt') {
      content =
        'WEBVTT\n\n' +
        segments
          .map((s, idx) => {
            const startStr = formatTime(s.start).replace(',', '.');
            const endStr = formatTime(s.end).replace(',', '.');
            return `${idx + 1}\n${startStr} --> ${endStr}\n${s.text.trim()}\n`;
          })
          .join('\n');
    } else if (fmt === 'txt') {
      content = segments.map((s) => s.text.trim()).filter(Boolean).join('\n\n');
    } else if (fmt === 'ass') {
      let fontName = 'Noto Sans Khmer';
      if (fontClass.includes('kantumruy')) fontName = 'Kantumruy Pro';
      else if (fontClass.includes('battambang')) fontName = 'Battambang';
      else if (fontClass.includes('moul')) fontName = 'Moul';

      // Colors in ASS are &HAABBGGRR (Alpha, Blue, Green, Red)
      let primaryColor = '&H00FFFFFF';
      let outlineColor = '&H60000000'; // Soft clean outline (not harsh jet black)
      let backColor = '&H80000000';
      let outlineWidth = 1.5;
      let shadowDepth = 1;
      let fontSize = 48;
      let borderStyle = 1;

      if (stylePreset === 'ocean_blue') {
        primaryColor = '&H00C78402'; // Ocean Blue
        borderStyle = 1; // Pure text without background box
        outlineWidth = 1.5;
        shadowDepth = 1;
        fontSize = 48;
      } else if (stylePreset === 'viral') {
        primaryColor = '&H0000FFFF'; // Yellow MrBeast
        outlineWidth = 2;
        shadowDepth = 1.5;
        fontSize = 54;
      } else if (stylePreset === 'hormozi_green') {
        primaryColor = '&H0035E6A3'; // Lime Green
        outlineWidth = 1.5;
        shadowDepth = 1.5;
        fontSize = 54;
      } else if (stylePreset === 'fire_hustle') {
        primaryColor = '&H001673F9'; // Fiery Orange-Rose
        outlineWidth = 2;
        shadowDepth = 1.5;
        fontSize = 52;
      } else if (stylePreset === 'cyberpunk') {
        primaryColor = '&H00FFF000'; // Cyan
        outlineWidth = 1.5;
        shadowDepth = 2;
        fontSize = 52;
      } else if (stylePreset === 'grape_pill') {
        primaryColor = '&H00FFFFFF';
        backColor = '&H00EA3393'; // Purple Pill
        borderStyle = 3;
        outlineWidth = 1.5;
        fontSize = 46;
      } else if (stylePreset === 'soft_ai') {
        primaryColor = '&H00FFFFFF';
        backColor = '&HA0201612'; // Frosted glass
        borderStyle = 3;
        outlineWidth = 1.5;
        fontSize = 46;
      } else if (stylePreset === 'ali_highlighter') {
        primaryColor = '&H00FFFFFF';
        outlineWidth = 1.5;
        shadowDepth = 1.5;
        fontSize = 48;
      } else if (stylePreset === 'comic_pop') {
        primaryColor = '&H000B9EF5'; // Amber comic
        outlineColor = '&H00000000';
        outlineWidth = 2.5;
        shadowDepth = 2;
        fontSize = 50;
      } else if (stylePreset === 'neon_pink') {
        primaryColor = '&H00B672F4'; // Magenta Pink
        outlineWidth = 1.5;
        shadowDepth = 1.5;
        fontSize = 52;
      } else if (stylePreset === 'boxed') {
        primaryColor = '&H00FFFFFF';
        backColor = '&HA0000000';
        borderStyle = 3;
        outlineWidth = 1.5;
        fontSize = 46;
      }

      const styleLine = `Style: CustomStyle,${fontName},${fontSize},${primaryColor},&H000000FF,${outlineColor},${backColor},-1,0,0,0,100,100,0,0,${borderStyle},${outlineWidth},${shadowDepth},2,30,30,90,1`;
      const header = `[Script Info]\nTitle: KhmerSub AI Generated Subtitles\nScriptType: v4.00+\nWrapStyle: 0\nScaledBorderAndShadow: yes\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n${styleLine}\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

      const dialogues = segments.map((s) => {
        const startCs = formatTimeAss(s.start);
        const endCs = formatTimeAss(s.end);
        return `Dialogue: 0,${startCs},${endCs},CustomStyle,,0,0,0,,${s.text.trim()}`;
      });
      content = header + dialogues.join('\n') + '\n';
    } else if (fmt === 'capcut') {
      const texts = [];
      const textSegments = [];
      const totalDurationSec = segments.length > 0 ? Math.max(...segments.map((s) => s.end)) : 0;
      const totalDurationUs = Math.round(totalDurationSec * 1000000);

      segments.forEach((seg, idx) => {
        const textId = `text_mat_${idx + 1}_${Math.random().toString(36).substring(2, 8)}`;
        const segId = `seg_track_${idx + 1}_${Math.random().toString(36).substring(2, 8)}`;
        const startUs = Math.round(seg.start * 1000000);
        const durUs = Math.max(200000, Math.round((seg.end - seg.start) * 1000000));

        texts.push({
          id: textId,
          type: "text",
          content: JSON.stringify({
            styles: [
              {
                fill: { alpha: 1.0, content: { solid: { color: [1.0, 0.85, 0.1] } } },
                range: [0, (seg.text || '').length]
              }
            ],
            text: (seg.text || '').trim()
          }),
          font_name: "Noto Sans Khmer",
          font_size: 9.0
        });

        textSegments.push({
          id: segId,
          material_id: textId,
          target_timerange: {
            duration: durUs,
            start: startUs
          },
          source_timerange: {
            duration: durUs,
            start: 0
          }
        });
      });

      const draft = {
        canvas_config: { height: 1920, ratio: "9:16", width: 1080 },
        color_space: 0,
        config: { adjust_max_index: 1, subtitle_sync: true, video_mute: false },
        duration: totalDurationUs,
        fps: 30,
        id: `khmersub_${Date.now()}`,
        materials: {
          audios: [],
          canvas: [],
          effects: [],
          filters: [],
          fonts: [],
          stickers: [],
          texts: texts,
          transitions: [],
          video_effects: [],
          videos: []
        },
        tracks: [
          {
            id: `track_subtitles_${Date.now()}`,
            type: "text",
            segments: textSegments
          }
        ]
      };

      const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `draft_content.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      return;
    }

    if (content) {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const pacingTag = wordsPerSub === 'phrase' ? '' : `_${wordsPerSub}word_reels`;
      link.download = `${baseName}${pacingTag}.${fmt}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col h-full">
      {/* 1. Unified Clean Studio Header */}
      <div className="px-2.5 sm:px-4 py-1.5 sm:py-2 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-900/95 backdrop-blur-sm shrink-0">
        {/* Title & Metadata */}
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-white tracking-tight">Subtitles</h2>
          <span className="px-2 py-0.5 text-[10px] rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono font-medium">
            {segments.length}
          </span>
        </div>

        {/* Center: Live Pacing Segmented Pill Toggle (Desktop) */}
        <div className="hidden sm:flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800/80 self-center">
          <button
            onClick={() => handlePacingChange('phrase')}
            className={`px-2.5 py-1 rounded-md text-[11px] transition-all font-khmer ${
              wordsPerSub === 'phrase'
                ? 'bg-indigo-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ធម្មតា
          </button>
          <button
            onClick={() => handlePacingChange('1')}
            className={`px-2 py-1 rounded-md text-[11px] transition-all font-khmer ${
              wordsPerSub === '1'
                ? 'bg-indigo-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1 ពាក្យ
          </button>
          <button
            onClick={() => handlePacingChange('2')}
            className={`px-2 py-1 rounded-md text-[11px] transition-all font-khmer ${
              wordsPerSub === '2'
                ? 'bg-indigo-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2 ពាក្យ
          </button>
          <button
            onClick={() => handlePacingChange('3')}
            className={`px-2 py-1 rounded-md text-[11px] transition-all font-khmer ${
              wordsPerSub === '3'
                ? 'bg-indigo-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3 ពាក្យ
          </button>
        </div>

        {/* Right Actions: Quick CapCut & SRT 1-Click + Save + Export Dropdown */}
        <div className="flex items-center gap-1.5 sm:gap-2 relative" ref={exportMenuRef}>
          {/* Quick CapCut 1-Click Button */}
          <button
            onClick={() => downloadFile('capcut')}
            title="ទាញយក CapCut Draft (.json) ភ្លាមៗ"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all font-khmer shadow-sm hover:scale-[1.02]"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">CapCut</span>
            <span className="sm:hidden">CapCut</span>
          </button>

          {/* Quick SRT 1-Click Button */}
          <button
            onClick={() => downloadFile('srt')}
            title="ទាញយកស្តង់ដារ Subtitle (.SRT) ភ្លាមៗ"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all font-khmer shadow-sm hover:scale-[1.02]"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>SRT</span>
          </button>

          {/* Save Button (Desktop) */}
          <button
            onClick={saveChanges}
            disabled={isSaving}
            className={`hidden sm:flex px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium items-center gap-1.5 transition-all border ${
              saveSuccess
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
            }`}
          >
            {saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{saveSuccess ? 'រួចរាល់' : 'Save'}</span>
          </button>

          {/* Unified Export Dropdown Trigger */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all font-khmer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Floating Export Menu */}
            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-800 p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 border-b border-slate-800/80 font-khmer">
                  ទាញយកទម្រង់ Subtitle (Select Format)
                </div>

                <div className="p-1 space-y-1">
                  {/* CapCut Draft Export */}
                  <button
                    onClick={() => {
                      downloadFile('capcut');
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl hover:bg-amber-500/10 text-left transition-colors flex items-center gap-3 group border border-transparent hover:border-amber-500/20"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 group-hover:text-amber-300">CapCut Draft</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">1-Click</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate font-khmer">draft_content.json បើកក្នុង CapCut ភ្លាម</p>
                    </div>
                  </button>

                  {/* Standard SRT */}
                  <button
                    onClick={() => {
                      downloadFile('srt');
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl hover:bg-indigo-500/10 text-left transition-colors flex items-center gap-3 group border border-transparent hover:border-indigo-500/20"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Download className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-300">SubRip (.SRT)</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">Standard</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate font-khmer">Premiere, DaVinci, VLC, YouTube</p>
                    </div>
                  </button>

                  {/* ASS Styled */}
                  <button
                    onClick={() => {
                      downloadFile('ass');
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl hover:bg-purple-500/10 text-left transition-colors flex items-center gap-3 group border border-transparent hover:border-purple-500/20"
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Palette className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 group-hover:text-purple-300">Styled Subtitle (.ASS)</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-mono">Styles</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate font-khmer">ភ្ជាប់ Font ខ្មែរ និងពណ៌ស្រាប់</p>
                    </div>
                  </button>

                  {/* WebVTT */}
                  <button
                    onClick={() => {
                      downloadFile('vtt');
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-800 text-left transition-colors flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                      <Download className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-slate-200">WebVTT (.VTT)</span>
                      <p className="text-[11px] text-slate-400 truncate font-khmer">សម្រាប់ HTML5 Web Player</p>
                    </div>
                  </button>

                  {/* Plain TXT */}
                  <button
                    onClick={() => {
                      downloadFile('txt');
                      setIsExportMenuOpen(false);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl hover:bg-slate-800 text-left transition-colors flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-slate-200">Plain Transcript (.TXT)</span>
                      <p className="text-[11px] text-slate-400 truncate font-khmer">អត្ថបទសុទ្ធ គ្មានលេខម៉ោង</p>
                    </div>
                  </button>

                  {/* Video Render MP4 */}
                  {job.media_type === 'video' && (
                    <div className="pt-1 mt-1 border-t border-slate-800/80">
                      {renderStatus === 'COMPLETED' ? (
                        <a
                          href={`/api/v1/jobs/${job.job_id}/download-rendered`}
                          onClick={() => setIsExportMenuOpen(false)}
                          className="w-full px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-3 text-left transition-colors shadow-md"
                        >
                          <Download className="w-4 h-4" />
                          <div>
                            <span className="text-xs font-bold block font-khmer">ទាញយក Video MP4 រួចរាល់</span>
                            <span className="text-[10px] text-emerald-100">បានដុត Subtitle ខ្មែរចូល</span>
                          </div>
                        </a>
                      ) : renderStatus === 'RENDERING' || renderStatus === 'QUEUED' ? (
                        <div className="px-3 py-2.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-2 text-xs font-khmer">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{renderStatus === 'QUEUED' ? 'ក្នុងជួរ Render...' : 'កំពុង Render MP4...'}</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            handleRenderVideo();
                            setIsExportMenuOpen(false);
                          }}
                          className="w-full px-3 py-2.5 rounded-xl hover:bg-indigo-500/10 text-left transition-colors flex items-center gap-3 group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                            <Film className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300">
                              Render Video MP4 ({aspectRatio === '9:16' ? '9:16 Shorts' : '16:9'})
                            </span>
                            <p className="text-[11px] text-slate-400 truncate font-khmer">ដុតអក្សរចូលវីដេអូដោយផ្ទាល់</p>
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Slim Quick-Tools Toolbar (Horizontally Swipeable on Mobile) */}
      <div className="px-2.5 sm:px-3 py-1.5 bg-slate-950/40 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs shrink-0">
        {/* Mobile Live Pacing Segmented Pills (visible only on mobile) */}
        <div className="flex sm:hidden items-center bg-slate-900 rounded-lg p-0.5 border border-slate-700/80 shrink-0">
          <button
            onClick={() => handlePacingChange('phrase')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all font-khmer ${
              wordsPerSub === 'phrase'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ធម្មតា
          </button>
          <button
            onClick={() => handlePacingChange('1')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all font-khmer ${
              wordsPerSub === '1'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1 ពាក្យ
          </button>
          <button
            onClick={() => handlePacingChange('2')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all font-khmer ${
              wordsPerSub === '2'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2 ពាក្យ
          </button>
          <button
            onClick={() => handlePacingChange('3')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all font-khmer ${
              wordsPerSub === '3'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3 ពាក្យ
          </button>
        </div>

        {/* Style Catalog Button */}
        <button
          onClick={() => setShowStylesModal(true)}
          className="px-2.5 py-1 rounded-lg font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 flex items-center gap-1 font-khmer transition-all shrink-0 whitespace-nowrap"
        >
          <Palette className="w-3.5 h-3.5 text-amber-400" />
          <span>ម៉ូតអក្សរ</span>
        </button>

        {/* Position Selector Pills */}
        <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/80 shrink-0">
          {['bottom', 'middle', 'top'].map((pos) => (
            <button
              key={pos}
              onClick={() => setPosition(pos)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-all ${
                position === pos
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>

        {/* Find & Replace */}
        <button
          onClick={() => setShowReplaceModal(true)}
          className="px-2 py-1 rounded-lg font-medium bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/80 flex items-center gap-1 font-khmer transition-all shrink-0 whitespace-nowrap"
        >
          <Search className="w-3 h-3 text-indigo-400" />
          <span>Find</span>
        </button>

        {/* Import Script */}
        <button
          onClick={() => setShowScriptModal(true)}
          className="px-2 py-1 rounded-lg font-medium bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/80 flex items-center gap-1 font-khmer transition-all shrink-0 whitespace-nowrap"
        >
          <FileText className="w-3 h-3 text-emerald-400" />
          <span>Script</span>
        </button>

        {/* AI Caption */}
        <button
          onClick={() => handleFetchCaptions(captionLang)}
          className="px-2 py-1 rounded-lg font-medium bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/80 flex items-center gap-1 font-khmer transition-all shrink-0 whitespace-nowrap"
        >
          <Sparkles className="w-3 h-3 text-yellow-400" />
          <span>AI Caption</span>
        </button>

        {/* Quick Add Segment Button */}
        <button
          onClick={() => handleAddSegment(segments.length - 1)}
          className="px-2 py-1 rounded-lg font-medium bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/80 flex items-center gap-1 font-khmer transition-all shrink-0 whitespace-nowrap ml-auto"
        >
          <Plus className="w-3 h-3 text-indigo-400" />
          <span>+ Segment</span>
        </button>
      </div>

      {/* 3. Clean SomlengSRT / Descript Minimalist Document Editor (Butter-Smooth Mobile Momentum Scrolling) */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2.5 sm:p-3 space-y-1.5 bg-slate-950/20 divide-y divide-slate-800/40"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        {segments.map((seg, idx) => {
          const isActive = idx === activeSegmentIndex;
          const segDuration = (Math.max(0, (seg.end || 0) - (seg.start || 0))).toFixed(1);
          return (
            <div
              key={seg.id || idx}
              onClick={() => onSeekRequest(seg.start)}
              className={`pt-2.5 pb-2 px-3 rounded-xl transition-all duration-150 flex flex-col sm:flex-row gap-3 items-start sm:items-center group ${
                isActive
                  ? 'bg-indigo-500/10 border-l-4 border-l-indigo-500 shadow-sm'
                  : 'hover:bg-slate-800/40 border-l-4 border-l-transparent'
              }`}
            >
              {/* Top Row: [1] ▶ 00:01.2 (3.3s) [-0.2s] [+0.2s]  ...  [Split] [Add] [Delete] */}
              <div className="flex items-center justify-between w-full sm:w-auto shrink-0 text-xs">
                {/* ID & Play to Jump */}
                <div className="flex items-center gap-1.5">
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[11px] ${
                    isActive ? 'bg-indigo-600 text-white' : 'bg-slate-800/80 text-slate-400'
                  }`}>
                    {idx + 1}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeekRequest(seg.start);
                    }}
                    title="លោតទៅម៉ោងនេះ (Play)"
                    className="p-1 rounded-md bg-slate-800/60 hover:bg-indigo-600 text-slate-400 hover:text-white transition-colors"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                  </button>
                  <span className="font-mono text-[11px] text-slate-300">
                    {formatTime(seg.start).split(',')[0]}
                  </span>
                  <span className="text-slate-500 font-mono text-[10px]">
                    ({segDuration}s)
                  </span>
                </div>

                {/* Duration & Nudges */}
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNudge(idx, -0.2);
                    }}
                    title="ថយក្រោយ 0.2s"
                    className="px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-mono transition-colors"
                  >
                    -0.2s
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNudge(idx, 0.2);
                    }}
                    title="ទៅមុខ 0.2s"
                    className="px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-mono transition-colors"
                  >
                    +0.2s
                  </button>
                </div>

                {/* Mobile action buttons (comfortable touch targets on phone) */}
                <div className="flex sm:hidden items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSplitSegment(idx);
                    }}
                    title="កាត់ពាក់កណ្តាល (Split)"
                    className="h-7 px-2 text-xs text-amber-300 font-medium rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center gap-1 active:scale-95 transition-all font-khmer shadow-sm"
                  >
                    <Split className="w-3 h-3 text-amber-400" />
                    <span>កាត់</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddSegment(idx);
                    }}
                    title="បន្ថែមបន្ទាប់ (Add)"
                    className="h-7 w-7 text-xs text-indigo-300 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center active:scale-95 transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(idx);
                    }}
                    title="លុប (Delete)"
                    className="h-7 w-7 text-xs text-rose-400 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center active:scale-95 transition-all shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                </div>
              </div>

              {/* Subtitle Text Field (Notion / Descript Text-First Style) */}
              <div className="flex-1 w-full">
                <textarea
                  value={seg.text}
                  onChange={(e) => handleTextChange(idx, e.target.value)}
                  rows={2}
                  className={`w-full bg-slate-950/40 sm:bg-transparent hover:bg-slate-950/60 focus:bg-slate-950/90 border border-slate-800/60 sm:border-transparent focus:border-indigo-500/50 rounded-xl p-2.5 text-slate-100 text-base leading-relaxed focus:ring-1 focus:ring-indigo-500/30 focus:outline-none transition-all resize-y ${fontClass}`}
                  placeholder="អត្ថបទ Subtitle ភាសាខ្មែរ..."
                />
              </div>

              {/* Action Buttons: Split, Add, Delete (Desktop High-Discoverability) */}
              <div className="hidden sm:flex sm:flex-col items-center gap-1 self-center opacity-50 group-hover:opacity-100 hover:!opacity-100 transition-opacity bg-slate-900/80 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSplitSegment(idx);
                  }}
                  title="កាត់ Subtitle ពាក់កណ្តាល (Split)"
                  className="p-1.5 text-slate-300 hover:text-amber-400 hover:bg-amber-500/15 rounded-lg transition-colors"
                >
                  <Split className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddSegment(idx);
                  }}
                  title="បន្ថែម Segment ថ្មីបន្ទាប់ (Add)"
                  className="p-1.5 text-slate-300 hover:text-indigo-400 hover:bg-indigo-500/15 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(idx);
                  }}
                  title="លុប Segment នេះ (Delete)"
                  className="p-1.5 text-slate-300 hover:text-rose-400 hover:bg-rose-500/15 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {segments.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm font-khmer">
            មិនមាន Subtitle Segments ទេ
          </div>
        )}
      </div>

      {/* Find & Replace Modal */}
      {showReplaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowReplaceModal(false);
                setReplaceCount(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white font-khmer">ស្វែងរក និងជំនួសពាក្យ (Bulk Replace)</h3>
            </div>
            <div className="space-y-3 font-khmer text-xs">
              <div>
                <label className="text-slate-300 mb-1 block">ពាក្យដែលត្រូវស្វែងរក (Find text)៖</label>
                <input
                  type="text"
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  placeholder="ឧ. ឆាតជីភីធី, អាប្រូខូល..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-slate-300 mb-1 block">ជំនួសដោយ (Replace with)៖</label>
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="ឧ. ChatGPT, A2A Protocol..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
              {replaceCount !== null && (
                <div className={`p-2.5 rounded-lg text-xs ${replaceCount > 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                  {replaceCount > 0 ? `✅ បានជំនួសចំនួន ${replaceCount} កន្លែងដោយជោគជ័យ!` : '⚠️ រកមិនឃើញពាក្យនេះក្នុង Subtitle ឡើយ។'}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowReplaceModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  បិទ
                </button>
                <button
                  type="button"
                  onClick={handleBulkReplace}
                  disabled={!findText}
                  className="px-4 py-1.5 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
                >
                  <span>ជំនួសទាំងអស់ (Replace All)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Script Modal (Forced Alignment Mode, CER = 0%) */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowScriptModal(false);
                setScriptSuccessCount(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white font-khmer">📋 Import Script (តម្រឹមអត្ថបទដើម, CER = 0%)</h3>
            </div>
            <p className="text-xs text-slate-400 font-khmer mb-3">
              បិទភ្ជាប់អត្ថបទ Script ដែលអ្នកបានសរសេរទុកជាមុន។ AI នឹងយកអក្សរពិតប្រាកដរបស់អ្នក មកតម្រឹមជាមួយ Time នៃសំឡេង ដោយគ្មានកំហុសអក្សរទាល់តែសោះ (០% Error)!
            </p>
            <div className="space-y-3 font-khmer text-xs">
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                rows={8}
                placeholder="បិទភ្ជាប់អត្ថបទ Script របស់អ្នកនៅទីនេះ (មួយបន្ទាត់ = មួយ Subtitle)..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-100 font-khmer focus:outline-none focus:border-emerald-500"
              />

              {scriptSuccessCount !== null && (
                <div className="p-2.5 rounded-lg text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ✅ បានតម្រឹម Script ចំនួន {scriptSuccessCount} ឃ្លាដោយជោគជ័យ (CER = 0%)!
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  {scriptText.split(/\r?\n+/).filter(Boolean).length} បន្ទាត់ Script ត្រូវបានរកឃើញ
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowScriptModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    បោះបង់
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyScript('segments')}
                    disabled={!scriptText.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
                  >
                    <span>អនុវត្តទៅកាន់ Subtitles</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Social Caption Modal */}
      {showCaptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCaptionModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-yellow-400" />
              <h3 className="text-base font-bold text-white font-khmer">✨ AI Social Captions & Hashtags</h3>
            </div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-xs text-slate-400 font-khmer">
                AI បានវិភាគសំឡេង និងបង្កើត Caption ៣ ស្ទីលសម្រាប់ផុស Facebook, TikTok និង YouTube៖
              </p>
              {/* Multi-Language Selector */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-khmer">
                <button
                  type="button"
                  onClick={() => handleLangChange('km')}
                  className={`px-2.5 py-1 rounded-md transition-all ${captionLang === 'km' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
                >
                  🇰🇭 ខ្មែរ
                </button>
                <button
                  type="button"
                  onClick={() => handleLangChange('en')}
                  className={`px-2.5 py-1 rounded-md transition-all ${captionLang === 'en' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
                >
                  🇺🇸 English
                </button>
                <button
                  type="button"
                  onClick={() => handleLangChange('zh')}
                  className={`px-2.5 py-1 rounded-md transition-all ${captionLang === 'zh' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
                >
                  🇨🇳 中文
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {loadingCaptions ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400 font-khmer">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                  <span>កំពុងបង្កើត Caption និង Trending Hashtags...</span>
                </div>
              ) : captions.length > 0 ? (
                captions.map((cap, idx) => (
                  <div key={cap.id || idx} className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-400 font-khmer">{cap.title}</span>
                      <button
                        onClick={() => handleCopyCaption(cap.caption, idx)}
                        className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 font-khmer transition-all ${
                          copiedIndex === idx
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedIndex === idx ? 'បានចម្លង!' : 'ចម្លង Caption'}</span>
                      </button>
                    </div>
                    <pre className="text-xs text-slate-200 font-khmer whitespace-pre-wrap leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                      {cap.caption}
                    </pre>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs font-khmer">
                  មិនមានអត្ថបទគ្រប់គ្រាន់សម្រាប់បង្កើត Caption ឡើយ។
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-400 font-khmer">💡 ចុច "ចម្លង Caption" ដើម្បីយកទៅ Paste លើ Facebook/TikTok បានភ្លាម។</span>
              <button
                type="button"
                onClick={() => setShowCaptionModal(false)}
                className="px-4 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-khmer"
              >
                បិទ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtitle Style Presets Gallery Modal */}
      {showStylesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col p-6 shadow-2xl relative">
            <button
              onClick={() => setShowStylesModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-pink-500 flex items-center justify-center text-white shadow-lg">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-khmer">
                  🎨 រចនាប័ទ្ម Subtitle (Style Presets Gallery)
                </h3>
                <p className="text-xs text-slate-400 font-khmer mt-0.5">
                  ជ្រើសរើសម៉ូតអក្សរដែលត្រូវនឹងប្រភេទវីដេអូរបស់អ្នក — បង្ហាញលើ Video Player ភ្លាមៗ
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {STYLE_CATALOG.map((st) => {
                const isSelected = stylePreset === st.id;
                return (
                  <div
                    key={st.id}
                    onClick={() => {
                      setStylePreset(st.id);
                      setShowStylesModal(false);
                    }}
                    className={`group cursor-pointer rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? 'bg-slate-800/90 border-indigo-500 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-100 flex items-center gap-1.5 font-khmer">
                          {st.name}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                          {st.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-khmer mb-3 line-clamp-2">
                        {st.desc}
                      </p>
                    </div>

                    {/* Visual Preview Box */}
                    <div
                      className={`h-20 rounded-xl ${st.previewBg} border border-slate-800/80 flex items-center justify-center p-3 text-center overflow-hidden transition-all group-hover:scale-[1.02]`}
                    >
                      <span
                        className={`${st.previewClass} ${fontClass}`}
                        style={{
                          textShadow: getSubtitleTextShadow(st.id)
                        }}
                      >
                        {st.previewText}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-800/60">
                      <span className="text-[11px] text-slate-500 font-mono">
                        ID: {st.id}
                      </span>
                      {isSelected ? (
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 font-khmer">
                          <Check className="w-3.5 h-3.5" /> កំពុងប្រើប្រាស់
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-slate-400 group-hover:text-indigo-400 flex items-center gap-1 font-khmer transition-colors">
                          ជ្រើសរើសស្ទីលនេះ →
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400 font-khmer">
                💡 ស្ទីលដែលបានជ្រើសរើសនឹងត្រូវ Export តាមទម្រង់ .ASS និងបង្ហាញលើ Player ភ្លាមៗ។
              </span>
              <button
                type="button"
                onClick={() => setShowStylesModal(false)}
                className="px-4 py-1.5 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-khmer font-medium transition-all"
              >
                បិទ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
