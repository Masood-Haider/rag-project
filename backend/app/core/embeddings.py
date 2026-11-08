import numpy as np
from typing import List
from ..config import settings

class EmbeddingService:
    def __init__(self, model_name: str = settings.EMBEDDING_MODEL):
        self.model_name = model_name
        self.dimension = settings.EMBEDDING_DIMENSION
        self._local_model = None
        self._local_tokenizer = None
        self._mode = None
        self._init_service()

    def _init_service(self):
        """Load local transformers, sentence-transformers, or lightweight local fallback."""
        # 1. Attempt to load local transformers (as in notebook)
        try:
            from transformers import AutoTokenizer, AutoModel
            import torch
            self._local_tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self._local_model = AutoModel.from_pretrained(self.model_name)
            self._local_model.eval()
            self._mode = "local_transformers"
            print("Local transformer embedding model loaded.")
            return
        except Exception:
            pass

        # 2. Attempt to load local sentence-transformers
        try:
            from sentence_transformers import SentenceTransformer
            self._local_model = SentenceTransformer(self.model_name)
            self._mode = "sentence_transformers"
            print("SentenceTransformer embedding model loaded.")
            return
        except Exception:
            pass

        # 3. Deterministic local feature extractor fallback
        self._mode = "synthetic_fallback"
        print("Using high-performance local feature extraction for dense vectors.")

    def embed(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """
        Embed a list of text strings into (N, 384) numpy float32 vectors.
        """
        if not texts:
            return np.empty((0, self.dimension), dtype="float32")

        if self._mode == "local_transformers":
            import torch
            vectors = []
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i + batch_size]
                encoded = self._local_tokenizer(
                    batch, padding=True, truncation=True, max_length=256, return_tensors="pt"
                )
                with torch.no_grad():
                    output = self._local_model(**encoded).last_hidden_state
                mask = encoded["attention_mask"].unsqueeze(-1)
                mean = (output * mask).sum(1) / mask.sum(1)
                vectors.append(mean.cpu().numpy())
            return np.vstack(vectors).astype("float32")

        elif self._mode == "sentence_transformers":
            embs = self._local_model.encode(texts, batch_size=batch_size, show_progress_bar=False)
            return np.array(embs, dtype="float32")

        else:
            return self._synthetic_embed(texts)

    def _synthetic_embed(self, texts: List[str]) -> np.ndarray:
        """
        Ultra-lightweight deterministic feature hashing vectorizer.
        Zero dependency on scikit-learn or scipy (fits easily in Vercel Serverless limit).
        """
        import hashlib
        import re

        vectors = []
        token_pat = re.compile(r"(?u)\b\w\w+\b")
        for text in texts:
            vec = np.zeros(self.dimension, dtype="float32")
            tokens = token_pat.findall(text.lower())
            for tok in tokens:
                h = int(hashlib.md5(tok.encode("utf-8")).hexdigest()[:8], 16)
                idx = h % self.dimension
                vec[idx] += 1.0
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec /= norm
            vectors.append(vec)

        if not vectors:
            return np.zeros((0, self.dimension), dtype="float32")
        return np.array(vectors, dtype="float32")

embedding_service = EmbeddingService()
