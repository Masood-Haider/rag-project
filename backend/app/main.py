from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api.routes import router as api_router
from .core.rag_engine import rag_engine
from .core.vector_store import vector_store
from .core.document_loader import load_corpus

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Full-Stack RAG System powered by FastAPI, FAISS, DeepSeek, and React",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix=settings.API_PREFIX)

@app.on_event("startup")
def startup_event():
    print(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}...")
    # Check if index already loaded, else index available corpus files
    if vector_store.total_vectors == 0:
        docs = load_corpus(settings.CORPUS_DIR)
        if docs:
            print(f"Found {len(docs)} documents in corpus. Building initial FAISS index...")
            result = rag_engine.reindex_all()
            print(f"Initial index built: {result.get('message')}")
        else:
            print("Corpus directory is currently empty. Ready for document uploads.")
    else:
        print(f"Vector store ready with {vector_store.total_vectors} chunks.")

@app.get("/")
def root():
    return {
        "message": "Welcome to the Full RAG System API",
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/health",
        "stats": f"{settings.API_PREFIX}/stats"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
