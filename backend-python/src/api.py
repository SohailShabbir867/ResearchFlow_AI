"""
FastAPI REST API for MedResearch AI RAG Service.
Upgraded with new /documents endpoint and Groq-specific error handling.
"""
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.rag_pipeline import answer
from src.vector_store import get_collection_info, get_indexed_sources
from src.hybrid_search import rebuild_bm25_index

app = FastAPI(
    title="MedResearch AI — Upgraded RAG Service",
    description="Hybrid search + reranking + Groq LLM (llama-3.3-70b-versatile)",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


class QueryRequest(BaseModel):
    question: str
    top_k: int = 5


class QueryResponse(BaseModel):
    answer: str
    sources: list[str]


# ─── Health ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    info = get_collection_info()
    return {
        "status": "ok",
        "service": "medresearch-python",
        "version": "2.0.0",
        "pipeline": "FastEmbed (local) → Hybrid Search → Reranker → Groq 70b",
        "collection": info
    }


# ─── Documents ──────────────────────────────────────────────────────────────

@app.get("/documents")
def list_documents():
    """List all indexed document sources."""
    sources = get_indexed_sources()
    info = get_collection_info()
    return {
        "documents": sources,
        "total_chunks": info.get("points_count", 0)
    }


# ─── Query ──────────────────────────────────────────────────────────────────

@app.post("/query", response_model=QueryResponse)
def query(request: QueryRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        result = answer(request.question, top_k=request.top_k)
    except Exception as e:
        error_msg = str(e)

        if "GROQ_API_KEY not set" in error_msg:
            raise HTTPException(
                status_code=503,
                detail="Groq API key not configured. Set GROQ_API_KEY in backend-python/.env"
            )
        if "rate_limit" in error_msg.lower():
            raise HTTPException(
                status_code=429,
                detail="Groq rate limit reached. Please wait a moment and try again."
            )
        if "model_decommissioned" in error_msg:
            raise HTTPException(
                status_code=502,
                detail="Groq model is decommissioned. Update GROQ_MODEL in .env"
            )
        if "No relevant documents" in error_msg:
            raise HTTPException(
                status_code=404,
                detail="No documents indexed. Run: venv\\Scripts\\python scripts/index_documents.py"
            )

        raise HTTPException(status_code=500, detail=f"RAG pipeline error: {error_msg}")

    return QueryResponse(
        answer=result["answer"],
        sources=result["sources"]
    )


# ─── Index Rebuild ──────────────────────────────────────────────────────────

@app.post("/rebuild-index")
def rebuild_index():
    """Rebuild the in-memory BM25 index from Qdrant (use after re-indexing documents)."""
    try:
        rebuild_bm25_index()
        info = get_collection_info()
        return {"status": "ok", "message": "BM25 index rebuilt", "collection": info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
