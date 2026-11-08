import numpy as np
from pathlib import Path
import sys

# Ensure backend root is in sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from app.core.chunker import recursive_chunk
from app.core.embeddings import embedding_service
from app.core.vector_store import FAISSVectorStore
from app.core.document_loader import load_corpus
from app.config import settings

def test_recursive_chunk_basic():
    text = "First sentence here. Second sentence here.\n\nNew paragraph starts here. It keeps going for a while."
    chunks = recursive_chunk(text, chunk_size=60, chunk_overlap=10)
    assert len(chunks) > 0
    assert all(isinstance(c, str) for c in chunks)
    assert all(len(c) > 0 for c in chunks)

def test_recursive_chunk_empty():
    assert recursive_chunk("") == []
    assert recursive_chunk("   ") == []

def test_embedding_shape():
    texts = ["Machine learning is great.", "Vector databases search fast."]
    embs = embedding_service.embed(texts)
    assert embs.shape == (2, 384)
    assert embs.dtype == np.float32

def test_vector_store_in_memory():
    store = FAISSVectorStore(storage_dir=settings.STORAGE_DIR / "test_store", dimension=384)
    chunks = ["Precision measures positive predictive value.", "Recall measures true positive rate."]
    sources = ["doc1.txt", "doc2.txt"]
    
    embs = embedding_service.embed(chunks)
    store.build_index(embs, chunks, sources)
    
    assert store.total_vectors == 2
    
    # Query search
    q_emb = embedding_service.embed(["What is precision?"])
    hits = store.search(q_emb, k=1)
    assert len(hits) == 1
    assert "Precision" in hits[0]["chunk"]

def test_document_loader():
    from app.core.document_loader import load_document
    test_dir = settings.BACKEND_DIR / "data" / "test_corpus"
    test_dir.mkdir(parents=True, exist_ok=True)
    test_file = test_dir / "test_doc.txt"
    test_file.write_text("Machine learning evaluation metrics include precision, recall, and F1 score.", encoding="utf-8")
    try:
        doc = load_document(test_file)
        assert doc is not None
        assert doc.filename == "test_doc.txt"
        assert "precision" in doc.text
        assert doc.char_count > 0

        docs = load_corpus(test_dir)
        assert len(docs) >= 1
        assert any(d.filename == "test_doc.txt" for d in docs)
    finally:
        import shutil
        shutil.rmtree(test_dir, ignore_errors=True)

def test_docx_extractor():
    from app.core.document_loader import extract_text_from_docx
    assert extract_text_from_docx(Path("missing_file.docx")) == ""

def test_fastapi_health_endpoint():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_fastapi_stats_endpoint():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    response = client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_chunks" in data
    assert "similarity_threshold" in data

def test_settings_admin_vs_guest():
    from fastapi.testclient import TestClient
    from app.main import app
    from app.config import settings

    client = TestClient(app)
    orig_chunk_size = settings.DEFAULT_CHUNK_SIZE
    orig_admin_pw = settings.ADMIN_PASSWORD

    try:
        # Explicit test password ensures CI passes even when .env is absent
        settings.ADMIN_PASSWORD = "ci_test_admin_pw_1112"

        # 1. Guest update: should NOT modify global settings
        guest_res = client.post("/api/settings", json={"chunk_size": 280, "chunk_overlap": 30, "session_id": "test_guest_session"})
        assert guest_res.status_code == 200
        guest_data = guest_res.json()
        assert guest_data["is_admin"] is False
        assert guest_data["chunk_size"] == 280
        assert settings.DEFAULT_CHUNK_SIZE == orig_chunk_size

        # 2. Admin update: SHOULD modify global settings
        admin_res = client.post(
            "/api/settings",
            json={"chunk_size": 320, "chunk_overlap": 40},
            headers={"x-admin-password": "ci_test_admin_pw_1112"}
        )
        assert admin_res.status_code == 200
        admin_data = admin_res.json()
        assert admin_data["is_admin"] is True
        assert admin_data["chunk_size"] == 320
        assert settings.DEFAULT_CHUNK_SIZE == 320
    finally:
        # Restore defaults
        settings.DEFAULT_CHUNK_SIZE = orig_chunk_size
        settings.ADMIN_PASSWORD = orig_admin_pw

