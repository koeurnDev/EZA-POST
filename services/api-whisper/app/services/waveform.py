"""
Waveform Generator Service
Extracts normalized audio peaks from 16kHz WAV files for visual timeline display.
"""

import wave
import struct
from pathlib import Path
from typing import List

def extract_waveform_peaks(wav_path: Path, num_peaks: int = 600) -> List[float]:
    """
    Extracts normalized amplitude peaks (0.0 to 1.0) from a WAV audio file.
    Fast execution (<50ms) using chunked sample processing.
    """
    if not wav_path.exists():
        return []

    try:
        with wave.open(str(wav_path), "rb") as wf:
            n_channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            n_frames = wf.getnframes()

            if n_frames == 0 or sampwidth != 2:
                return []

            total_samples = n_frames
            samples_per_peak = max(1, total_samples // num_peaks)
            peaks = []

            for _ in range(num_peaks):
                frames = wf.readframes(samples_per_peak)
                if not frames:
                    break

                # Unpack 16-bit signed PCM samples
                fmt = f"<{len(frames) // 2}h"
                samples = struct.unpack(fmt, frames)

                # If stereo, sample every 2nd value
                if n_channels > 1:
                    samples = samples[::n_channels]

                if samples:
                    max_val = max(abs(s) for s in samples)
                    peaks.append(round(min(1.0, max_val / 32768.0), 3))
                else:
                    peaks.append(0.0)

            return peaks
    except Exception as e:
        print(f"Error extracting waveform: {e}")
        return []

