import os
import shutil
import datetime
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Header, Form, HTTPException, status

from ..config import settings, record_deleted_file
from ..schemas.models import (
    QueryRequest, QueryResponse,
    ReindexRequest, ReindexResponse,
    DocumentListResponse, DocumentInfo,
    StatsResponse, ConfigUpdateRequest,
    AdminVerifyRequest, AdminVerifyResponse
)
from ..core.rag_engine import rag_engine
from ..core.vector_store import vector_store
from ..core.document_loader import load_corpus
from ..core.session_manager import session_manager

router = APIRouter()

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "engine": "Groq + FAISS"
    }

def _check_admin(password: Optional[str]) -> bool:
    if not password or not settings.ADMIN_PASSWORD:
        return False
    expected = str(settings.ADMIN_PASSWORD).strip().strip('"').strip("'")
    provided = str(password).strip().strip('"').strip("'")
    return provided == expected

def _commit_to_github_repo(filename: str, content_bytes: bytes) -> tuple[bool, str]:
    token = settings.GITHUB_TOKEN.strip()
    repo = settings.GITHUB_REPO.strip()
    branch = settings.GITHUB_BRANCH.strip()
    if not token or not repo:
        return False, "GITHUB_TOKEN not set"

    import base64
    import requests

    url = f"https://api.github.com/repos/{repo}/contents/backend/data/corpus/{filename}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    sha = None
    try:
        r_get = requests.get(url, headers=headers, timeout=10)
        if r_get.status_code == 200:
            sha = r_get.json().get("sha")
    except Exception as e:
        return False, f"GitHub check error: {e}"

    payload = {
        "message": f"feat(corpus): add {filename} via admin upload",
        "content": base64.b64encode(content_bytes).decode("utf-8"),
        "branch": branch
    }
    if sha:
        payload["sha"] = sha
        payload["message"] = f"feat(corpus): update {filename} via admin upload"

    try:
        r_put = requests.put(url, headers=headers, json=payload, timeout=15)
        if r_put.status_code in (200, 201):
            return True, f"Committed to GitHub ({repo}@{branch})"
        return False, f"GitHub error ({r_put.status_code})"
    except Exception as e:
        return False, f"GitHub commit error: {e}"

def _delete_from_github_repo(filename: str) -> tuple[bool, str]:
    token = settings.GITHUB_TOKEN.strip()
    repo = settings.GITHUB_REPO.strip()
    branch = settings.GITHUB_BRANCH.strip()
    if not token or not repo:
        return False, "GITHUB_TOKEN not set"

    import requests

    url = f"https://api.github.com/repos/{repo}/contents/backend/data/corpus/{filename}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

    try:
        r_get = requests.get(url, headers=headers, timeout=10)
        if r_get.status_code == 200:
            sha = r_get.json().get("sha")
            payload = {
                "message": f"chore(corpus): delete {filename} via admin",
                "sha": sha,
                "branch": branch
            }
            r_del = requests.delete(url, headers=headers, json=payload, timeout=15)
            if r_del.status_code in (200, 204):
                return True, f"Deleted from GitHub ({repo}@{branch})"
            return False, f"GitHub delete error ({r_del.status_code})"
        return False, "File not on GitHub"
    except Exception as e:
        return False, f"GitHub delete error: {e}"

@router.post("/admin/verify", response_model=AdminVerifyResponse)
def verify_admin(req: AdminVerifyRequest):
    if _check_admin(req.password):
        return AdminVerifyResponse(success=True, message="Admin authenticated successfully.")
    return AdminVerifyResponse(success=False, message="Incorrect admin password.")

@router.get("/stats", response_model=StatsResponse)
def get_stats():
    docs = load_corpus(settings.CORPUS_DIR)
    return StatsResponse(
        total_documents=len(docs),
        total_chunks=vector_store.total_vectors,
        vector_dimension=settings.EMBEDDING_DIMENSION,
        vector_store_type="FAISS IndexFlatIP (Exact Search)" if vector_store.is_faiss_available else "NumPy FlatIP Store",
        embedding_model=settings.EMBEDDING_MODEL,
        llm_model=settings.GROQ_MODEL,
        similarity_threshold=settings.SIMILARITY_THRESHOLD,
        chunk_size=settings.DEFAULT_CHUNK_SIZE,
        chunk_overlap=settings.DEFAULT_CHUNK_OVERLAP,
        default_k=settings.DEFAULT_K,
        faiss_available=vector_store.is_faiss_available,
        groq_configured=bool(settings.GROQ_API_KEY)
    )

@router.post("/query", response_model=QueryResponse)
def query_rag(req: QueryRequest):
    if vector_store.total_vectors == 0:
        docs = load_corpus(settings.CORPUS_DIR)
        if docs:
            rag_engine.reindex_all()
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No documents have been indexed yet."
            )

    result = rag_engine.query(
        question=req.question,
        k=req.k,
        use_hybrid=req.use_hybrid,
        compare_plain=req.compare_plain,
        model_name=req.model_name,
        session_id=req.session_id
    )
    return result

@router.get("/documents", response_model=DocumentListResponse)
def list_documents(
    x_session_id: Optional[str] = Header(None),
    x_admin_password: Optional[str] = Header(None)
):
    docs_info: List[DocumentInfo] = []
    is_admin = _check_admin(x_admin_password)

    # 1. Permanent documents
    if settings.CORPUS_DIR.exists():
        for p in sorted(settings.CORPUS_DIR.iterdir()):
            if p.is_file() and p.name not in {"README.md", ".gitkeep"}:
                stat = p.stat()
                mod_time = datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                docs_info.append(DocumentInfo(
                    filename=p.name,
                    char_count=stat.st_size,
                    size_kb=round(stat.st_size / 1024, 2),
                    last_modified=mod_time,
                    is_permanent=True
                ))

    # 2. Guest private temporary documents (only visible to this guest session)
    if x_session_id:
        session_docs = session_manager.list_session_documents(x_session_id)
        for d in session_docs:
            docs_info.append(DocumentInfo(
                filename=d["filename"],
                char_count=d["char_count"],
                size_kb=d["size_kb"],
                last_modified=d["last_modified"],
                is_permanent=False
            ))

    return DocumentListResponse(
        total_documents=len(docs_info),
        documents=docs_info,
        corpus_directory=str(settings.CORPUS_DIR.resolve()),
        is_admin=is_admin
    )

@router.post("/upload")
async def upload_documents(
    files: List[UploadFile] = File(...),
    admin_password: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None)
):
    """
    Upload endpoint:
    - If admin_password matches settings.ADMIN_PASSWORD: save permanently to corpus.
    - Otherwise: save into isolated temporary session for this visitor only.
    """
    saved_files = []
    errors = []
    is_admin = _check_admin(admin_password)

    if is_admin:
        # Permanent storage
        target_dir = settings.CORPUS_DIR
        github_sync = []
        for file in files:
            try:
                dest = target_dir / file.filename
                content_bytes = file.file.read()
                with open(dest, "wb") as buffer:
                    buffer.write(content_bytes)
                saved_files.append(file.filename)

                # Direct sync to GitHub repository if GITHUB_TOKEN is set
                if settings.GITHUB_TOKEN:
                    gh_ok, gh_msg = _commit_to_github_repo(file.filename, content_bytes)
                    github_sync.append({"file": file.filename, "synced": gh_ok, "details": gh_msg})
            except Exception as e:
                errors.append({"file": file.filename, "error": str(e)})

        reindex_result = rag_engine.reindex_all()
        msg = f"Admin: Added {len(saved_files)} file(s) permanently."
        if github_sync:
            msg += f" Synced {len([s for s in github_sync if s['synced']])} file(s) to GitHub repo."

        return {
            "status": "success",
            "is_permanent": True,
            "uploaded_files": saved_files,
            "github_sync": github_sync,
            "errors": errors,
            "reindex_result": reindex_result,
            "message": msg
        }
    else:
        # Temporary guest session storage
        if not session_id:
            session_id = datetime.datetime.now().strftime("guest_%Y%m%d_%H%M%S")

        corpus_dir = session_manager.get_session_corpus_dir(session_id)
        for file in files:
            try:
                dest = corpus_dir / file.filename
                with open(dest, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                saved_files.append(file.filename)
            except Exception as e:
                errors.append({"file": file.filename, "error": str(e)})

        session_reindex = session_manager.reindex_session(session_id)
        return {
            "status": "success",
            "is_permanent": False,
            "session_id": session_id,
            "uploaded_files": saved_files,
            "errors": errors,
            "reindex_result": session_reindex,
            "message": f"Temporary Session: Uploaded {len(saved_files)} private file(s). These are isolated only to you and deleted on exit."
        }

@router.delete("/documents/{filename}")
def delete_document(
    filename: str,
    x_admin_password: Optional[str] = Header(None),
    x_session_id: Optional[str] = Header(None),
    admin_password: Optional[str] = None
):
    actual_admin_pw = x_admin_password or admin_password

    # 1. Check if file belongs to guest session first
    if x_session_id and session_manager.delete_session_file(x_session_id, filename):
        return {"status": "success", "message": f"Deleted temporary file {filename} from your session."}

    # 2. Permanent file deletion requires ADMIN_PASSWORD
    if not _check_admin(actual_admin_pw):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Incorrect admin password. Permanent documents can only be deleted with the admin password."
        )

    # Record in persistent tombstone blacklist so it is never re-copied
    record_deleted_file(filename)

    deleted_any = False
    try:
        if target.exists():
            os.remove(target)
            deleted_any = True

        # Also remove from bundled corpus if writable
        bundled_target = settings.BUNDLED_CORPUS_DIR / filename
        if bundled_target.exists():
            try:
                os.remove(bundled_target)
                deleted_any = True
            except Exception:
                pass

        if settings.GITHUB_TOKEN:
            _delete_from_github_repo(filename)

        reindex_result = rag_engine.reindex_all()
        return {
            "status": "success",
            "message": f"Successfully deleted {filename} permanently from the knowledge base.",
            "reindex_result": reindex_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")

@router.post("/session/clear")
def clear_guest_session(session_id: str = Form(...)):
    """Called when guest exits or leaves to immediately wipe all private files."""
    session_manager.clear_session(session_id)
    return {"status": "success", "message": f"Session {session_id} purged."}

@router.post("/reindex", response_model=ReindexResponse)
def trigger_reindex(
    req: ReindexRequest = ReindexRequest(),
    x_admin_password: Optional[str] = Header(None)
):
    chunk_size = req.chunk_size or settings.DEFAULT_CHUNK_SIZE
    chunk_overlap = req.chunk_overlap or settings.DEFAULT_CHUNK_OVERLAP
    res = rag_engine.reindex_all(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    return ReindexResponse(**res)

@router.post("/settings")
def update_settings(req: ConfigUpdateRequest):
    if req.groq_model is not None:
        settings.GROQ_MODEL = req.groq_model.strip()
    if req.similarity_threshold is not None:
        settings.SIMILARITY_THRESHOLD = req.similarity_threshold
        rag_engine.threshold = req.similarity_threshold
    if req.chunk_size is not None:
        settings.DEFAULT_CHUNK_SIZE = req.chunk_size
    if req.chunk_overlap is not None:
        settings.DEFAULT_CHUNK_OVERLAP = req.chunk_overlap
    if req.k is not None:
        settings.DEFAULT_K = req.k

    return {
        "status": "success",
        "groq_model": settings.GROQ_MODEL,
        "similarity_threshold": settings.SIMILARITY_THRESHOLD,
        "chunk_size": settings.DEFAULT_CHUNK_SIZE,
        "chunk_overlap": settings.DEFAULT_CHUNK_OVERLAP,
        "default_k": settings.DEFAULT_K
    }
