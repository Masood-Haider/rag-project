import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend root or parent
load_dotenv()
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

class Settings:
    PROJECT_NAME: str = "Production RAG System"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # Base paths
    BACKEND_DIR: Path = Path(__file__).resolve().parent.parent
    CORPUS_DIR: Path = Path(os.getenv("CORPUS_DIR", BACKEND_DIR / "data" / "corpus"))
    STORAGE_DIR: Path = Path(os.getenv("STORAGE_DIR", BACKEND_DIR / "data" / "storage"))

    # Model settings
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")
    DEFAULT_LLM_MODEL: str = os.getenv("LLM_MODEL", "deepseek-ai/DeepSeek-V3-0324")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    EMBEDDING_DIMENSION: int = 384

    # Embedding provider: "local" (uses torch/transformers/sentence_transformers)
    # or "hf_api" (calls HuggingFace Inference API with HF_TOKEN)
    EMBEDDING_PROVIDER: str = os.getenv("EMBEDDING_PROVIDER", "auto")

    # RAG defaults from notebook
    DEFAULT_CHUNK_SIZE: int = int(os.getenv("DEFAULT_CHUNK_SIZE", 300))
    DEFAULT_CHUNK_OVERLAP: int = int(os.getenv("DEFAULT_CHUNK_OVERLAP", 50))
    DEFAULT_K: int = int(os.getenv("DEFAULT_K", 5))
    SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", 0.40))
    TEMPERATURE: float = float(os.getenv("TEMPERATURE", 0.2))

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "https://*.vercel.app",
        "*"
    ]

settings = Settings()

# Ensure directories exist
settings.CORPUS_DIR.mkdir(parents=True, exist_ok=True)
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
