import re
from typing import List
from ..schemas.jobs import SubtitleSegmentItem

def format_timestamp_srt(seconds: float) -> str:
    """Format seconds into SRT timestamp format: HH:MM:SS,mmm"""
    if seconds < 0:
        seconds = 0
    total_ms = int(round(seconds * 1000))
    ms = total_ms % 1000
    total_seconds = total_ms // 1000
    sec = total_seconds % 60
    total_minutes = total_seconds // 60
    mins = total_minutes % 60
    hours = total_minutes // 60
    return f"{hours:02d}:{mins:02d}:{sec:02d},{ms:03d}"

def format_timestamp_vtt(seconds: float) -> str:
    """Format seconds into WebVTT timestamp format: HH:MM:SS.mmm"""
    if seconds < 0:
        seconds = 0
    total_ms = int(round(seconds * 1000))
    ms = total_ms % 1000
    total_seconds = total_ms // 1000
    sec = total_seconds % 60
    total_minutes = total_seconds // 60
    mins = total_minutes % 60
    hours = total_minutes // 60
    return f"{hours:02d}:{mins:02d}:{sec:02d}.{ms:03d}"

def format_timestamp_ass(seconds: float) -> str:
    """Format seconds into ASS timestamp format: H:MM:SS.cc (centiseconds)"""
    if seconds < 0:
        seconds = 0
    total_cs = int(round(seconds * 100))
    cs = total_cs % 100
    total_seconds = total_cs // 100
    sec = total_seconds % 60
    total_minutes = total_seconds // 60
    mins = total_minutes % 60
    hours = total_minutes // 60
    return f"{hours}:{mins:02d}:{sec:02d}.{cs:02d}"

def split_segments_by_words(
    segments: List[SubtitleSegmentItem],
    words_per_sub: int = 1
) -> List[SubtitleSegmentItem]:
    """
    Pacing Transformer: Splits longer subtitle segments into viral punchy chunks:
    - words_per_sub = 1: Single-word dynamic pop (Viral TikTok/Reels style)
    - words_per_sub = 2 or 3: Fast punchy sub-phrases
    - words_per_sub = 0 or >= 10: Preserves full natural sentence
    """
    if words_per_sub <= 0 or words_per_sub >= 10:
        return segments

    result: List[SubtitleSegmentItem] = []
    seg_counter = 1

    for seg in segments:
        text = seg.text.strip()
        if not text:
            continue

        # Fast-Path: Use AI-extracted word timestamps if available for 100% precision
        if hasattr(seg, "words") and seg.words and len(seg.words) > 0:
            words = seg.words
            for i in range(0, len(words), words_per_sub):
                chunk = words[i : i + words_per_sub]
                chunk_text = " ".join(w.word.strip() for w in chunk).strip()
                chunk_start = chunk[0].start
                chunk_end = chunk[-1].end
                result.append(
                    SubtitleSegmentItem(
                        id=seg_counter,
                        start=round(chunk_start, 2),
                        end=round(chunk_end, 2),
                        text=chunk_text
                    )
                )
                seg_counter += 1
            continue

        # Split on whitespace or zero-width space
        tokens = [t for t in re.split(r"[\s\u200b]+", text) if t]
        if len(tokens) <= words_per_sub:
            result.append(
                SubtitleSegmentItem(
                    id=seg_counter,
                    start=round(seg.start, 3),
                    end=round(seg.end, 3),
                    text=text
                )
            )
            seg_counter += 1
            continue

        # Group tokens by words_per_sub count
        grouped_chunks = []
        for i in range(0, len(tokens), words_per_sub):
            chunk_tokens = tokens[i : i + words_per_sub]
            grouped_chunks.append(" ".join(chunk_tokens))

        # Calculate proportional time allocation based on character lengths
        total_chars = sum(len(c) for c in grouped_chunks)
        duration = max(0.2, seg.end - seg.start)

        current_start = seg.start
        for idx, chunk_text in enumerate(grouped_chunks):
            # Allocate duration proportionally with a minimum of 0.15s per chunk
            ratio = len(chunk_text) / total_chars if total_chars > 0 else (1.0 / len(grouped_chunks))
            chunk_dur = round(duration * ratio, 3)
            chunk_end = round(min(seg.end, current_start + chunk_dur), 3)

            # Ensure last chunk closes exactly on segment end
            if idx == len(grouped_chunks) - 1 or chunk_end > seg.end:
                chunk_end = round(seg.end, 3)

            result.append(
                SubtitleSegmentItem(
                    id=seg_counter,
                    start=round(current_start, 3),
                    end=round(chunk_end, 3),
                    text=chunk_text
                )
            )
            seg_counter += 1
            current_start = chunk_end

    return result

def generate_srt(segments: List[SubtitleSegmentItem], words_per_sub: int = 0) -> str:
    """Generate valid SubRip (.srt) subtitle string with optional word-by-word pacing."""
    active_segments = split_segments_by_words(segments, words_per_sub=words_per_sub)
    blocks = []
    for idx, seg in enumerate(active_segments, start=1):
        start_ts = format_timestamp_srt(seg.start)
        end_ts = format_timestamp_srt(seg.end)
        blocks.append(f"{idx}\n{start_ts} --> {end_ts}\n{seg.text.strip()}\n")
    return "\n".join(blocks)

def generate_vtt(segments: List[SubtitleSegmentItem], words_per_sub: int = 0) -> str:
    """Generate valid WebVTT (.vtt) subtitle string with optional word-by-word pacing."""
    active_segments = split_segments_by_words(segments, words_per_sub=words_per_sub)
    lines = ["WEBVTT\n"]
    for idx, seg in enumerate(active_segments, start=1):
        start_ts = format_timestamp_vtt(seg.start)
        end_ts = format_timestamp_vtt(seg.end)
        lines.append(f"{idx}\n{start_ts} --> {end_ts}\n{seg.text.strip()}\n")
    return "\n".join(lines)

def generate_txt(segments: List[SubtitleSegmentItem]) -> str:
    """Generate plain text transcript without timestamps."""
    return "\n\n".join(seg.text.strip() for seg in segments if seg.text.strip())

def generate_ass(
    segments: List[SubtitleSegmentItem],
    font_name: str = "Kantumruy Pro",
    font_size: int = 48,
    style_preset: str = "default",
    words_per_sub: int = 0
) -> str:
    """
    Generate Advanced SubStation Alpha (.ass) subtitle file with custom styling,
    Khmer fonts, and viral Reels karaoke animations.
    """
    active_segments = split_segments_by_words(segments, words_per_sub=words_per_sub)
    header = f"""[Script Info]
Title: KhmerSub AI Generated Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,30,30,60,1
Style: ReelsViral,{font_name},{font_size + 10},&H0000FFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,2,2,30,30,120,1
Style: Boxed,{font_name},{font_size},&H00FFFFFF,&H000000FF,&H00000000,&HA0000000,-1,0,0,0,100,100,0,0,3,2,0,2,30,30,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    dialogues = []
    style_to_use = "ReelsViral" if style_preset == "viral" else ("Boxed" if style_preset == "boxed" else "Default")

    for seg in active_segments:
        start_ts = format_timestamp_ass(seg.start)
        end_ts = format_timestamp_ass(seg.end)
        text = seg.text.strip().replace("\n", "\\N")
        dialogues.append(f"Dialogue: 0,{start_ts},{end_ts},{style_to_use},,0,0,0,,{text}")

    return header + "\n".join(dialogues) + "\n"
