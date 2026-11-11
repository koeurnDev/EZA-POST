# KhmerSub AI — Khmer Audio to SRT Subtitle Generator

A specialized AI platform and video subtitle studio designed for Cambodian content creators. Accurately transcribes spoken Khmer into timestamped subtitle tracks (`.srt`, `.vtt`, `.txt`), with interactive in-browser editing, and export capabilities ready for CapCut, Premiere Pro, DaVinci Resolve, TikTok, and Facebook Reels.

---

## 🚀 Key Features

1. **Khmer AI Speech Recognition**: Powered by `faster-whisper` (`base`, `large-v3-turbo`, `large-v3`) with Silero VAD for background noise suppression.
2. **Khmer Unicode Normalization**: Cleans inconsistent subscripts, duplicate marks, and zero-width spaces for consistent rendering.
3. **Interactive Subtitle Studio & Video Sync**: Real-time video/audio playback synchronized with subtitle segments and live on-video caption preview.
4. **Creator Typography & Presets**:
   - Google Khmer Fonts: `Kantumruy Pro`, `Battambang`, `Moul`.
   - Style Presets: Viral Reels Yellow Bold with outline stroke, Classic White with soft shadow, Dark Boxed.
5. **1-Click Interactive Demo**: Test the full studio with pre-loaded realistic Khmer subtitles and video sync without needing to upload an audio file first.
6. **Multiple Export Formats**:
   - `.srt` (SubRip Subtitle for CapCut, Premiere, etc.)
   - `.vtt` (WebVTT for HTML5 video players)
   - `.ass` (Advanced SubStation Alpha with custom Khmer fonts and colors embedded)
   - `.txt` (Clean text transcript)
7. **Direct MP4 Video Burn-in Engine**: Hardcodes stylized Khmer subtitles directly into the video file via FFmpeg (`libass` filter) without requiring Premiere or CapCut.
7. **Interactive Audio Speech Waveform Timeline**: Visual audio amplitude peaks along the playhead with proportional subtitle blocks.
8. **Creator Keyboard Shortcuts & Timestamp Nudging**:
   - `Ctrl + S`: Quick Save Subtitles.
   - `[-0.1s]` / `[+0.1s]`: Micro-timestamp adjustment buttons for millisecond audio sync.
   - Segment Split at playhead.
9. **User Authentication & Welcome Trial**:
   - Built-in PBKDF2-HMAC-SHA256 authentication.
   - Automatically grants 30 free welcome minutes upon registration.
10. **SaaS Credit Ledger & Bakong KHQR Payments**:
   - Immutable double-entry transaction ledger preventing double-spending.
   - Dynamic EMVCo/Bakong KHQR payment generation with simulated or production webhook verification.
   - 4-Tier SaaS model (Free, Creator $4.99/mo, Pro $12.99/mo, Business $29.99/mo).
11. **Cloud Scale-to-Zero Ready**: Cloudflare R2 direct pre-signed upload generator and RunPod Serverless GPU worker template.

---

## 📁 Project Structure

```text
khmer-ai-subtitle/
├── apps/
│   ├── api/             # FastAPI backend with Whisper inference & subtitle engine
│   │   ├── app/
│   │   │   ├── services/ # Transcription, Khmer normalizer, audio extractor, subtitle builder
│   │   │   ├── schemas/  # Pydantic models
│   │   │   └── main.py   # FastAPI routes
│   │   └── requirements.txt
│   ├── web/             # React 18 + Vite + Tailwind CSS creator studio
│   │   ├── src/
│   │   │   ├── components/ # SubtitleEditor, UploadSection, Navbar
│   │   │   └── App.jsx
│   │   └── package.json
│   └── ai-worker/       # Standalone GPU worker service (RunPod/Celery)
├── venv/                # Python virtual environment
├── docker-compose.yml
├── start_dev.bat        # Single-click launcher for backend & frontend
└── README.md
```

---

## 🛠️ Getting Started (Local Development)

### 1. Run with Single-Click Launcher

Simply double-click or run:
```bat
start_dev.bat
```
This automatically starts:
- **FastAPI Backend**: `http://localhost:8000` (API Docs at `http://localhost:8000/docs`)
- **React Frontend**: `http://localhost:5174`

### 2. Manual Startup

#### Backend
```bash
cd apps/api
../../venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

#### Frontend
```bash
cd apps/web
npm run dev
```
Open [http://localhost:5174](http://localhost:5174) in your browser.

