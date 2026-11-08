import os
import shutil
import datetime
from pathlib import Path
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException, status

from ..config import settings
from ..schemas.models import (
    QueryRequest, QueryResponse,
    ReindexRequest, ReindexResponse,
    DocumentListResponse, DocumentInfo,
    StatsResponse, ConfigUpdateRequest
)
from ..core.rag_engine import rag_engine
from ..core.vector_store import vector_store
from ..core.document_loader import load_corpus, load_document

router = APIRouter()

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

@router.get("/stats", response_model=StatsResponse)
def get_stats():
    docs = load_corpus(settings.CORPUS_DIR)
    return StatsResponse(
        total_documents=len(docs),
        total_chunks=vector_store.total_vectors,
        vector_dimension=settings.EMBEDDING_DIMENSION,
        vector_store_type="FAISS IndexFlatIP (Exact Search)" if vector_store.is_faiss_available else "NumPy FlatIP Store",
        embedding_model=settings.EMBEDDING_MODEL,
        llm_model=settings.DEFAULT_LLM_MODEL,
        similarity_threshold=settings.SIMILARITY_THRESHOLD,
        faiss_available=vector_store.is_faiss_available,
        hf_token_configured=bool(settings.HF_TOKEN)
    )

@router.post("/query", response_model=QueryResponse)
def query_rag(req: QueryRequest):
    if vector_store.total_vectors == 0:
        # Auto-index if database exists
        docs = load_corpus(settings.CORPUS_DIR)
        if docs:
            rag_engine.reindex_all()
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No documents have been indexed yet. Please upload files to the knowledge base first."
            )

    result = rag_engine.query(
        question=req.question,
        k=req.k,
        use_hybrid=req.use_hybrid,
        compare_plain=req.compare_plain,
        model_name=req.model_name
    )
    return result

@router.get("/documents", response_model=DocumentListResponse)
def list_documents():
    docs_info: List[DocumentInfo] = []
    if settings.CORPUS_DIR.exists():
        for p in sorted(settings.CORPUS_DIR.iterdir()):
            if p.is_file() and p.name not in {"README.md", ".gitkeep"}:
                stat = p.stat()
                mod_time = datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                docs_info.append(DocumentInfo(
                    filename=p.name,
                    char_count=stat.st_size,
                    size_kb=round(stat.st_size / 1024, 2),
                    last_modified=mod_time
                ))

    return DocumentListResponse(
        total_documents=len(docs_info),
        documents=docs_info,
        corpus_directory=str(settings.CORPUS_DIR.resolve())
    )

@router.post("/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    """
    Endpoint where user uploads their database files for RAG.
    Saves directly to backend/data/corpus.
    """
    saved_files = []
    errors = []

    for file in files:
        try:
            target_path = settings.CORPUS_DIR / file.filename
            with open(target_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            saved_files.append(file.filename)
        except Exception as e:
            errors.append({"file": file.filename, "error": str(e)})

    # Auto re-index after upload
    reindex_result = rag_engine.reindex_all()

    return {
        "status": "success",
        "uploaded_files": saved_files,
        "errors": errors,
        "reindex_result": reindex_result,
        "message": f"Successfully uploaded {len(saved_files)} file(s) and rebuilt index."
    }

@router.delete("/documents/{filename}")
def delete_document(filename: str):
    target = settings.CORPUS_DIR / filename
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        os.remove(target)
        # Re-index
        reindex_result = rag_engine.reindex_all()
        return {"status": "success", "message": f"Deleted {filename} and updated index.", "reindex_result": reindex_result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")

@router.post("/reindex", response_model=ReindexResponse)
def trigger_reindex(req: ReindexRequest = ReindexRequest()):
    chunk_size = req.chunk_size or settings.DEFAULT_CHUNK_SIZE
    chunk_overlap = req.chunk_overlap or settings.DEFAULT_CHUNK_OVERLAP
    res = rag_engine.reindex_all(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    return ReindexResponse(**res)

@router.post("/settings")
def update_settings(req: ConfigUpdateRequest):
    if req.hf_token is not None:
        settings.HF_TOKEN = req.hf_token.strip()
        rag_engine._init_llm_client()
    if req.llm_model is not None:
        settings.DEFAULT_LLM_MODEL = req.llm_model.strip()
        rag_engine.default_model = req.llm_model.strip()
    if req.similarity_threshold is not None:
        settings.SIMILARITY_THRESHOLD = req.similarity_threshold
        rag_engine.threshold = req.similarity_threshold

    return {
        "status": "success",
        "hf_token_set": bool(settings.HF_TOKEN),
        "llm_model": settings.DEFAULT_LLM_MODEL,
        "similarity_threshold": settings.SIMILARITY_THRESHOLD
    }
