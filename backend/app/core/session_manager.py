import os
import shutil
import pathlib
import time
from typing import List, Dict, Any, Optional
from ..config import settings
from .document_loader import load_corpus, load_document, LoadedDocument
from .chunker import recursive_chunk
from .embeddings import embedding_service
from .vector_store import FAISSVectorStore

class SessionManager:
    """
    Manages isolated, temporary guest sessions.
    Guest files are strictly scoped to their session_id and never bleed into
    the permanent corpus or other users' sessions.
    Files are completely deleted when the guest exits or clears their session.
    """
    def __init__(self, base_dir: pathlib.Path = settings.SESSIONS_DIR):
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.session_stores: Dict[str, FAISSVectorStore] = {}
        self.session_configs: Dict[str, Dict[str, Any]] = {}

    def get_session_corpus_dir(self, session_id: str) -> pathlib.Path:
        safe_id = "".join(c for c in session_id if c.isalnum() or c in "-_")
        path = self.base_dir / safe_id / "corpus"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def get_session_storage_dir(self, session_id: str) -> pathlib.Path:
        safe_id = "".join(c for c in session_id if c.isalnum() or c in "-_")
        path = self.base_dir / safe_id / "storage"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def get_session_store(self, session_id: str) -> FAISSVectorStore:
        if session_id not in self.session_stores:
            storage_dir = self.get_session_storage_dir(session_id)
            self.session_stores[session_id] = FAISSVectorStore(storage_dir=storage_dir)
        return self.session_stores[session_id]

    def reindex_session(self, session_id: str, chunk_size: Optional[int] = None, chunk_overlap: Optional[int] = None) -> Dict[str, Any]:
        """Index only this session's uploaded documents with custom or default chunk parameters."""
        if chunk_size is not None or chunk_overlap is not None:
            cfg = self.session_configs.get(session_id, {})
            if chunk_size is not None:
                cfg["chunk_size"] = chunk_size
            if chunk_overlap is not None:
                cfg["chunk_overlap"] = chunk_overlap
            self.session_configs[session_id] = cfg

        actual_chunk_size = self.session_configs.get(session_id, {}).get("chunk_size", settings.DEFAULT_CHUNK_SIZE)
        actual_chunk_overlap = self.session_configs.get(session_id, {}).get("chunk_overlap", settings.DEFAULT_CHUNK_OVERLAP)

        corpus_dir = self.get_session_corpus_dir(session_id)
        docs = load_corpus(corpus_dir)
        store = self.get_session_store(session_id)
        if not docs:
            store.build_index(embeddings=None, chunks=[], sources=[])
            return {
                "status": "success",
                "message": "No private documents in this session.",
                "total_docs": 0,
                "total_chunks": 0,
                "dimension": store.dimension
            }

        all_chunks: List[str] = []
        all_sources: List[str] = []
        for doc in docs:
            chunks = recursive_chunk(doc.text, chunk_size=actual_chunk_size, chunk_overlap=actual_chunk_overlap)
            for c in chunks:
                all_chunks.append(c)
                all_sources.append(f"[Private] {doc.filename}")

        embeddings = embedding_service.embed(all_chunks)
        store.build_index(embeddings, all_chunks, all_sources)

        return {
            "status": "success",
            "message": f"Successfully indexed {len(docs)} private document(s) into {len(all_chunks)} chunks for your session.",
            "total_docs": len(docs),
            "total_chunks": len(all_chunks),
            "dimension": store.dimension
        }

    def retrieve_chunks(self, session_id: str, question: str, k: int = 5) -> List[Dict[str, Any]]:
        """Retrieve chunks from the session's private index."""
        store = self.get_session_store(session_id)
        if store.total_vectors == 0:
            corpus_dir = self.get_session_corpus_dir(session_id)
            if any(corpus_dir.iterdir()):
                self.reindex_session(session_id)
                store = self.get_session_store(session_id)

        if store.total_vectors == 0:
            return []
        q_vec = embedding_service.embed([question])
        return store.search(q_vec, k=k)

    def list_session_documents(self, session_id: str) -> List[Dict[str, Any]]:
        corpus_dir = self.get_session_corpus_dir(session_id)
        docs = load_corpus(corpus_dir)
        out = []
        for d in docs:
            stat = d.filepath.stat()
            mod_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime))
            out.append({
                "filename": d.filename,
                "char_count": d.char_count,
                "size_kb": round(stat.st_size / 1024, 2),
                "last_modified": mod_time,
                "is_permanent": False
            })
        return out

    def delete_session_file(self, session_id: str, filename: str) -> bool:
        corpus_dir = self.get_session_corpus_dir(session_id)
        target = corpus_dir / filename
        if target.exists() and target.is_file():
            os.remove(target)
            self.reindex_session(session_id)
            return True
        return False

    def clear_session(self, session_id: str) -> bool:
        """Completely purge session directory and memory store."""
        safe_id = "".join(c for c in session_id if c.isalnum() or c in "-_")
        session_path = self.base_dir / safe_id
        if session_path.exists():
            shutil.rmtree(session_path, ignore_errors=True)
        if session_id in self.session_stores:
            del self.session_stores[session_id]
        return True

    def cleanup_expired_sessions(self, max_age_hours: int = 4):
        """Remove abandoned sessions older than max_age_hours."""
        now = time.time()
        for item in self.base_dir.iterdir():
            if item.is_dir():
                try:
                    mtime = item.stat().st_mtime
                    if now - mtime > (max_age_hours * 3600):
                        shutil.rmtree(item, ignore_errors=True)
                except Exception:
                    pass

session_manager = SessionManager()
