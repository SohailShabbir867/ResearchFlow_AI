"""
FastAPI REST API for MedResearch AI RAG Service.
v2.1.0 — Upgrades applied:
  - BM25 index pre-built on startup (no cold-start delay on first query)
  - /upload endpoint: upload PDF/TXT/DOCX directly from browser, auto-indexes
  - /stream endpoint: streaming SSE responses (token-by-token like ChatGPT)
  - Full Groq-specific error handling
"""
import os
import json
import shutil
import time

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from src.rag_pipeline import answer, build_prompt
from src.vector_store import get_collection_info, get_indexed_sources
from src.hybrid_search import rebuild_bm25_index, _build_bm25_index
from src.embedder import get_embedding

load_dotenv()

DOCS_FOLDER = os.path.join(os.path.dirname(__file__), "../data/documents")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

app = FastAPI(
    title="MedResearch AI — RAG Service",
    description="Hybrid search + reranking + Groq LLM · v2.1.0",
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


# ─── Pydantic Models ─────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str
    top_k: int = 5


class QueryResponse(BaseModel):
    answer: str
    sources: list[str]


# ─── Startup: pre-build BM25 index ──────────────────────────────────────────
# Fix #2: Build BM25 on server start so the FIRST query has zero cold-start delay

@app.on_event("startup")
async def startup_event():
    print("=" * 50)
    print("MedResearch AI — RAG Service starting...")
    print("Pre-building BM25 index from Qdrant...")
    try:
        _build_bm25_index()
        info = get_collection_info()
        points = info.get("points_count", 0)
        print(f"BM25 index ready — {points} chunks indexed.")
    except Exception as e:
        print(f"Warning: BM25 pre-build failed ({e}). Will retry on first query.")
    print("Server ready.")
    print("=" * 50)


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    info = get_collection_info()
    return {
        "status": "ok",
        "service": "medresearch-python",
        "version": "2.1.0",
        "pipeline": "FastEmbed (local) → Hybrid Search → Reranker → Groq 70b",
        "collection": info
    }


# ─── Documents ───────────────────────────────────────────────────────────────

@app.get("/documents")
def list_documents():
    """List all indexed document sources and total chunk count."""
    sources = get_indexed_sources()
    info = get_collection_info()
    return {
        "documents": sources,
        "total_chunks": info.get("points_count", 0)
    }


# ─── Query (standard — full response at once) ────────────────────────────────

@app.post("/query", response_model=QueryResponse)
def query(request: QueryRequest):
    """Standard RAG query — returns full answer after complete generation."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        result = answer(request.question, top_k=request.top_k)
    except Exception as e:
        _handle_groq_error(e)

    return QueryResponse(
        answer=result["answer"],
        sources=result["sources"]
    )


# ─── Stream (Fix #5 — token-by-token SSE streaming) ─────────────────────────

@app.post("/stream")
async def stream_query(request: QueryRequest):
    """
    Streaming RAG query using Server-Sent Events (SSE).
    Tokens arrive one-by-one like ChatGPT — no waiting for full response.
    Frontend consumes with fetch() + ReadableStream.
    
    Event format:
      data: {"token": "..."}        ← each token as it arrives
      data: {"done": true, "sources": [...]}  ← final event with sources
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY not configured in backend-python/.env"
        )

    async def generate():
        from groq import Groq
        from src.hybrid_search import hybrid_search
        from src.reranker import rerank

        try:
            # Step 1: Embed query
            query_vector = get_embedding(request.question, is_query=True)

            # Step 2: Hybrid search
            candidates = hybrid_search(query_vector, request.question)

            if not candidates:
                yield f"data: {json.dumps({'token': 'Sorry, I am not trained for that purpose.'})}\n\n"
                yield f"data: {json.dumps({'done': True, 'sources': []})}\n\n"
                return

            # Step 3: Rerank
            reranked = rerank(request.question, candidates, top_k=request.top_k)

            # Step 4: Guardrail check
            top_score = reranked[0].get("rerank_score", -99.0) if reranked else -99.0
            if top_score < -4.5:
                yield f"data: {json.dumps({'token': 'Sorry, I am not trained for that purpose.'})}\n\n"
                yield f"data: {json.dumps({'done': True, 'sources': []})}\n\n"
                return

            # Step 5: Build prompt
            prompt = build_prompt(request.question, reranked)

            # Step 6: Stream from Groq
            client = Groq(api_key=GROQ_API_KEY)
            stream = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=1024,
                stream=True   # ← key flag
            )

            for chunk in stream:
                token = chunk.choices[0].delta.content or ""
                if token:
                    yield f"data: {json.dumps({'token': token})}\n\n"

            # Step 7: Send sources at the very end
            sources = list({c["source"] for c in reranked})
            yield f"data: {json.dumps({'done': True, 'sources': sources})}\n\n"

        except Exception as e:
            error_msg = str(e)
            yield f"data: {json.dumps({'error': error_msg})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ─── Upload (Fix #4 — PDF upload from browser, auto-indexes) ────────────────

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a PDF, TXT, or DOCX file from the browser.
    Automatically chunks, embeds, and stores in Qdrant.
    Rebuilds BM25 index after indexing.
    """
    # Validate file type
    allowed = {".pdf", ".txt", ".docx"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: PDF, TXT, DOCX"
        )

    # Validate file size (max 50MB)
    MAX_SIZE = 50 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum size is 50MB."
        )

    # Save to documents folder
    os.makedirs(DOCS_FOLDER, exist_ok=True)
    save_path = os.path.join(DOCS_FOLDER, file.filename)

    with open(save_path, "wb") as f:
        f.write(content)

    print(f"Uploaded: {file.filename} ({len(content) / 1024:.1f} KB)")

    # Auto-index the uploaded file
    try:
        from src.chunker import load_document, chunk_document
        from src.embedder import embed_chunks
        from src.vector_store import store_chunks

        pages = load_document(save_path)
        if not pages:
            os.remove(save_path)
            raise HTTPException(
                status_code=422,
                detail="No text could be extracted from the file. "
                       "Make sure it is not a scanned image-only PDF."
            )

        chunks = chunk_document(pages, source_name=file.filename)
        embedded = embed_chunks(chunks)
        store_chunks(embedded)

        # Rebuild BM25 to include the new document
        rebuild_bm25_index()

        return {
            "message": f"Successfully indexed '{file.filename}'",
            "chunks_created": len(chunks),
            "file_size_kb": round(len(content) / 1024, 1)
        }

    except HTTPException:
        raise
    except Exception as e:
        # Clean up saved file if indexing fails
        if os.path.exists(save_path):
            os.remove(save_path)
        raise HTTPException(
            status_code=500,
            detail=f"Indexing failed: {str(e)}"
        )


# ─── Index Rebuild ───────────────────────────────────────────────────────────

@app.post("/rebuild-index")
def rebuild_index():
    """Rebuild the in-memory BM25 index from Qdrant (run after bulk re-indexing)."""
    try:
        rebuild_bm25_index()
        info = get_collection_info()
        return {
            "status": "ok",
            "message": "BM25 index rebuilt successfully",
            "collection": info
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Error handler helper ────────────────────────────────────────────────────

def _handle_groq_error(e: Exception):
    """Convert known Groq/pipeline errors into clean HTTP responses."""
    error_msg = str(e)

    if "GROQ_API_KEY not set" in error_msg or "your_groq_api_key_here" in error_msg:
        raise HTTPException(
            status_code=503,
            detail="Groq API key not configured. Add GROQ_API_KEY to backend-python/.env"
        )
    if "rate_limit" in error_msg.lower():
        raise HTTPException(
            status_code=429,
            detail="Groq rate limit reached. Wait a moment and try again."
        )
    if "model_decommissioned" in error_msg:
        raise HTTPException(
            status_code=502,
            detail="Groq model decommissioned. Update GROQ_MODEL in .env"
        )
    if "No relevant documents" in error_msg:
        raise HTTPException(
            status_code=404,
            detail="No documents indexed. Run: python scripts/index_documents.py"
        )

    raise HTTPException(status_code=500, detail=f"RAG pipeline error: {error_msg}")
