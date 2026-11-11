import os
import shutil
import subprocess
from pathlib import Path

def find_ffmpeg() -> str:
    """Finds FFmpeg executable on the host system or workspace fallback."""
    # 1. System PATH
    system_path = shutil.which("ffmpeg")
    if system_path:
        return system_path

    # 2. Known workspace bundled locations
    workspace_candidates = [
        Path(r"D:\EZA POST\EZA-POST\backend\node_modules\ffmpeg-static\ffmpeg.exe"),
        Path(r"D:\EZA POST\ffmpeg.exe"),
    ]
    for candidate in workspace_candidates:
        if candidate.exists():
            return str(candidate)

    # 3. Default name fallback
    return "ffmpeg"

def extract_audio_to_wav(input_path: Path, output_wav_path: Path) -> Path:
    """
    Extracts and normalizes audio track from video or audio file to 16kHz mono WAV,
    the optimal input format for Faster-Whisper.
    """
    ffmpeg_bin = find_ffmpeg()
    output_wav_path.parent.mkdir(parents=True, exist_ok=True)
    
    cmd = [
        ffmpeg_bin,
        "-y",
        "-i", str(input_path),
        "-vn",                   # No video
        "-acodec", "pcm_s16le",  # Uncompressed 16-bit PCM
        "-ar", "16000",          # 16,000 Hz sample rate
        "-ac", "1",              # Mono channel
        str(output_wav_path)
    ]
    
    process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if process.returncode != 0:
        raise RuntimeError(f"FFmpeg audio extraction failed: {process.stderr[:500]}")
    
    return output_wav_path

