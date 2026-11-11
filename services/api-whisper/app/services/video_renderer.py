"""
Video Renderer Service
Burns styled Khmer subtitles into MP4 video using FFmpeg and libass.
"""

import os
import subprocess
from pathlib import Path
from typing import List
from .audio_extractor import find_ffmpeg
from .subtitles import generate_ass
from ..schemas.jobs import SubtitleSegmentItem

def render_subtitled_video(
    input_video_path: Path,
    segments: List[SubtitleSegmentItem],
    output_video_path: Path,
    style_preset: str = "viral",
    font_name: str = "Kantumruy Pro",
    font_size: int = 48,
    aspect_ratio: str = "16:9",
    words_per_sub: int = 0
) -> Path:
    """
    Renders styled ASS subtitles into an MP4 video using FFmpeg libass filter,
    with smart auto-reframe (16:9, 9:16 Shorts with blurred background, 1:1 Square).
    """
    ffmpeg_bin = find_ffmpeg()
    output_video_path.parent.mkdir(parents=True, exist_ok=True)
    
    # 1. Write temporary ASS subtitle file in the same directory
    ass_path = output_video_path.parent / f"{output_video_path.stem}.ass"
    ass_content = generate_ass(
        segments,
        font_name=font_name,
        font_size=font_size,
        style_preset=style_preset,
        words_per_sub=words_per_sub
    )
    
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(ass_content)

    # 2. Escape path for FFmpeg filter on Windows
    clean_ass_path = str(ass_path).replace("\\", "/")
    escaped_ass_path = clean_ass_path.replace(":", "\\:")

    if aspect_ratio == "9:16":
        # Viral blurred background auto-reframe for 9:16 vertical Shorts/TikTok
        vf_filter = (
            f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg];"
            f"[0:v]scale=1080:-1[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2[v];"
            f"[v]ass='{escaped_ass_path}'"
        )
    elif aspect_ratio == "1:1":
        # Square 1:1 auto-reframe with blurred background
        vf_filter = (
            f"[0:v]scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,boxblur=25:5[bg];"
            f"[0:v]scale=1080:-1[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2[v];"
            f"[v]ass='{escaped_ass_path}'"
        )
    else:
        vf_filter = f"ass='{escaped_ass_path}'"

    cmd = [
        ffmpeg_bin,
        "-y",
        "-i", str(input_video_path),
        "-vf", vf_filter,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-c:a", "copy",
        str(output_video_path)
    ]

    process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if process.returncode != 0:
        # Fallback without quotes if libass path syntax issue
        alt_vf = f"ass={escaped_ass_path}"
        cmd[4] = alt_vf
        retry_proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if retry_proc.returncode != 0:
            raise RuntimeError(f"FFmpeg subtitle burn-in failed: {retry_proc.stderr[-600:]}")

    # Clean up temporary ASS file
    if ass_path.exists():
        try:
            ass_path.unlink()
        except OSError:
            pass

    return output_video_path

