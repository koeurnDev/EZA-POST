import logging
import os
import tempfile
from pathlib import Path
from typing import List, Tuple
import numpy as np
import soundfile as sf

from ..schemas.jobs import SubtitleSegmentItem
from .khmer_normalizer import normalize_khmer_text, merge_short_subtitle_segments, split_long_subtitle_segments

logger = logging.getLogger(__name__)

# Global model cache to avoid re-allocating model in memory on every request
_MODEL_CACHE = {}

KHMER_FINE_TUNED_MODEL = "PhanithLIM/whisper-small-khmer-ct2"
LOCAL_LARGE_MODEL_PATH = Path(__file__).resolve().parent.parent.parent / "models" / "whisper-large-v3-khmer-ct2"

def get_preferred_khmer_model() -> str:
    """
    Checks if local large-v3 Khmer CT2 model is downloaded and complete (>1.4GB);
    otherwise defaults to the battle-tested PhanithLIM/whisper-small-khmer-ct2.
    """
    model_bin = LOCAL_LARGE_MODEL_PATH / "model.bin"
    if LOCAL_LARGE_MODEL_PATH.exists() and model_bin.exists() and model_bin.stat().st_size > 1_400_000_000:
        logger.info(f"Using local high-precision Khmer large-v3 model: {LOCAL_LARGE_MODEL_PATH}")
        return str(LOCAL_LARGE_MODEL_PATH)
    return KHMER_FINE_TUNED_MODEL

def get_whisper_model(model_size: str = "base", device: str = "cpu", compute_type: str = "int8"):
    """
    Loads and caches the Faster-Whisper model with resilient fallback:
    Attempts CUDA if requested, falls back gracefully to CPU int8 if CUDA libraries are missing.
    """
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise RuntimeError("faster-whisper is not installed. Please run: pip install faster-whisper")

    cache_key = f"{model_size}_{device}_{compute_type}"
    if cache_key in _MODEL_CACHE:
        return _MODEL_CACHE[cache_key]

    try:
        logger.info(f"Loading WhisperModel: {model_size} ({device}, {compute_type})...")
        model = WhisperModel(
            model_size_or_path=model_size,
            device=device,
            compute_type=compute_type
        )
    except Exception as e:
        logger.warning(f"Failed to load Whisper on {device} ({e}). Falling back to CPU int8...")
        device = "cpu"
        compute_type = "int8"
        cache_key = f"{model_size}_{device}_{compute_type}"
        if cache_key in _MODEL_CACHE:
            return _MODEL_CACHE[cache_key]
        model = WhisperModel(
            model_size_or_path=model_size,
            device="cpu",
            compute_type="int8"
        )

    _MODEL_CACHE[cache_key] = model
    return model

def load_audio_resampled(file_path: Path, target_sr: int = 16000) -> Tuple[np.ndarray, int]:
    """
    Decodes any audio or video container (MP4, MKV, MOV, WebM, MP3, WAV, AAC, M4A)
    into a mono 16kHz float32 audio array using PyAV or soundfile.
    """
    try:
        import av
        container = av.open(str(file_path))
        audio_streams = [s for s in container.streams if s.type == 'audio']
        if not audio_streams:
            raise ValueError(f"No audio stream found in {file_path}")
        stream = audio_streams[0]
        resampler = av.AudioResampler(format='fltp', layout='mono', rate=target_sr)
        chunks = []
        for frame in container.decode(stream):
            frame.pts = None
            res = resampler.resample(frame)
            if res:
                chunks.append(res[0].to_ndarray())
        if not chunks:
            raise ValueError("No audio frames decoded")
        audio = np.concatenate(chunks, axis=1)[0].astype(np.float32)

        # Audio Pre-processing: DC offset removal & Loudness Normalization
        audio = audio - np.mean(audio)
        peak = np.max(np.abs(audio))
        if peak > 1e-4:
            # Boost quiet recordings up to 0.90 peak (max 4x gain)
            gain = min(0.90 / peak, 4.0)
            audio = audio * gain

        return audio, target_sr
    except Exception as av_err:
        logger.warning(f"PyAV loading failed ({av_err}), falling back to soundfile...")
        data, sr = sf.read(str(file_path))
        if data.ndim > 1:
            data = data.mean(axis=1)
        data = data.astype(np.float32)

        # Audio Pre-processing
        data = data - np.mean(data)
        peak = np.max(np.abs(data))
        if peak > 1e-4:
            gain = min(0.90 / peak, 4.0)
            data = data * gain

        return data, sr

def chunk_audio_by_speech_energy(data: np.ndarray, samplerate: int, min_len: float = 2.0, max_len: float = 4.5):
    """
    Splits audio into speech segments bounded by silence / low energy,
    targeting natural subtitle duration (2.0s to 4.5s).
    """
    if data.ndim > 1:
        data = data.mean(axis=1)
    total_dur = len(data) / samplerate
    window = int(samplerate * 0.05)
    energy = np.array([np.mean(data[i:i+window]**2) for i in range(0, len(data), window)])
    thresh = np.mean(energy) * 0.15

    chunks = []
    st = 0.0
    for i, e in enumerate(energy):
        t = (i * window) / samplerate
        curr_len = t - st
        if curr_len >= min_len:
            if e < thresh or curr_len >= max_len:
                chunks.append((st, t))
                st = t
    if st < total_dur:
        chunks.append((st, total_dur))
    return chunks

def transcribe_audio_khmer(
    audio_path: Path,
    model_size: str = "base",
    language: str = "km",
    vad_filter: bool = False,
    initial_prompt: str = None
) -> Tuple[List[SubtitleSegmentItem], float]:
    """
    Transcribes Khmer audio into clean, word-accurate subtitle segments.
    Uses PhanithLIM/whisper-small-khmer-ct2 for true Khmer script recognition,
    with speech energy chunking and Khmer text normalization.
    """
    data, samplerate = load_audio_resampled(audio_path, target_sr=16000)
    total_duration = len(data) / samplerate

    target_lang = language
    if language in ("auto", None, ""):
        try:
            detector = get_whisper_model(model_size="base")
            detected_lang, prob, _ = detector.detect_language(data)
            logger.info(f"Auto-Detect: Identified language '{detected_lang}' (prob: {prob:.3f})")
            target_lang = detected_lang
        except Exception as det_err:
            logger.warning(f"Language auto-detection failed ({det_err}), defaulting to 'km'")
            target_lang = "km"

    # 0. Primary Engine: Gemini 2.5 Flash (SomlengSRT Hybrid Architecture)
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and (target_lang == "km" or language in ("auto", None, "")):
        try:
            from .gemini_transcription import transcribe_with_gemini
            logger.info("Engaging Gemini 2.5 Flash Audio ASR (SomlengSRT-grade)...")
            g_segs, g_dur = transcribe_with_gemini(audio_path, gemini_key=gemini_key)
            if isinstance(g_segs, list):
                logger.info(f"Gemini 2.5 Flash succeeded with {len(g_segs)} subtitle segments.")
                return g_segs, total_duration if total_duration > 0 else g_dur
        except Exception as gemini_err:
            logger.warning(f"Gemini transcription failed ({gemini_err}), falling back to local Whisper...")

    # 1. Specialized Khmer Model Pipeline (for true Khmer speech)
    if target_lang == "km":
        try:
            active_khmer_model = get_preferred_khmer_model()
            logger.info(f"Using fine-tuned Khmer ASR model: {active_khmer_model}")
            khmer_model = get_whisper_model(model_size=active_khmer_model)

            # Optimized initial prompt to condition Whisper decoder on standard Khmer vocabulary
            khmer_prompt = "សួស្ដីបងប្អូនទាំងអស់គ្នា ថ្ងៃនេះយើងនឹងនិយាយអំពីបច្ចេកវិទ្យា AI, ChatGPT, Claude, Gemini, Software Engineer, A2A Protocol, Task និងគន្លឹះការងារ។"
            if initial_prompt and initial_prompt.strip():
                khmer_prompt = f"{initial_prompt.strip()} {khmer_prompt}".strip()

            # Acoustic VAD speech pre-chunking for razor-sharp subtitle sync (2.0s - 4.5s)
            chunks = chunk_audio_by_speech_energy(data, samplerate, min_len=2.0, max_len=4.5)
            logger.info(f"Acoustic VAD partitioned audio into {len(chunks)} speech bursts.")

            raw_segments: List[SubtitleSegmentItem] = []
            for idx, (st, en) in enumerate(chunks, start=1):
                chunk_data = data[int(st * samplerate) : int(en * samplerate)]
                if len(chunk_data) < samplerate * 0.35:
                    continue
                segs_gen, _ = khmer_model.transcribe(
                    chunk_data,
                    language="km",
                    beam_size=5,
                    best_of=5,
                    initial_prompt=khmer_prompt,
                    condition_on_previous_text=False
                )
                chunk_text = " ".join(s.text.strip() for s in segs_gen).strip()
                clean_text = normalize_khmer_text(chunk_text, add_syllable_breaks=False)
                if clean_text:
                    raw_segments.append(
                        SubtitleSegmentItem(
                            id=len(raw_segments) + 1,
                            start=round(st, 2),
                            end=round(en, 2),
                            text=clean_text
                        )
                    )

            if raw_segments:
                merged = merge_short_subtitle_segments(raw_segments, min_duration=1.2, max_duration=4.5)
                final_split = split_long_subtitle_segments(merged, max_duration=4.5)
                logger.info(f"Khmer fine-tuned ASR generated {len(final_split)} subtitle segments.")
                return final_split, round(total_duration, 2)
            else:
                logger.info(f"No Khmer speech detected in {audio_path.name}.")
                return [], round(total_duration, 2)
        except Exception as e:
            logger.warning(f"Fine-tuned Khmer model failed ({e}), falling back to standard Whisper...")

    # 2. Standard Fallback Whisper Pipeline (English, Chinese, or fallback)
    safe_model = "base" if ("turbo" in str(model_size).lower() or not model_size) else model_size
    model = get_whisper_model(model_size=safe_model)
    prompt_to_use = initial_prompt if initial_prompt else None

    def run_transcribe(use_vad: bool):
        return model.transcribe(
            str(audio_path),
            language=target_lang if target_lang not in ("auto", None, "") else None,
            vad_filter=use_vad,
            vad_parameters=dict(threshold=0.25, min_silence_duration_ms=400, speech_pad_ms=200) if use_vad else None,
            initial_prompt=prompt_to_use,
            beam_size=5,
            best_of=5,
            condition_on_previous_text=False,
            word_timestamps=False
        )

    segments_generator, info = run_transcribe(vad_filter)
    raw_segments_list = list(segments_generator)

    segments: List[SubtitleSegmentItem] = []
    seg_id = 1
    for segment in raw_segments_list:
        clean_text = normalize_khmer_text(segment.text, add_syllable_breaks=False)
        if clean_text:
            segments.append(
                SubtitleSegmentItem(
                    id=seg_id,
                    start=round(segment.start, 3),
                    end=round(segment.end, 3),
                    text=clean_text
                )
            )
            seg_id += 1

    merged_segments = merge_short_subtitle_segments(segments, min_duration=1.2, max_duration=4.5)
    return merged_segments, round(info.duration, 2)
