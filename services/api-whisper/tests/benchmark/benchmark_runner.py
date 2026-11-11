import os
import sys
import json
import time
import unicodedata
from pathlib import Path
from typing import List, Dict, Any

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[4]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

def normalize_for_eval(text: str) -> str:
    """Canonical Unicode NFC normalization and whitespace collapse for unbiased metric calculation."""
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    # Remove invisible zero-width spaces for CER comparison
    text = text.replace("\u200b", "").replace("\ufeff", "")
    return " ".join(text.split()).strip()

def calculate_cer(reference: str, hypothesis: str) -> float:
    """Calculates Levenshtein Character Error Rate (CER = (Sub + Del + Ins) / N_ref)."""
    ref = list(normalize_for_eval(reference))
    hyp = list(normalize_for_eval(hypothesis))
    n = len(ref)
    m = len(hyp)
    if n == 0:
        return 1.0 if m > 0 else 0.0

    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref[i - 1] == hyp[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    return round(dp[n][m] / n, 4)

def calculate_wer(reference: str, hypothesis: str) -> float:
    """Calculates Word Error Rate (WER = (Sub + Del + Ins) / N_words)."""
    ref = normalize_for_eval(reference).split()
    hyp = normalize_for_eval(hypothesis).split()
    n = len(ref)
    m = len(hyp)
    if n == 0:
        return 1.0 if m > 0 else 0.0

    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if ref[i - 1] == hyp[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    return round(dp[n][m] / n, 4)

def run_benchmark(dataset_path: Path = None, candidate_models: List[str] = None):
    if dataset_path is None:
        dataset_path = Path(__file__).parent / "dataset" / "ground_truth.json"

    if not dataset_path.exists():
        print(f"Error: Dataset file not found at {dataset_path}")
        return

    with open(dataset_path, "r", encoding="utf-8") as f:
        samples = json.load(f)

    if candidate_models is None:
        candidate_models = [
            "PhanithLIM/whisper-small-khmer-ct2",
            "base",
            "small"
        ]

    print("================================================================================")
    print(" Khmer AI Subtitle — Multi-Model Empirical Benchmark Suite")
    print(f" Samples: {len(samples)} | Models: {len(candidate_models)}")
    print("================================================================================")

    import tempfile
    import soundfile as sf
    from faster_whisper import WhisperModel
    from apps.api.app.services.transcription import chunk_audio_by_speech_energy
    from apps.api.app.services.khmer_normalizer import normalize_khmer_text

    scratch_dir = Path(r"C:\Users\ASUS\.gemini\antigravity\brain\cdf151bb-3c2d-49b4-888e-52f25d38eb5a\scratch")
    all_results = []

    for model_id in candidate_models:
        print(f"\n>>> Benchmarking Model: [{model_id}] on CPU (int8)...")
        try:
            whisper_model = WhisperModel(model_id, device="cpu", compute_type="int8")
        except Exception as e:
            print(f"Failed to load model {model_id}: {e}")
            continue

        for sample in samples:
            sample_id = sample["sample_id"]
            category = sample["category"]
            ref_text = sample["ground_truth_khmer"]
            audio_name = sample["filename"]

            audio_path = scratch_dir / audio_name
            if not audio_path.exists():
                print(f"  Skipping {sample_id}: audio {audio_path} not found")
                continue

            data, samplerate = sf.read(str(audio_path))
            total_duration = len(data) / samplerate
            chunks = chunk_audio_by_speech_energy(data, samplerate, min_len=2.0, max_len=4.2)

            t0 = time.time()
            transcribed_segments = []
            for st, en in chunks:
                chunk_data = data[int(st * samplerate):int(en * samplerate)]
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                    tmp_name = f.name
                sf.write(tmp_name, chunk_data, samplerate)

                try:
                    segs, _ = whisper_model.transcribe(tmp_name, language="km", vad_filter=False)
                    text = "".join(s.text for s in segs).strip()
                finally:
                    Path(tmp_name).unlink(missing_ok=True)

                clean_text = normalize_khmer_text(text, add_syllable_breaks=False)
                if clean_text:
                    transcribed_segments.append(clean_text)

            latency = round(time.time() - t0, 2)
            rtf = round(latency / total_duration, 2) if total_duration > 0 else 0
            hyp_text = " ".join(transcribed_segments)

            cer = calculate_cer(ref_text, hyp_text)
            wer = calculate_wer(ref_text, hyp_text)

            record = {
                "model": model_id.split("/")[-1],
                "sample_id": sample_id,
                "category": category,
                "duration_s": round(total_duration, 2),
                "latency_s": latency,
                "rtf": rtf,
                "segments": len(transcribed_segments),
                "cer": cer,
                "wer": wer,
                "hypothesis": hyp_text[:80] + "..." if len(hyp_text) > 80 else hyp_text
            }
            all_results.append(record)
            print(f"  [{record['model']}] Segments: {record['segments']} | Latency: {latency}s ({rtf}x RTF) | CER: {cer*100:.2f}% | WER: {wer*100:.2f}%")

    print("\n================================================================================")
    print(" Comparative Benchmark Summary Table")
    print("================================================================================")
    print("| Model | Sample ID | Category | Duration | Latency | RTF | CER (%) | WER (%) |")
    print("|---|---|---|---|---|---|---|---|")
    for r in all_results:
        print(f"| {r['model']} | {r['sample_id']} | {r['category']} | {r['duration_s']}s | {r['latency_s']}s | {r['rtf']}x | {r['cer']*100:.2f}% | {r['wer']*100:.2f}% |")

    return all_results

if __name__ == "__main__":
    run_benchmark()
