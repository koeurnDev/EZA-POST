import os
import json
import ssl
import urllib.request
import urllib.parse
import logging
from pathlib import Path
from typing import Optional, Dict, Any

try:
    from dotenv import load_dotenv
    env_file = Path(__file__).resolve().parents[2] / ".env"
    if env_file.exists():
        load_dotenv(env_file)
except ImportError:
    pass

logger = logging.getLogger(__name__)

class UpstashRedisQueue:
    """
    Zero-dependency REST-based Upstash Redis Client & Task Queue.
    Fully compatible with Serverless, FastAPI, and Cloudflare Workers.
    """
    def __init__(self, base_url: str = None, token: str = None):
        raw_url = base_url or os.getenv("REDIS_URL", "https://sharp-newt-86747.upstash.io")
        raw_token = token or os.getenv("REDIS_TOKEN", "gQAAAAAAAVLbAAIgcDJkYjI0ODY4NWY4MTY0ODcyOTA1MjkxMTA1Y2JkMjJiMg")
        self.base_url = raw_url.strip('"\'').rstrip("/")
        self.token = raw_token.strip('"\'')
        self.ssl_ctx = ssl._create_unverified_context()

    def is_configured(self) -> bool:
        return bool(self.base_url and self.token and "upstash.io" in self.base_url)

    def _execute(self, command_path: str, data: Any = None) -> Optional[Any]:
        if not self.is_configured():
            return None

        url = f"{self.base_url}/{command_path}"
        headers = {"Authorization": f"Bearer {self.token}"}
        
        req = urllib.request.Request(url, headers=headers)
        if data is not None:
            if isinstance(data, (dict, list)):
                payload = json.dumps(data)
            else:
                payload = str(data)
            req.data = payload.encode("utf-8")
            headers["Content-Type"] = "application/json"

        try:
            with urllib.request.urlopen(req, context=self.ssl_ctx, timeout=5.0) as resp:
                res = json.loads(resp.read().decode())
                return res.get("result")
        except Exception as e:
            logger.warning(f"Upstash Redis command '{command_path}' failed: {e}")
            return None

    def ping(self) -> bool:
        """Pings Redis to check connectivity."""
        result = self._execute("ping")
        return result == "PONG"

    def push_job(self, queue_name: str, job_data: Dict[str, Any]) -> bool:
        """Pushes a transcription job payload onto the queue."""
        encoded = urllib.parse.quote(json.dumps(job_data))
        res = self._execute(f"lpush/{queue_name}/{encoded}")
        return res is not None

    def pop_job(self, queue_name: str) -> Optional[Dict[str, Any]]:
        """Pops a job from the queue for worker processing."""
        raw = self._execute(f"rpop/{queue_name}")
        if raw:
            try:
                return json.loads(urllib.parse.unquote(raw))
            except Exception:
                return None
        return None

    def set_job_status(self, job_id: str, status_data: Dict[str, Any], expire_seconds: int = 86400):
        """Stores real-time job status with 24-hour expiration via POST body."""
        self._execute(f"set/job:{job_id}?EX={expire_seconds}", data=status_data)

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves cached job status."""
        raw = self._execute(f"get/job:{job_id}")
        if raw:
            try:
                return json.loads(urllib.parse.unquote(raw))
            except Exception:
                return None
        return None

# Singleton instance initialized from environment variables
redis_queue = UpstashRedisQueue()

