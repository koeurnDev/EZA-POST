import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseModel):
    PROJECT_NAME: str = "Khmer AI Subtitle API"
    VERSION: str = "1.0.0"
    DEFAULT_MODEL_SIZE: str = os.getenv("WHISPER_MODEL_SIZE", "base")
    DEVICE: str = os.getenv("WHISPER_DEVICE", "cpu")
    COMPUTE_TYPE: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "150"))
    ALLOWED_EXTENSIONS: list[str] = [".mp3", ".wav", ".m4a", ".mp4", ".mov", ".webm", ".aac"]
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

settings = Settings()

