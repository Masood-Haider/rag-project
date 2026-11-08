import os
import shutil
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from root or backend
load_dotenv()
root_env = Path(__file__).resolve().parent.parent.parent / ".env"
if root_env.exists():
    load_dotenv(dotenv_path=root_env)
backend_env = Path(__file__).resolve().parent.parent / ".env"
if backend_env.exists():
    load_dotenv(dotenv_path=backend_env)

class Settings:
    PROJECT_NAME: str = "Nexus RAG System"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # Detect Vercel serverless environment
    IS_VERCEL: bool = bool(os.getenv("VERCEL") or os.getenv("VERCEL_ENV") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))

    # Base paths
    BACKEND_DIR: Path = Path(__file__).resolve().parent.parent
    BUNDLED_CORPUS_DIR: Path = BACKEND_DIR / "data" / "corpus"

    if IS_VERCEL:
        # Vercel serverless has a read-only filesystem except /tmp
        CORPUS_DIR: Path = Path("/tmp/nexus_corpus")
        STORAGE_DIR: Path = Path("/tmp/nexus_storage")
        SESSIONS_DIR: Path = Path("/tmp/nexus_sessions")
    else:
        CORPUS_DIR: Path = Path(os.getenv("CORPUS_DIR", BACKEND_DIR / "data" / "corpus"))
        STORAGE_DIR: Path = Path(os.getenv("STORAGE_DIR", BACKEND_DIR / "data" / "storage"))
        SESSIONS_DIR: Path = Path(os.getenv("SESSIONS_DIR", BACKEND_DIR / "data" / "sessions"))

    # Admin Access Password (hardcoded fallback or env)
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "1112")

    # GitHub Direct Sync (Auto-commits admin file uploads directly to GitHub repo)
    GITHUB_TOKEN: str = os.getenv("GITHUB_TOKEN", "")
    GITHUB_REPO: str = os.getenv("GITHUB_REPO", "Masood-Haider/rag-project")
    GITHUB_BRANCH: str = os.getenv("GITHUB_BRANCH", "main")

    # Groq Settings (Server-side ONLY)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")

    # Embedding settings
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    EMBEDDING_DIMENSION: int = 384

    # RAG Hyperparameters
    DEFAULT_CHUNK_SIZE: int = int(os.getenv("DEFAULT_CHUNK_SIZE", 300))
    DEFAULT_CHUNK_OVERLAP: int = int(os.getenv("DEFAULT_CHUNK_OVERLAP", 50))
    DEFAULT_K: int = int(os.getenv("DEFAULT_K", 5))
    SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", 0.40))
    TEMPERATURE: float = float(os.getenv("TEMPERATURE", 0.2))

    # CORS
    CORS_ORIGINS: list[str] = ["*"]

settings = Settings()

# Ensure directories exist and copy bundled files on Vercel
try:
    settings.CORPUS_DIR.mkdir(parents=True, exist_ok=True)
    settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    settings.SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

    # In Vercel, copy bundled starter documents to /tmp/nexus_corpus so they can be read & indexed
    if settings.IS_VERCEL and settings.BUNDLED_CORPUS_DIR.exists():
        for f in settings.BUNDLED_CORPUS_DIR.iterdir():
            if f.is_file():
                dest = settings.CORPUS_DIR / f.name
                if not dest.exists():
                    shutil.copy2(f, dest)
except Exception as e:
    print(f"Directory initialization notice: {e}")
