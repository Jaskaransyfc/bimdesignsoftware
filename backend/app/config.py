import os
from pathlib import Path

# Base Directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Database
# Default to SQLite for local runs
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{BASE_DIR}/bim.db")
SYNC_DATABASE_URL = os.getenv("SYNC_DATABASE_URL", f"sqlite:///{BASE_DIR}/bim.db")

# Storage
STORAGE_MODE = os.getenv("STORAGE_MODE", "local") # "local" or "minio"
BUCKET_NAME = os.getenv("BUCKET_NAME", "ifc-files")
LOCAL_STORAGE_PATH = BASE_DIR / "storage"
LOCAL_STORAGE_PATH.mkdir(exist_ok=True)

# Celery (Optional for local)
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

# MinIO (Only if STORAGE_MODE is "minio")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "bim-files")
