import sys
import os
import uvicorn

if __name__ == "__main__":
    # Ensure current directory is on sys.path
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    print("=" * 60)
    print("  Starting Full-Stack RAG FastAPI Server...")
    print("  Interactive API Documentation: http://localhost:8000/docs")
    print("  Corpus Directory: backend/data/corpus")
    print("=" * 60)

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
