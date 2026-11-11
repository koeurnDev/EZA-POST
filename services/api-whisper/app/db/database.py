import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger("khmer_ai_subtitle.db")

# Load environment files
env_paths = [
    Path(__file__).resolve().parent.parent.parent / ".env",
    Path(__file__).resolve().parent.parent.parent.parent / ".env",
    Path(__file__).resolve().parent.parent.parent.parent / "apps" / "ai-worker" / ".dev.vars"
]
for p in env_paths:
    if p.exists():
        load_dotenv(p)

configured_url = os.getenv("DATABASE_URL")

engine = None

if configured_url and not configured_url.startswith("sqlite"):
    # Clean up parameters for psycopg2 compatibility
    clean_url = (
        configured_url
        .replace("&channel_binding=req", "")
        .replace("channel_binding=req&", "")
        .replace("?channel_binding=req", "")
    )
    if clean_url.startswith("postgres://"):
        clean_url = clean_url.replace("postgres://", "postgresql://", 1)

    try:
        test_engine = create_engine(clean_url, pool_pre_ping=True)
        with test_engine.connect() as conn:
            pass
        engine = test_engine
        logger.info("✅ Connected to Neon Cloud PostgreSQL database successfully.")
    except Exception as e:
        logger.error(f"❌ PostgreSQL connection failed: {e}. Please verify DATABASE_URL in .env.")

if engine is None:
    # Ephemeral in-memory fallback only when PostgreSQL is unreachable (prevents lingering SQLite files)
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    logger.info("ℹ️ Using in-memory fallback database for this session.")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
