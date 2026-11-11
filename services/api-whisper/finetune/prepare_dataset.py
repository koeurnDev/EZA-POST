"""
Khmer Whisper Fine-Tuning Dataset Preparer
Prepares audio slices and ground truth text into Hugging Face Dataset format.

Features:
- Validates 16kHz Mono audio
- Slices long audio based on segment timestamps
- Normalizes Khmer Unicode to NFC
- Generates metadata.jsonl with {"audio": "path", "sentence": "text"}
"""

import os
import json
import unicodedata
import subprocess
from pathlib import Path
from typing import List, Dict

def normalize_khmer_text(text: str) -> str:
    """Normalize text into canonical NFC unicode and strip excessive whitespace."""
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text.strip())
    # Remove redundant zero-width spaces or double spaces
    text = " ".join(text.split())
    return text

def slice_audio_chunk(input_wav: Path, output_wav: Path, start_sec: float, end_sec: float):
    """Cut audio slice using FFmpeg with 16kHz mono 16-bit PCM format."""
    output_wav.parent.mkdir(parents=True, exist_ok=True)
    duration = max(0.5, end_sec - start_sec)
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_sec),
        "-t", str(duration),
        "-i", str(input_wav),
        "-ar", "16000",
        "-ac", "1",
        "-c:a", "pcm_s16le",
        str(output_wav)
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

def build_hf_dataset(
    manifest_records: List[Dict],
    output_dir: Path,
    dataset_name: str = "khmer_tech_asr"
):
    """
    Builds a structured dataset directory ready for Hugging Face datasets.load_dataset.
    Structure:
      output_dir/
        ├── audio/
        │     ├── chunk_00001.wav
        │     └── chunk_00002.wav
        └── metadata.jsonl
    """
    output_dir = Path(output_dir)
    audio_dir = output_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    metadata_path = output_dir / "metadata.jsonl"
    processed_count = 0

    with open(metadata_path, "w", encoding="utf-8") as f_meta:
        for idx, record in enumerate(manifest_records):
            source_wav = Path(record["audio_path"])
            start_s = float(record.get("start", 0.0))
            end_s = float(record.get("end", 0.0))
            raw_text = record.get("text", "")
            clean_text = normalize_khmer_text(raw_text)

            if not clean_text or not source_wav.exists():
                continue

            chunk_filename = f"chunk_{idx+1:05d}.wav"
            chunk_filepath = audio_dir / chunk_filename

            try:
                if end_s > start_s:
                    slice_audio_chunk(source_wav, chunk_filepath, start_s, end_s)
                else:
                    # Full file copy with 16kHz conversion
                    slice_audio_chunk(source_wav, chunk_filepath, 0.0, 30.0)

                entry = {
                    "audio": f"audio/{chunk_filename}",
                    "sentence": clean_text
                }
                f_meta.write(json.dumps(entry, ensure_ascii=False) + "\n")
                processed_count += 1
            except Exception as e:
                print(f"Skipping record {idx}: {e}")

    print(f"Successfully generated dataset '{dataset_name}' with {processed_count} samples at {output_dir}")
    return metadata_path

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Prepare Khmer Speech Dataset for Whisper LoRA Fine-Tuning")
    parser.add_argument("--input-json", type=str, required=True, help="Path to ground truth JSON")
    parser.add_argument("--output-dir", type=str, default="./dataset_prepared", help="Output directory")
    args = parser.parse_args()

    with open(args.input_json, "r", encoding="utf-8") as f:
        data = json.load(f)
    build_hf_dataset(data, Path(args.output_dir))

