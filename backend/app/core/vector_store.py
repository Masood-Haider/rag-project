import os
import json
import pathlib
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from ..config import settings

class FAISSVectorStore:
    def __init__(self, storage_dir: pathlib.Path = settings.STORAGE_DIR, dimension: int = settings.EMBEDDING_DIMENSION):
        self.storage_dir = storage_dir
        self.dimension = dimension
        self.index_file = self.storage_dir / "rag.index"
        self.meta_file = self.storage_dir / "rag_metadata.json"
        
        self.index = None
        self.chunks: List[str] = []
        self.sources: List[str] = []
        self.raw_embeddings: Optional[np.ndarray] = None
        self.is_faiss_available = False

        self._check_faiss()
        self.load()

    def _check_faiss(self):
        try:
            import faiss
            self.faiss = faiss
            self.is_faiss_available = True
        except ImportError:
            self.faiss = None
            self.is_faiss_available = False
            print("FAISS is not installed. Using high-performance NumPy exact Cosine Matrix fallback.")

    def build_index(self, embeddings: np.ndarray, chunks: List[str], sources: List[str]):
        """
        Build and populate index.
        Normalizes vectors with L2 norm so Inner Product = Cosine Similarity.
        """
        if len(chunks) == 0:
            self.chunks = []
            self.sources = []
            self.raw_embeddings = None
            self.index = None
            return

        self.chunks = chunks
        self.sources = sources
        self.raw_embeddings = embeddings.copy()

        # Normalize L2
        if self.is_faiss_available:
            self.faiss.normalize_L2(embeddings)
            self.index = self.faiss.IndexFlatIP(self.dimension)
            self.index.add(embeddings)
        else:
            # Normalize with numpy
            norms = np.linalg.norm(self.raw_embeddings, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            self.raw_embeddings = (self.raw_embeddings / norms).astype("float32")

        self.save()

    def save(self):
        """Save FAISS index and metadata to disk."""
        self.storage_dir.mkdir(parents=True, exist_ok=True)

        if self.is_faiss_available and self.index is not None:
            self.faiss.write_index(self.index, str(self.index_file))
        elif self.raw_embeddings is not None:
            np.save(str(self.storage_dir / "embeddings.npy"), self.raw_embeddings)

        # Save metadata
        metadata = {
            "chunks": self.chunks,
            "sources": self.sources,
            "total_chunks": len(self.chunks),
            "dimension": self.dimension
        }
        with open(self.meta_file, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

    def load(self) -> bool:
        """Load index and metadata from disk if available."""
        if not self.meta_file.exists():
            return False

        try:
            with open(self.meta_file, "r", encoding="utf-8") as f:
                metadata = json.load(f)
            self.chunks = metadata.get("chunks", [])
            self.sources = metadata.get("sources", [])

            if self.is_faiss_available and self.index_file.exists():
                self.index = self.faiss.read_index(str(self.index_file))
                print(f"Loaded FAISS index with {self.index.ntotal} vectors.")
                return True
            
            npy_path = self.storage_dir / "embeddings.npy"
            if npy_path.exists():
                self.raw_embeddings = np.load(str(npy_path))
                print(f"Loaded NumPy vector store with {len(self.chunks)} chunks.")
                return True

        except Exception as e:
            print(f"Error loading vector index: {e}")
            return False

        return False

    def search(self, query_vec: np.ndarray, k: int = 5) -> List[Dict[str, Any]]:
        """
        Search for top-k closest chunks to query_vec.
        Returns list of dicts: [{'score': float, 'source': str, 'chunk': str, 'id': int}]
        """
        if len(self.chunks) == 0:
            return []

        k = min(k, len(self.chunks))
        if k <= 0:
            return []

        # Ensure query is 2D float32
        q = np.array(query_vec, dtype="float32")
        if q.ndim == 1:
            q = np.expand_dims(q, axis=0)

        results = []

        if self.is_faiss_available and self.index is not None:
            self.faiss.normalize_L2(q)
            scores, ids = self.index.search(q, k)
            for i in range(k):
                idx = int(ids[0][i])
                if idx >= 0 and idx < len(self.chunks):
                    results.append({
                        "id": idx,
                        "score": float(scores[0][i]),
                        "source": self.sources[idx],
                        "chunk": self.chunks[idx]
                    })
        else:
            # NumPy exact dot-product search
            norms = np.linalg.norm(q, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            q_norm = q / norms
            scores = np.dot(self.raw_embeddings, q_norm.T).flatten()
            top_indices = np.argsort(scores)[::-1][:k]
            for idx in top_indices:
                results.append({
                    "id": int(idx),
                    "score": float(scores[idx]),
                    "source": self.sources[idx],
                    "chunk": self.chunks[idx]
                })

        return results

    @property
    def total_vectors(self) -> int:
        if self.is_faiss_available and self.index is not None:
            return self.index.ntotal
        return len(self.chunks)

vector_store = FAISSVectorStore()
