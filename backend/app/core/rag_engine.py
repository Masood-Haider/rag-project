from typing import List, Dict, Any, Optional, Tuple
import os
from ..config import settings
from .chunker import recursive_chunk
from .document_loader import load_corpus, load_document
from .embeddings import embedding_service
from .vector_store import vector_store
from .hybrid_retriever import hybrid_retriever

class RAGEngine:
    def __init__(self):
        self.default_model = settings.DEFAULT_LLM_MODEL
        self.threshold = settings.SIMILARITY_THRESHOLD
        self._init_llm_client()

    def _init_llm_client(self):
        self.client = None
        if settings.HF_TOKEN:
            try:
                from huggingface_hub import InferenceClient
                self.client = InferenceClient(api_key=settings.HF_TOKEN)
                print(f"Hugging Face InferenceClient initialized for model {self.default_model}")
            except Exception as e:
                print(f"Could not initialize HF InferenceClient: {e}")

    def reindex_all(self, chunk_size: int = settings.DEFAULT_CHUNK_SIZE, chunk_overlap: int = settings.DEFAULT_CHUNK_OVERLAP) -> Dict[str, Any]:
        """
        Full ingestion pipeline:
        1. Reads all documents in backend/data/corpus
        2. Chunks recursively
        3. Generates embeddings
        4. Builds & persists FAISS vector index
        5. Updates TF-IDF hybrid search matrix
        """
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

        # Embed all chunks
        embeddings = embedding_service.embed(all_chunks)

        # Store in FAISS
        vector_store.build_index(embeddings, all_chunks, all_sources)

        # Update hybrid retriever
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

    def generate_llm_response(self, prompt: str, model_name: Optional[str] = None, temperature: float = settings.TEMPERATURE) -> str:
        """Call DeepSeek or configured model on Hugging Face Inference API."""
        model = model_name or self.default_model

        if self.client is None and settings.HF_TOKEN:
            self._init_llm_client()

        if self.client is not None:
            try:
                response = self.client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=600,
                    temperature=temperature
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                return f"[Generation Error from {model}]: {str(e)}. (Check if HF_TOKEN is valid and has access to {model})."

        return (
            "[Mock Generation / Grounding Preview]\n"
            "HF_TOKEN is not currently configured in backend/.env. "
            "To generate live DeepSeek answers, add your Hugging Face token in Settings or backend/.env file.\n\n"
            f"Grounding context successfully retrieved and formatted above!"
        )

    def query(self, question: str, k: int = settings.DEFAULT_K, use_hybrid: bool = False, compare_plain: bool = False, model_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Execute full RAG pipeline:
        1. Retrieval (Semantic or Hybrid)
        2. Honest score evaluation (checks against 0.40 threshold)
        3. Augmented Prompt building
        4. Generation with DeepSeek
        5. Optional Plain comparison (without context)
        """
        hits = self.retrieve_chunks(question, k=k, use_hybrid=use_hybrid)
        
        top_score = hits[0]["score"] if hits else 0.0
        is_low_confidence = top_score < self.threshold

        augmented_prompt = self.build_prompt(question, hits)
        answer_with_rag = self.generate_llm_response(augmented_prompt, model_name=model_name)

        answer_without_rag = None
        if compare_plain:
            # Plain query with no retrieved context
            answer_without_rag = self.generate_llm_response(question, model_name=model_name)

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
            "model_used": model_name or self.default_model
        }

rag_engine = RAGEngine()
