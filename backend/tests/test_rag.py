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
    docs = load_corpus(settings.CORPUS_DIR)
    assert len(docs) >= 1
    assert any("sample_course_notes.txt" in d.filename for d in docs)

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
