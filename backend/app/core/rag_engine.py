from typing import List, Dict, Any, Optional
import os
import requests
from ..config import settings
from .chunker import recursive_chunk
from .document_loader import load_corpus
from .embeddings import embedding_service
from .vector_store import vector_store
from .hybrid_retriever import hybrid_retriever

class RAGEngine:
    def __init__(self):
        self.default_model = settings.GROQ_MODEL if settings.LLM_PROVIDER == "groq" else settings.DEFAULT_LLM_MODEL
        self.threshold = settings.SIMILARITY_THRESHOLD
        self.groq_client = None
        self.hf_client = None
        self._init_llm_clients()

    def _init_llm_clients(self):
        """Initialize Groq and Hugging Face clients."""
        # 1. Groq Client
        if settings.GROQ_API_KEY:
            try:
                from groq import Groq
                self.groq_client = Groq(api_key=settings.GROQ_API_KEY)
                print(f"Groq client initialized with model: {settings.GROQ_MODEL}")
            except Exception as e:
                print(f"Could not load groq SDK ({e}), will use direct REST requests.")
                self.groq_client = "rest"

        # 2. Hugging Face Client
        if settings.HF_TOKEN:
            try:
                from huggingface_hub import InferenceClient
                self.hf_client = InferenceClient(api_key=settings.HF_TOKEN)
            except Exception as e:
                print(f"Could not initialize HF client: {e}")

    def reindex_all(self, chunk_size: int = settings.DEFAULT_CHUNK_SIZE, chunk_overlap: int = settings.DEFAULT_CHUNK_OVERLAP) -> Dict[str, Any]:
        """Ingest all documents in corpus, chunk, embed, and update FAISS index."""
        docs = load_corpus(settings.CORPUS_DIR)
        if not docs:
            return {
                "status": "warning",
                "message": "No documents found in corpus directory.",
                "total_docs": 0,
                "total_chunks": 0
            }

        all_chunks: List[str] = []
        all_sources: List[str] = []

        for doc in docs:
            doc_chunks = recursive_chunk(doc.text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
            for c in doc_chunks:
                all_chunks.append(c)
                all_sources.append(doc.filename)

        if not all_chunks:
            return {
                "status": "warning",
                "message": "Documents were loaded but yielded zero text chunks.",
                "total_docs": len(docs),
                "total_chunks": 0
            }

        embeddings = embedding_service.embed(all_chunks)
        vector_store.build_index(embeddings, all_chunks, all_sources)
        hybrid_retriever.update_corpus()

        return {
            "status": "success",
            "message": f"Successfully indexed {len(docs)} documents into {len(all_chunks)} chunks.",
            "total_docs": len(docs),
            "total_chunks": len(all_chunks),
            "dimension": vector_store.dimension
        }

    def retrieve_chunks(self, question: str, k: int = settings.DEFAULT_K, use_hybrid: bool = False) -> List[Dict[str, Any]]:
        """Retrieve relevant context chunks via Semantic FAISS or Hybrid."""
        if use_hybrid:
            return hybrid_retriever.retrieve(question, k=k)
        
        q_vec = embedding_service.embed([question])
        return vector_store.search(q_vec, k=k)

    def build_prompt(self, question: str, hits: List[Dict[str, Any]]) -> str:
        """Construct the grounded augmented prompt."""
        context = ""
        for i, hit in enumerate(hits, start=1):
            context += f"\n[Source {i}: {hit['source']}]\n{hit['chunk']}\n"

        prompt = (
            "Answer the question using ONLY the context below. "
            'If the answer is not in the context, say "I do not know". '
            "Do not guess. Cite the source file for each fact you use.\n"
            f"\nContext:{context}"
            f"\nQuestion: {question}\nAnswer:"
        )
        return prompt

    def _generate_with_groq(self, prompt: str, model_name: Optional[str] = None, temperature: float = settings.TEMPERATURE) -> str:
        """Call Groq API using free tier models."""
        model = model_name or settings.GROQ_MODEL or "llama-3.3-70b-versatile"
        
        # 1. Via Groq Python SDK
        if self.groq_client and self.groq_client != "rest":
            try:
                chat_completion = self.groq_client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": "You are a grounded RAG assistant. Rely strictly on provided context."},
                        {"role": "user", "content": prompt}
                    ],
                    model=model,
                    temperature=temperature,
                    max_tokens=800,
                )
                return chat_completion.choices[0].message.content.strip()
            except Exception as e:
                print(f"Groq SDK call failed: {e}, falling back to REST endpoint...")

        # 2. Via Groq Direct REST API
        if settings.GROQ_API_KEY:
            try:
                url = "https://api.groq.com/openai/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "You are a grounded RAG assistant. Rely strictly on provided context."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": temperature,
                    "max_tokens": 800
                }
                res = requests.post(url, headers=headers, json=payload, timeout=30)
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"].strip()
                else:
                    return f"[Groq API Error {res.status_code}]: {res.text}"
            except Exception as e:
                return f"[Groq Connection Error]: {str(e)}"

        return (
            "[Groq API Key Required]\n"
            "Please add your free Groq API key in the backend/.env file (GROQ_API_KEY=gsk_...) or in the Web Settings.\n"
            "You can get a 100% free API key instantly at: https://console.groq.com/keys"
        )

    def _generate_with_hf(self, prompt: str, model_name: Optional[str] = None, temperature: float = settings.TEMPERATURE) -> str:
        """Call Hugging Face Inference API."""
        model = model_name or settings.DEFAULT_LLM_MODEL
        if self.hf_client is not None:
            try:
                response = self.hf_client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=600,
                    temperature=temperature
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                return f"[HF Generation Error from {model}]: {str(e)}"

        return "[HF_TOKEN not set] Please configure HF_TOKEN or GROQ_API_KEY."

    def generate_llm_response(self, prompt: str, model_name: Optional[str] = None, temperature: float = settings.TEMPERATURE) -> str:
        """Route generation to Groq (default) or Hugging Face."""
        if settings.LLM_PROVIDER == "groq" or settings.GROQ_API_KEY:
            return self._generate_with_groq(prompt, model_name=model_name, temperature=temperature)
        elif settings.HF_TOKEN:
            return self._generate_with_hf(prompt, model_name=model_name, temperature=temperature)
        else:
            return (
                "Groq API Key is not set yet.\n\n"
                "To generate live answers with the free Groq model (`llama-3.3-70b-versatile`), "
                "paste your API key into `backend/.env` under `GROQ_API_KEY=` or open the Settings modal in the web app.\n\n"
                "Get your free Groq API key at: https://console.groq.com/keys"
            )

    def query(self, question: str, k: int = settings.DEFAULT_K, use_hybrid: bool = False, compare_plain: bool = False, model_name: Optional[str] = None) -> Dict[str, Any]:
        """Execute full RAG pipeline."""
        hits = self.retrieve_chunks(question, k=k, use_hybrid=use_hybrid)
        
        top_score = hits[0]["score"] if hits else 0.0
        is_low_confidence = top_score < self.threshold

        augmented_prompt = self.build_prompt(question, hits)
        answer_with_rag = self.generate_llm_response(augmented_prompt, model_name=model_name)

        answer_without_rag = None
        if compare_plain:
            answer_without_rag = self.generate_llm_response(question, model_name=model_name)

        active_model = model_name or (settings.GROQ_MODEL if settings.LLM_PROVIDER == "groq" else settings.DEFAULT_LLM_MODEL)

        return {
            "question": question,
            "answer": answer_with_rag,
            "answer_without_rag": answer_without_rag,
            "sources": list({h["source"] for h in hits}),
            "retrieved_chunks": hits,
            "top_score": round(top_score, 4),
            "threshold": self.threshold,
            "is_low_confidence": is_low_confidence,
            "warning": "Top score is below confidence threshold (0.40). The documents may not contain the answer." if is_low_confidence else None,
            "retrieval_mode": "hybrid" if use_hybrid else "semantic_faiss",
            "model_used": active_model,
            "llm_provider": settings.LLM_PROVIDER
        }

rag_engine = RAGEngine()
