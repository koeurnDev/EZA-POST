import uuid
import shutil
import logging
from pathlib import Path
from typing import Dict
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, FileResponse

from .config import settings, UPLOAD_DIR
from .schemas.jobs import (
    TranscriptionResponse,
    SubtitleSegmentItem,
    SubtitleUpdateRequest
)
from .services.audio_extractor import extract_audio_to_wav
from .services.transcription import transcribe_audio_khmer
from .services.subtitles import generate_srt, generate_vtt, generate_txt, generate_ass
from .services.video_renderer import render_subtitled_video
from .services.waveform import extract_waveform_peaks
from .services.feedback_collector import harvest_user_corrections
from .services.caption_generator import generate_social_captions
from .routes.billing import router as billing_router
from .routes.auth import router as auth_router
from .routes.admin import router as admin_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("khmer_ai_subtitle")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Khmer AI Subtitle Generator — Turn Khmer Audio into Word-Accurate Subtitles"
)

# Include routes
app.include_router(auth_router)
app.include_router(billing_router)
app.include_router(admin_router)

# Enable CORS for local and web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Persistent store for jobs in Sprint 1 MVP
JOBS_FILE = UPLOAD_DIR / "jobs_store.json"
JOBS_STORE: Dict[str, dict] = {}

def load_jobs_store():
    global JOBS_STORE
    if JOBS_FILE.exists():
        try:
            import json
            with open(JOBS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                JOBS_STORE.update(data)
                logger.info(f"Loaded {len(data)} jobs from {JOBS_FILE}")
        except Exception as e:
            logger.warning(f"Could not load jobs_store.json: {e}")

def save_jobs_store():
    try:
        import json
        with open(JOBS_FILE, "w", encoding="utf-8") as f:
            json.dump(JOBS_STORE, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"Could not save jobs_store.json: {e}")

# Load cached jobs on startup
load_jobs_store()

def process_transcription_job(job_id: str, uploaded_filepath: Path, model_size: str, language: str, vad_filter: bool, initial_prompt: str = None):
    try:
        JOBS_STORE[job_id]["status"] = "EXTRACTING_AUDIO"
        save_jobs_store()
        wav_path = UPLOAD_DIR / f"{job_id}.wav"
        
        # 1. Extract audio to 16kHz WAV
        extract_audio_to_wav(uploaded_filepath, wav_path)
        
        # 2. Transcribe via Whisper
        JOBS_STORE[job_id]["status"] = "TRANSCRIBING"
        save_jobs_store()
        segments, duration = transcribe_audio_khmer(
            wav_path,
            model_size=model_size,
            language=language,
            vad_filter=vad_filter,
            initial_prompt=initial_prompt
        )
        
        # 3. Store result
        JOBS_STORE[job_id]["status"] = "COMPLETED"
        JOBS_STORE[job_id]["duration"] = duration
        JOBS_STORE[job_id]["segments"] = [s.model_dump() for s in segments]
        save_jobs_store()
        
    except Exception as e:
        logger.exception(f"Job {job_id} failed: {e}")
        JOBS_STORE[job_id]["status"] = "FAILED"
        JOBS_STORE[job_id]["error"] = str(e)
        save_jobs_store()
    finally:
        # Cleanup temp WAV if needed or preserve for playback
        pass

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

@app.get("/api/v1/models")
def list_available_models():
    return {
        "models": [
            {"id": "base", "name": "Whisper Base (Fastest, Low Memory)", "recommended": False},
            {"id": "small", "name": "Whisper Small (Balanced)", "recommended": False},
            {"id": "large-v3-turbo", "name": "Whisper Large-v3 Turbo (High Accuracy & Speed)", "recommended": True},
            {"id": "large-v3", "name": "Whisper Large-v3 (Maximum Accuracy)", "recommended": False}
        ]
    }

@app.post("/api/v1/transcribe", response_model=TranscriptionResponse)
async def create_transcription_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model_size: str = Form("base"),
    language: str = Form("km"),
    vad_filter: bool = Form(False),
    initial_prompt: str = Form(None)
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )
    
    job_id = str(uuid.uuid4())
    saved_path = UPLOAD_DIR / f"{job_id}{ext}"
    
    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    is_video = ext in [".mp4", ".mov", ".webm"]
    media_type = "video" if is_video else "audio"

    JOBS_STORE[job_id] = {
        "job_id": job_id,
        "status": "QUEUED",
        "filename": file.filename,
        "duration": 0.0,
        "language": language,
        "media_path": str(saved_path),
        "media_type": media_type,
        "segments": [],
        "error": None
    }
    
    background_tasks.add_task(
        process_transcription_job,
        job_id,
        saved_path,
        model_size,
        language,
        vad_filter,
        initial_prompt
    )
    
    return TranscriptionResponse(
        job_id=job_id,
        status="QUEUED",
        filename=file.filename or "audio",
        duration=0.0,
        language=language,
        media_url=f"/api/v1/media/{job_id}",
        media_type=media_type,
        segments=[]
    )

@app.get("/api/v1/media/{job_id}")
def stream_media(job_id: str):
    if job_id not in JOBS_STORE:
        raise HTTPException(status_code=404, detail="Job not found")
    media_path = JOBS_STORE[job_id].get("media_path")
    if not media_path or not Path(media_path).exists():
        raise HTTPException(status_code=404, detail="Media file not found")
    return FileResponse(media_path)

@app.get("/api/v1/media/{job_id}/waveform")
def get_media_waveform(job_id: str, peaks: int = 600):
    wav_path = UPLOAD_DIR / f"{job_id}.wav"
    if not wav_path.exists():
        if job_id in JOBS_STORE and Path(JOBS_STORE[job_id]["media_path"]).exists():
            extract_audio_to_wav(Path(JOBS_STORE[job_id]["media_path"]), wav_path)
        else:
            raise HTTPException(status_code=404, detail="Audio file not found")
            
    peaks_data = extract_waveform_peaks(wav_path, num_peaks=peaks)
    return {"job_id": job_id, "peaks": peaks_data}

@app.get("/api/v1/jobs")
def list_jobs(limit: int = 10):
    jobs_list = []
    for job_id, job in list(JOBS_STORE.items())[-limit:]:
        jobs_list.append({
            "job_id": job["job_id"],
            "filename": job["filename"],
            "status": job["status"],
            "duration": job.get("duration", 0.0),
            "media_type": job.get("media_type", "audio"),
            "segments_count": len(job.get("segments", []))
        })
    jobs_list.reverse()
    return {"jobs": jobs_list}

@app.post("/api/v1/demo/load-sample", response_model=TranscriptionResponse)
def load_sample_project():
    demo_id = "sample-khmer-review"
    JOBS_STORE[demo_id] = {
        "job_id": demo_id,
        "status": "COMPLETED",
        "filename": "Review_Cambodia_Creator_Sample.mp4",
        "duration": 18.5,
        "language": "km",
        "media_path": "",
        "media_type": "video",
        "segments": [
            {"id": 1, "start": 0.5, "end": 3.8, "text": "សួស្ដីបងប្អូនទាំងអស់គ្នា! សូមស្វាគមន៍មកកាន់ KhmerSub AI។"},
            {"id": 2, "start": 4.0, "end": 7.5, "text": "ថ្ងៃនេះយើងនឹងបង្ហាញអំពីរបៀបបង្កើត Subtitle ភាសាខ្មែរដោយស្វ័យប្រវត្តិ។"},
            {"id": 3, "start": 7.8, "end": 11.2, "text": "ប្រព័ន្ធនេះដំណើរការដោយ Faster-Whisper លឿន និងមានភាពសុក្រឹតខ្ពស់។"},
            {"id": 4, "start": 11.5, "end": 14.8, "text": "អ្នកអាច Export ជា .SRT, .VTT, ឬ Render ចូលទៅក្នុង MP4 ភ្លាមៗ។"},
            {"id": 5, "start": 15.0, "end": 18.2, "text": "សូមសាកល្បងកែសម្រួលអត្ថបទ និងប្តូរ Font តាមការចូលចិត្តរបស់អ្នក!"}
        ],
        "error": None
    }
    job = JOBS_STORE[demo_id]
    return TranscriptionResponse(
        job_id=job["job_id"],
        status=job["status"],
        filename=job["filename"],
        duration=job["duration"],
        language=job["language"],
        media_url=None,
        media_type=job["media_type"],
        segments=[SubtitleSegmentItem(**s) for s in job["segments"]],
        srt_url=f"/api/v1/jobs/{demo_id}/export/srt",
        vtt_url=f"/api/v1/jobs/{demo_id}/export/vtt",
        ass_url=f"/api/v1/jobs/{demo_id}/export/ass",
        txt_url=f"/api/v1/jobs/{demo_id}/export/txt",
        error=None
    )

@app.get("/api/v1/jobs/{job_id}", response_model=TranscriptionResponse)
def get_job_status(job_id: str):
    if job_id not in JOBS_STORE or not JOBS_STORE[job_id].get("segments"):
        load_jobs_store()
    if job_id not in JOBS_STORE:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = JOBS_STORE[job_id]
    return TranscriptionResponse(
        job_id=job["job_id"],
        status=job["status"],
        filename=job["filename"],
        duration=job.get("duration", 0.0),
        language=job.get("language", "km"),
        media_url=f"/api/v1/media/{job_id}",
        media_type=job.get("media_type", "audio"),
        segments=[SubtitleSegmentItem(**s) for s in job.get("segments", [])],
        srt_url=f"/api/v1/jobs/{job_id}/export/srt" if job["status"] == "COMPLETED" else None,
        vtt_url=f"/api/v1/jobs/{job_id}/export/vtt" if job["status"] == "COMPLETED" else None,
        ass_url=f"/api/v1/jobs/{job_id}/export/ass" if job["status"] == "COMPLETED" else None,
        txt_url=f"/api/v1/jobs/{job_id}/export/txt" if job["status"] == "COMPLETED" else None,
        error=job.get("error")
    )

@app.post("/api/v1/jobs/{job_id}/update")
def update_subtitles(job_id: str, payload: SubtitleUpdateRequest, background_tasks: BackgroundTasks):
    if job_id not in JOBS_STORE:
        raise HTTPException(status_code=404, detail="Job not found")
    
    orig_segments = list(JOBS_STORE[job_id].get("segments", []))
    new_segments = [s.model_dump() for s in payload.segments]
    JOBS_STORE[job_id]["segments"] = new_segments
    save_jobs_store()

    # Harvest user corrections to build continuous fine-tuning dataset
    wav_path = UPLOAD_DIR / f"{job_id}.wav"
    background_tasks.add_task(
        harvest_user_corrections,
        job_id,
        orig_segments,
        new_segments,
        wav_path
    )

    return {"status": "updated", "count": len(payload.segments)}

@app.get("/api/v1/jobs/{job_id}/export/{export_format}")
def export_subtitles(
    job_id: str,
    export_format: str,
    style_preset: str = "default",
    words_per_sub: str = "phrase"
):
    if job_id not in JOBS_STORE or not JOBS_STORE[job_id].get("segments"):
        load_jobs_store()
    if job_id not in JOBS_STORE:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = JOBS_STORE[job_id]
    if job["status"] != "COMPLETED":
        raise HTTPException(status_code=400, detail="Transcription job is not completed yet")
    
    segments = [SubtitleSegmentItem(**s) for s in job.get("segments", [])]
    base_name = Path(job.get("filename", "subtitles")).stem

    # Map pacing query param (1, 2, 3, or phrase)
    w_count = 0
    if words_per_sub.isdigit():
        w_count = int(words_per_sub)
    elif words_per_sub.lower() in ["reels", "single"]:
        w_count = 1
    elif words_per_sub.lower() == "fast":
        w_count = 2
    
    fmt = export_format.lower()
    if fmt == "srt":
        content = generate_srt(segments, words_per_sub=w_count)
        headers = {"Content-Disposition": f'attachment; filename="{base_name}.srt"'}
        return Response(content=content, media_type="text/plain; charset=utf-8", headers=headers)
    elif fmt == "vtt":
        content = generate_vtt(segments, words_per_sub=w_count)
        headers = {"Content-Disposition": f'attachment; filename="{base_name}.vtt"'}
        return Response(content=content, media_type="text/vtt; charset=utf-8", headers=headers)
    elif fmt == "ass":
        content = generate_ass(segments, style_preset=style_preset, words_per_sub=w_count)
        headers = {"Content-Disposition": f'attachment; filename="{base_name}.ass"'}
        return Response(content=content, media_type="text/plain; charset=utf-8", headers=headers)
    elif fmt == "txt":
        content = generate_txt(segments)
        headers = {"Content-Disposition": f'attachment; filename="{base_name}.txt"'}
        return Response(content=content, media_type="text/plain; charset=utf-8", headers=headers)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported export format '{export_format}'. Choose srt, vtt, ass, or txt.")

# Store for render jobs
RENDER_STORE: Dict[str, dict] = {}

def process_video_render(job_id: str, style_preset: str, font_name: str):
    try:
        RENDER_STORE[job_id]["status"] = "RENDERING"
        job = JOBS_STORE[job_id]
        input_video_path = Path(job["media_path"])
        output_video_path = UPLOAD_DIR / f"{job_id}_rendered.mp4"
        segments = [SubtitleSegmentItem(**s) for s in job["segments"]]
        
        render_subtitled_video(
            input_video_path=input_video_path,
            segments=segments,
            output_video_path=output_video_path,
            style_preset=style_preset,
            font_name=font_name
        )
        
        RENDER_STORE[job_id]["status"] = "COMPLETED"
        RENDER_STORE[job_id]["output_path"] = str(output_video_path)
    except Exception as e:
        logger.exception(f"Render {job_id} failed: {e}")
        RENDER_STORE[job_id]["status"] = "FAILED"
        RENDER_STORE[job_id]["error"] = str(e)

@app.post("/api/v1/jobs/{job_id}/render-video")
def trigger_video_render(
    job_id: str,
    background_tasks: BackgroundTasks,
    style_preset: str = Form("viral"),
    font_name: str = Form("Kantumruy Pro")
):
    if job_id not in JOBS_STORE:
        raise HTTPException(status_code=404, detail="Job not found")
    job = JOBS_STORE[job_id]
    if job.get("media_type") != "video":
        raise HTTPException(status_code=400, detail="Burn-in MP4 export requires a video file")
    
    RENDER_STORE[job_id] = {
        "status": "QUEUED",
        "error": None,
        "output_path": None
    }
    background_tasks.add_task(process_video_render, job_id, style_preset, font_name)
    return {"status": "QUEUED", "job_id": job_id}

@app.get("/api/v1/jobs/{job_id}/render-status")
def get_render_status(job_id: str):
    if job_id not in RENDER_STORE:
        return {"status": "IDLE"}
    item = RENDER_STORE[job_id]
    return {
        "status": item["status"],
        "error": item.get("error"),
        "download_url": f"/api/v1/jobs/{job_id}/download-rendered" if item["status"] == "COMPLETED" else None
    }

@app.get("/api/v1/jobs/{job_id}/download-rendered")
def download_rendered_video(job_id: str):
    if job_id not in RENDER_STORE or RENDER_STORE[job_id]["status"] != "COMPLETED":
        raise HTTPException(status_code=404, detail="Rendered video not ready or not found")
    output_path = RENDER_STORE[job_id]["output_path"]
    filename = f"subtitled_{JOBS_STORE[job_id]['filename']}"
    return FileResponse(output_path, media_type="video/mp4", filename=filename)

@app.get("/api/v1/jobs/{job_id}/captions")
def get_social_captions(job_id: str, language: str = "km"):
    if job_id not in JOBS_STORE:
        load_jobs_store()
    if job_id not in JOBS_STORE:
        raise HTTPException(status_code=404, detail="Job not found")

    job = JOBS_STORE[job_id]
    segments = job.get("segments", [])
    full_text = " ".join(s.get("text", "") for s in segments if s.get("text"))
    if not full_text:
        return {"captions": []}

    captions = generate_social_captions(full_text, filename=job.get("filename", ""), language=language)
    return {"job_id": job_id, "captions": captions}


