import os
import json
import numpy as np
from typing import List
import requests
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
        """Determine whether to use local transformers, sentence-transformers, or HF API."""
        if settings.EMBEDDING_PROVIDER == "hf_api":
            self._mode = "hf_api"
            return

        # Attempt to load local transformers / sentence-transformers
        try:
            from transformers import AutoTokenizer, AutoModel
            import torch
            print(f"Loading local embedding model: {self.model_name}...")
            self._local_tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self._local_model = AutoModel.from_pretrained(self.model_name)
            self._local_model.eval()
            self._mode = "local_transformers"
            print("Local embedding model loaded successfully.")
            return
        except Exception as e:
            print(f"Local transformer model not loaded ({e}). Checking fallback options...")

        # Fallback to sentence_transformers if available
        try:
            from sentence_transformers import SentenceTransformer
            print(f"Loading SentenceTransformer: {self.model_name}...")
            self._local_model = SentenceTransformer(self.model_name)
            self._mode = "sentence_transformers"
            return
        except Exception:
            pass

        # If HF_TOKEN is present or provider auto, fallback to Hugging Face Inference API
        if settings.HF_TOKEN:
            self._mode = "hf_api"
            print("Using Hugging Face Inference API for embeddings.")
        else:
            self._mode = "synthetic_fallback"
            print("WARNING: Neither torch/transformers nor HF_TOKEN found. Using local feature extractor fallback.")

    def embed(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """
        Embed a list of text strings into (N, 384) numpy float32 vectors.
        Uses exact mean-pooling logic from notebook Cell 10 when running locally.
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

        elif self._mode == "hf_api":
            return self._embed_via_hf_api(texts)

        else:
            return self._synthetic_embed(texts)

    def _embed_via_hf_api(self, texts: List[str]) -> np.ndarray:
        """Call Hugging Face Inference API feature extraction."""
        api_url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{self.model_name}"
        headers = {"Authorization": f"Bearer {settings.HF_TOKEN}"}
        
        vectors = []
        batch_size = 16
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            try:
                response = requests.post(api_url, headers=headers, json={"inputs": batch, "options": {"wait_for_model": True}}, timeout=30)
                if response.status_code == 200:
                    batch_vecs = response.json()
                    # Some endpoints return 3D (tokens), average them
                    arr = np.array(batch_vecs)
                    if arr.ndim == 3:
                        arr = arr.mean(axis=1)
                    vectors.append(arr)
                else:
                    print(f"HF API Error ({response.status_code}): {response.text}")
                    vectors.append(self._synthetic_embed(batch))
            except Exception as e:
                print(f"HF API request failed: {e}")
                vectors.append(self._synthetic_embed(batch))

        return np.vstack(vectors).astype("float32")

    def _synthetic_embed(self, texts: List[str]) -> np.ndarray:
        """
        Lightweight deterministic fallback using TF-IDF / term hashing.
        Guarantees system remains runnable even before downloading models or setting tokens.
        """
        from sklearn.feature_extraction.text import HashingVectorizer
        hv = HashingVectorizer(n_features=self.dimension, alternate_sign=False)
        dense = hv.fit_transform(texts).toarray()
        # Normalize
        norms = np.linalg.norm(dense, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return (dense / norms).astype("float32")

embedding_service = EmbeddingService()

