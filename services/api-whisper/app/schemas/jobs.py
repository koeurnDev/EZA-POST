from typing import List, Optional
from pydantic import BaseModel, Field

class WordItem(BaseModel):
    word: str
    start: float
    end: float

class SubtitleSegmentItem(BaseModel):
    id: int
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    text: str = Field(..., description="Subtitled text")
    english_text: Optional[str] = Field(None, description="Optional translated English text for dual subtitles")
    words: Optional[List[WordItem]] = Field(default_factory=list, description="Word-level timestamps for karaoke animation")

class TranscriptionRequest(BaseModel):
    model_size: Optional[str] = "base"
    language: Optional[str] = "km"
    task: Optional[str] = "transcribe"  # 'transcribe' or 'translate'
    vad_filter: Optional[bool] = True

class TranscriptionResponse(BaseModel):
    job_id: str
    status: str
    filename: str
    duration: float
    language: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    segments: List[SubtitleSegmentItem] = []
    srt_url: Optional[str] = None
    vtt_url: Optional[str] = None
    ass_url: Optional[str] = None
    txt_url: Optional[str] = None
    error: Optional[str] = None

class SubtitleUpdateRequest(BaseModel):
    segments: List[SubtitleSegmentItem]

