"""
Feedback Collector: Human-in-the-Loop Training Data Harvest
Captures user-corrected subtitle segments as ground truth training data for Whisper fine-tuning.
"""

import json
import logging
from pathlib import Path
from typing import List, Dict
import subprocess

logger = logging.getLogger("khmer_ai_subtitle.feedback")

FEEDBACK_DIR = Path(__file__).resolve().parents[2] / "data" / "training_feedback"
FEEDBACK_AUDIO_DIR = FEEDBACK_DIR / "audio"
METADATA_FILE = FEEDBACK_DIR / "metadata.jsonl"

def init_feedback_dirs():
    FEEDBACK_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

def harvest_user_corrections(
    job_id: str,
    original_segments: List[Dict],
    updated_segments: List[Dict],
    wav_path: Path
):
    """
    Compares original segments with updated segments.
    For each segment modified by the user, cuts the corresponding audio slice and
    appends to the fine-tuning training dataset.
    """
    try:
        init_feedback_dirs()
        if not wav_path or not wav_path.exists():
            return

        orig_map = {s.get("id"): s.get("text", "").strip() for s in original_segments}
        harvested_count = 0

        with open(METADATA_FILE, "a", encoding="utf-8") as f_meta:
            for new_seg in updated_segments:
                seg_id = new_seg.get("id")
                new_text = new_seg.get("text", "").strip()
                orig_text = orig_map.get(seg_id, "").strip()

                # If text was changed and is non-empty Khmer text
                if new_text and new_text != orig_text:
                    start_s = float(new_seg.get("start", 0.0))
                    end_s = float(new_seg.get("end", 0.0))
                    duration = max(0.5, end_s - start_s)

                    chunk_id = f"feedback_{job_id[:8]}_{seg_id}_{int(start_s*100)}"
                    audio_filename = f"{chunk_id}.wav"
                    chunk_path = FEEDBACK_AUDIO_DIR / audio_filename

                    # Extract 16kHz audio slice using FFmpeg
                    cmd = [
                        "ffmpeg", "-y",
                        "-ss", str(start_s),
                        "-t", str(duration),
                        "-i", str(wav_path),
                        "-ar", "16000",
                        "-ac", "1",
                        "-c:a", "pcm_s16le",
                        str(chunk_path)
                    ]
                    res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    if res.returncode == 0:
                        entry = {
                            "audio": f"audio/{audio_filename}",
                            "sentence": new_text,
                            "original_asr": orig_text,
                            "job_id": job_id
                        }
                        f_meta.write(json.dumps(entry, ensure_ascii=False) + "\n")
                        harvested_count += 1

        if harvested_count > 0:
            logger.info(f"Harvested {harvested_count} user-corrected audio chunks for LoRA fine-tuning from job {job_id}")

    except Exception as e:
        logger.warning(f"Could not harvest user corrections: {e}")

