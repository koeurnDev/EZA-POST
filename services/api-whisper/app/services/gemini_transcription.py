import io
import json
import logging
import mimetypes
import os
import re
import time
from pathlib import Path
from typing import List, Tuple
import soundfile as sf
import numpy as np

from ..schemas.jobs import SubtitleSegmentItem, WordItem
from .khmer_normalizer import normalize_khmer_text, merge_short_subtitle_segments, split_long_subtitle_segments

logger = logging.getLogger(__name__)

GEMINI_PROMPT = """You are the premier AI for Khmer Speech-to-Text and professional subtitling (SomlengSRT quality).
Transcribe the spoken audio into authentic Khmer script with exact time synchronization and word-level accuracy.

Format your output STRICTLY as a valid JSON array of objects without markdown formatting:
[
  {
    "start": 0.0,
    "end": 2.5,
    "text": "សួស្ដីបងប្អូនទាំងអស់គ្នា",
    "words": [
      { "start": 0.0, "end": 1.0, "word": "សួស្ដី" },
      { "start": 1.0, "end": 2.5, "word": "បងប្អូនទាំងអស់គ្នា" }
    ]
  }
]

Strict Rules:
1. Target natural subtitle duration (1.5s to 4.5s per segment, never exceeding 5 seconds).
2. Segment boundaries must match natural speech pauses, breath pauses, and clause endings.
3. For each segment, output the "words" array with accurate word-level start and end timestamps.
4. Retain technical English terms and loanwords properly (e.g. Claude, AI, Gemini, ChatGPT, Browser, Access, GitHub, Repo, Task, Protocol, Software, IT, Email, Network, Server, Database, Application).
5. Output authentic Khmer grammar and orthography without broken characters.
6. Return ONLY the JSON array. Do not include markdown codeblocks or extra explanations.
"""

def extract_mono_wav_bytes(file_path: Path, target_sr: int = 16000) -> Tuple[bytes, float]:
    """
    Decodes any audio or video container (MP4, MKV, MOV, WebM, MP3, WAV, AAC, M4A)
    into a mono 16kHz PCM WAV byte stream for instant inline Gemini ingestion.
    """
    from .transcription import load_audio_resampled
    audio_np, sr = load_audio_resampled(file_path, target_sr=target_sr)
    total_duration = float(len(audio_np) / sr)

    bio = io.BytesIO()
    sf.write(bio, audio_np, sr, format='WAV', subtype='PCM_16')
    wav_bytes = bio.getvalue()
    return wav_bytes, total_duration

def transcribe_with_gemini(
    audio_path: Path,
    gemini_key: str = None
) -> Tuple[List[SubtitleSegmentItem], float]:
    """
    Ultra-Fast, High-Precision Khmer Speech-to-Text using Google Gemini 2.5 Flash.
    Optimized for 0-latency inline ingestion (bypassing File API state lag).
    """
    api_key = gemini_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured.")

    try:
        import google.generativeai as genai
    except ImportError:
        raise RuntimeError("google-generativeai is not installed.")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        generation_config={
            "temperature": 0.1,
            "response_mime_type": "application/json"
        }
    )

    # 1. Fast local audio decode to mono 16kHz WAV
    logger.info(f"Extracting 16kHz mono audio stream from {audio_path.name}...")
    wav_bytes, total_duration = extract_mono_wav_bytes(audio_path, target_sr=16000)
    wav_size_mb = len(wav_bytes) / (1024 * 1024)
    logger.info(f"Audio decoded: {total_duration:.2f}s | Size: {wav_size_mb:.2f} MB")

    # 2. Fast-Path: Inline data for all audio under 20MB (~10.5 minutes of 16kHz audio)
    # Inline payload has 0ms server transcoding wait and NEVER fails with 'File not ACTIVE'
    uploaded_file = None
    try:
        if len(wav_bytes) <= 20 * 1024 * 1024:
            logger.info("Engaging Gemini 2.5 Flash Inline ASR (0ms File API lag)...")
            response = model.generate_content([
                GEMINI_PROMPT,
                {"mime_type": "audio/wav", "data": wav_bytes}
            ])
        else:
            # For massive podcasts (> 11 mins), upload WAV to Files API with state-polling safeguard
            logger.info(f"Uploading large audio ({wav_size_mb:.2f}MB) to Gemini File API...")
            temp_wav = Path(audio_path.parent) / f"temp_{audio_path.stem}.wav"
            temp_wav.write_bytes(wav_bytes)
            uploaded_file = genai.upload_file(path=str(temp_wav), mime_type="audio/wav")
            try:
                temp_wav.unlink(missing_ok=True)
            except Exception:
                pass

            # Poll until file is ACTIVE (safe against async processing)
            poll_start = time.time()
            while uploaded_file.state.name == "PROCESSING":
                if time.time() - poll_start > 60:
                    raise TimeoutError("Gemini File API processing timed out.")
                time.sleep(1)
                uploaded_file = genai.get_file(uploaded_file.name)

            if uploaded_file.state.name != "ACTIVE":
                raise ValueError(f"Gemini File API failed with state: {uploaded_file.state.name}")

            logger.info(f"Gemini processing large audio file: {uploaded_file.name}...")
            response = model.generate_content([
                GEMINI_PROMPT,
                uploaded_file
            ])

        raw_text = response.text.strip()
        # Clean any accidental markdown fence
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)

        data = json.loads(raw_text)
        if not isinstance(data, list):
            if isinstance(data, dict) and "subtitles" in data:
                data = data["subtitles"]
            elif isinstance(data, dict) and "segments" in data:
                data = data["segments"]
            else:
                raise ValueError("Unexpected JSON response structure from Gemini")

        raw_segments: List[SubtitleSegmentItem] = []
        max_end = 0.0

        for idx, item in enumerate(data, start=1):
            st = float(item.get("start", 0.0))
            en = float(item.get("end", st + 2.0))
            txt = str(item.get("text", "")).strip()
            clean_txt = normalize_khmer_text(txt, add_syllable_breaks=False)

            raw_words = item.get("words", [])
            parsed_words: List[WordItem] = []
            if isinstance(raw_words, list):
                for w in raw_words:
                    if isinstance(w, dict) and "word" in w:
                        w_text = normalize_khmer_text(str(w["word"]).strip(), add_syllable_breaks=False)
                        if w_text:
                            w_st = float(w.get("start", st))
                            w_en = float(w.get("end", en))
                            parsed_words.append(WordItem(word=w_text, start=round(w_st, 2), end=round(w_en, 2)))

            if clean_txt and en > st:
                max_end = max(max_end, en)
                raw_segments.append(
                    SubtitleSegmentItem(
                        id=idx,
                        start=round(st, 2),
                        end=round(en, 2),
                        text=clean_txt,
                        words=parsed_words
                    )
                )

        if raw_segments:
            merged = merge_short_subtitle_segments(raw_segments, min_duration=1.2, max_duration=4.5)
            final_split = split_long_subtitle_segments(merged, max_duration=4.5)
            logger.info(f"Gemini successfully generated {len(final_split)} subtitle segments in record time.")
            return final_split, round(max_end, 2) if max_end > 0 else round(total_duration, 2)
        else:
            return [], round(total_duration, 2)

    finally:
        if uploaded_file:
            try:
                uploaded_file.delete()
            except Exception:
                pass

