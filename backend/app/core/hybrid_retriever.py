import math
import re
from collections import Counter
from typing import List, Dict, Any, Optional
import numpy as np
from .vector_store import vector_store
from .embeddings import embedding_service

class LightweightTFIDF:
    """
    Ultra-lightweight, pure-Python TF-IDF index.
    Zero external dependencies on scikit-learn or scipy (fits easily in Vercel Serverless limit).
    """
    def __init__(self):
        self.doc_count: int = 0
        self.doc_freqs: Counter = Counter()
        self.doc_tfs: List[Counter] = []
        self._token_pattern = re.compile(r"(?u)\b\w\w+\b")

    def fit(self, docs: List[str]):
        self.doc_count = len(docs)
        self.doc_freqs = Counter()
        self.doc_tfs = []
        for d in docs:
            tokens = [w.lower() for w in self._token_pattern.findall(d)]
            tf = Counter(tokens)
            self.doc_tfs.append(tf)
            for w in set(tokens):
                self.doc_freqs[w] += 1

    def score(self, query: str) -> List[float]:
        if self.doc_count == 0:
            return []
        q_tokens = [w.lower() for w in self._token_pattern.findall(query)]
        scores = [0.0] * self.doc_count
        for i, tf in enumerate(self.doc_tfs):
            s = 0.0
            for t in q_tokens:
                if t in tf:
                    idf = math.log((1 + self.doc_count) / (1 + self.doc_freqs[t])) + 1.0
                    s += tf[t] * idf
            scores[i] = s
        return scores

class HybridRetriever:
    """
    Hybrid Retriever combining:
    1. Semantic Search (FAISS/NumPy dense vectors)
    2. Keyword Search (Lightweight TF-IDF sparse matching)
    
    Addresses semantic search limitations on numbers, IDs, and exact keyword matches.
    """
    def __init__(self):
        self.tfidf = LightweightTFIDF()
        self._init_tfidf()

    def _init_tfidf(self):
        if len(vector_store.chunks) > 0:
            try:
                self.tfidf.fit(vector_store.chunks)
            except Exception as e:
                print(f"Error initializing TF-IDF for hybrid search: {e}")

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

        # 1. Semantic retrieval with FAISS/NumPy
        q_vec = embedding_service.embed([question])
        sem_hits = vector_store.search(q_vec, k=candidates)
        sem_scores = {hit["id"]: hit["score"] for hit in sem_hits}

        # 2. Keyword retrieval with Lightweight TF-IDF
        raw_key_scores = self.tfidf.score(question)
        key_scores: Dict[int, float] = {}
        if raw_key_scores:
            scored_indices = sorted(range(len(raw_key_scores)), key=lambda i: raw_key_scores[i], reverse=True)[:candidates]
            key_scores = {i: raw_key_scores[i] for i in scored_indices if raw_key_scores[i] > 0}

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

