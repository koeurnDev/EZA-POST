import os
import sys
import time
import json
import logging
import tempfile
import urllib.request
import ssl
from pathlib import Path
from dotenv import load_dotenv

# Ensure project root is in sys.path
SCRIPT_DIR = Path(__file__).resolve()
SERVICE_ROOT = SCRIPT_DIR.parents[2]
PROJECT_ROOT = SCRIPT_DIR.parents[3]

if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Load environment variables
load_dotenv(SERVICE_ROOT / ".env")
load_dotenv(PROJECT_ROOT / "backend" / ".env")
load_dotenv(PROJECT_ROOT / ".env")

from apps.api.app.services.redis_queue import redis_queue
from apps.api.app.services.transcription import transcribe_audio_khmer
from apps.api.app.services.khmer_normalizer import normalize_khmer_text

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("KhmerAI-Worker")

SSL_CTX = ssl._create_unverified_context()

def run_worker():
    logger.info("==================================================")
    logger.info(" Khmer AI Subtitle — High-Accuracy Redis Worker")
    logger.info(" Engine: Faster-Whisper (CTranslate2) + Khmer Normalizer")
    logger.info(" Redis: https://sharp-newt-86747.upstash.io")
    logger.info(" Queue: 'khmersub:jobs'")
    logger.info("==================================================")

    if not redis_queue.is_configured():
        logger.error("Upstash Redis is not configured. Please check REDIS_URL and REDIS_TOKEN.")
        return

    logger.info("Checking Redis connection...")
    if redis_queue.ping():
        logger.info("Connected to Upstash Redis successfully (PONG)!")
    else:
        logger.warning("Could not ping Redis, but attempting to listen...")

    while True:
        try:
            job = redis_queue.pop_job("khmersub:jobs")
            if not job:
                time.sleep(1.0)
                continue

            job_id = job.get("job_id")
            filename = job.get("filename", "media.mp4")
            media_url = job.get("media_url")
            r2_key = job.get("r2_key")
            language = job.get("language", "km")
            model_size = job.get("model_size", "base")
            initial_prompt = job.get("initial_prompt")

            logger.info(f">>> Received Job: {job_id} | File: {filename} | Lang: {language} | Prompt: {initial_prompt[:30] if initial_prompt else 'Default'}")

            # Mark status as TRANSCRIBING in Redis
            current_status = redis_queue.get_job_status(job_id) or {}
            current_status["status"] = "TRANSCRIBING"
            redis_queue.set_job_status(job_id, current_status)

            # Determine audio/media source
            local_upload_path = PROJECT_ROOT / "apps" / "api" / "uploads" / f"{job_id}.mp4"
            target_path = None
            is_temp = False

            if local_upload_path.exists():
                target_path = local_upload_path
                logger.info(f"Using local file: {target_path}")
            elif media_url:
                # Full URL or relative Cloudflare URL
                if media_url.startswith("/"):
                    full_url = f"https://khmersub-cf-worker.koeurnseab630.workers.dev{media_url}"
                else:
                    full_url = media_url

                logger.info(f"Downloading media from Cloudflare R2: {full_url}")
                suffix = Path(filename).suffix or ".mp4"
                tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
                tmp.close()
                target_path = Path(tmp.name)
                is_temp = True

                req = urllib.request.Request(full_url, headers={"User-Agent": "KhmerSub-AI-Worker/1.0"})
                with urllib.request.urlopen(req, context=SSL_CTX, timeout=30.0) as resp:
                    with open(target_path, "wb") as f:
                        f.write(resp.read())
                logger.info(f"Downloaded {target_path.stat().st_size / (1024*1024):.2f} MB")

            if not target_path or not target_path.exists():
                logger.error(f"Cannot find media for job {job_id}")
                current_status["status"] = "FAILED"
                current_status["error"] = "Media file could not be accessed"
                redis_queue.set_job_status(job_id, current_status)
                continue

            # Run high-accuracy Faster-Whisper Khmer transcription!
            logger.info(f"Running Faster-Whisper ASR ({model_size}) on {target_path.name}...")
            start_t = time.time()
            segments_list, duration = transcribe_audio_khmer(
                audio_path=target_path,
                model_size=model_size,
                language=language,
                vad_filter=False,
                initial_prompt=initial_prompt
            )
            elapsed = time.time() - start_t
            logger.info(f"Transcription finished in {elapsed:.2f}s! Generated {len(segments_list)} segments.")

            # Convert to serializable dicts
            clean_segments = []
            for s in segments_list:
                seg_dict = {
                    "id": s.id,
                    "start": s.start,
                    "end": s.end,
                    "text": s.text
                }
                if hasattr(s, "words") and s.words:
                    seg_dict["words"] = [
                        {"word": w.word, "start": w.start, "end": w.end}
                        for w in s.words
                    ]
                clean_segments.append(seg_dict)

            # Update job status in Redis
            current_status["status"] = "COMPLETED"
            current_status["duration"] = duration
            current_status["segments"] = clean_segments
            current_status["updated_at"] = time.time()
            redis_queue.set_job_status(job_id, current_status)

            logger.info(f"Job {job_id} COMPLETED with {len(clean_segments)} segments and updated in Upstash Redis!\n")

            if is_temp and target_path and target_path.exists():
                try:
                    os.remove(target_path)
                except Exception:
                    pass

        except Exception as e:
            logger.error(f"Worker exception: {e}", exc_info=True)
            if 'job_id' in locals() and 'current_status' in locals():
                current_status["status"] = "FAILED"
                current_status["error"] = str(e)
                redis_queue.set_job_status(job_id, current_status)
            time.sleep(2.0)

if __name__ == "__main__":
    run_worker()

