from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class ChunkHit(BaseModel):
    id: int
    score: float
    semantic_score: Optional[float] = None
    keyword_score: Optional[float] = None
    source: str
    chunk: str

class QueryRequest(BaseModel):
    question: str = Field(..., example="What is precision?")
    k: int = Field(5, ge=1, le=20, description="Top-k chunks to retrieve")
    use_hybrid: bool = Field(False, description="Combine semantic search with TF-IDF keyword search")
    compare_plain: bool = Field(True, description="Also generate answer without RAG context for side-by-side comparison")
    model_name: Optional[str] = Field(None, description="Groq model identifier")
    session_id: Optional[str] = Field(None, description="Private guest session ID for temporary files")

class QueryResponse(BaseModel):
    question: str
    answer: str
    answer_without_rag: Optional[str] = None
    sources: List[str]
    retrieved_chunks: List[ChunkHit]
    top_score: float
    threshold: float
    is_low_confidence: bool
    warning: Optional[str] = None
    retrieval_mode: str
    model_used: str

class ReindexRequest(BaseModel):
    chunk_size: Optional[int] = 300
    chunk_overlap: Optional[int] = 50
    session_id: Optional[str] = None

class ReindexResponse(BaseModel):
    status: str
    message: str
    total_docs: int
    total_chunks: int
    dimension: Optional[int] = 384

class DocumentInfo(BaseModel):
    filename: str
    char_count: int
    size_kb: float
    last_modified: str
    is_permanent: bool = True

class DocumentListResponse(BaseModel):
    total_documents: int
    documents: List[DocumentInfo]
    corpus_directory: str
    is_admin: bool = False

class StatsResponse(BaseModel):
    total_documents: int
    total_chunks: int
    vector_dimension: int
    vector_store_type: str
    embedding_model: str
    llm_model: str
    similarity_threshold: float
    chunk_size: int = 300
    chunk_overlap: int = 50
    default_k: int = 5
    faiss_available: bool
    groq_configured: bool
    github_sync_configured: bool = False
    github_repo: Optional[str] = "Masood-Haider/rag-project"

class ConfigUpdateRequest(BaseModel):
    groq_model: Optional[str] = None
    similarity_threshold: Optional[float] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None
    k: Optional[int] = None
    session_id: Optional[str] = None
    github_token: Optional[str] = None

class AdminVerifyRequest(BaseModel):
    password: str

class AdminVerifyResponse(BaseModel):
    success: bool
    message: str
