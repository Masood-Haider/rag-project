from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from .vector_store import vector_store
from .embeddings import embedding_service

class HybridRetriever:
    """
    Hybrid Retriever combining:
    1. Semantic Search (FAISS dense vectors with all-MiniLM-L6-v2)
    2. Keyword Search (TF-IDF sparse matrices with scikit-learn)
    
    Addresses semantic search limitations on numbers, IDs, and exact keyword matches.
    """
    def __init__(self):
        self.tfidf_vectorizer: Optional[TfidfVectorizer] = None
        self.tfidf_matrix = None
        self._init_tfidf()

    def _init_tfidf(self):
        if len(vector_store.chunks) > 0:
            try:
                self.tfidf_vectorizer = TfidfVectorizer(stop_words="english")
                self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(vector_store.chunks)
            except Exception as e:
                print(f"Error initializing TF-IDF for hybrid search: {e}")
                self.tfidf_vectorizer = None
                self.tfidf_matrix = None

    def update_corpus(self):
        """Called when new documents are added or re-indexed."""
        self._init_tfidf()

    def retrieve(self, question: str, k: int = 5, candidates: int = 20) -> List[Dict[str, Any]]:
        """
        Hybrid retrieval combining semantic and keyword scores.
        """
        if len(vector_store.chunks) == 0:
            return []

        candidates = min(candidates, len(vector_store.chunks))
        k = min(k, len(vector_store.chunks))

        # 1. Semantic retrieval with FAISS
        q_vec = embedding_service.embed([question])
        sem_hits = vector_store.search(q_vec, k=candidates)
        sem_scores = {hit["id"]: hit["score"] for hit in sem_hits}

        # 2. Keyword retrieval with TF-IDF
        key_scores: Dict[int, float] = {}
        if self.tfidf_vectorizer is not None and self.tfidf_matrix is not None:
            try:
                q_tfidf = self.tfidf_vectorizer.transform([question])
                scores_array = (q_tfidf @ self.tfidf_matrix.T).toarray()[0]
                top_key_ids = scores_array.argsort()[::-1][:candidates]
                key_scores = {int(idx): float(scores_array[idx]) for idx in top_key_ids if scores_array[idx] > 0}
            except Exception as e:
                print(f"TF-IDF search error: {e}")

        # 3. Score normalization and combination
        combined: Dict[int, float] = {}
        for idx, score in sem_scores.items():
            combined[idx] = combined.get(idx, 0.0) + score

        max_key = max(key_scores.values()) if key_scores else 1.0
        if max_key > 0:
            for idx, score in key_scores.items():
                combined[idx] = combined.get(idx, 0.0) + (score / max_key)

        ranked = sorted(combined.items(), key=lambda x: x[1], reverse=True)[:k]

        results = []
        for idx, score in ranked:
            results.append({
                "id": idx,
                "score": float(score),
                "semantic_score": sem_scores.get(idx, 0.0),
                "keyword_score": key_scores.get(idx, 0.0),
                "source": vector_store.sources[idx],
                "chunk": vector_store.chunks[idx]
            })

        return results

hybrid_retriever = HybridRetriever()
