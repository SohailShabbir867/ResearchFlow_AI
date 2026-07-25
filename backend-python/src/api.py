"""
FastAPI REST API for ResearchAI RAG Service.
v3.0.0 — Upgrades:
  - Conversation memory: history param for context-aware follow-ups
  - Answer style control: short / detailed / classical
  - Startup warmup: pre-loads embedding + reranker models
  - Stream endpoint: full guardrail parity with /query
  - Embedding cache: repeated queries return instantly
"""
import os
import json
import time

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from dotenv import load_dotenv

from src.rag_pipeline import (
    answer, build_prompt, check_guardrails, filter_chunks_by_threshold,
    detect_off_document_answer, enrich_query, REFUSAL_MSG, RELEVANCE_THRESHOLD,
    MIN_RELEVANT_CHUNKS, ANSWER_STYLES, DEFAULT_STYLE,
)
from src.vector_store import get_collection_info, get_indexed_sources
from src.hybrid_search import rebuild_bm25_index, _build_bm25_index
from src.embedder import get_embedding, warmup as warmup_embedder

load_dotenv()

DOCS_FOLDER = os.path.join(os.path.dirname(__file__), "../data/documents")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

app = FastAPI(
    title="ResearchAI — RAG Service",
    description="Hybrid search + reranking + Groq LLM · v3.0.0",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


# ─── Pydantic Models ─────────────────────────────────────────────────────────

class HistoryMessage(BaseModel):
    role: str
    text: str

class QueryRequest(BaseModel):
    question: str
    top_k: int = 5
    history: Optional[list[HistoryMessage]] = Field(default=None, description="Previous conversation turns for context")
    answer_style: Optional[str] = Field(default=None, description="short | detailed | classical")

class QueryResponse(BaseModel):
    answer: str
    sources: list[str]


# ─── Startup: pre-load models + BM25 index ──────────────────────────────────

@app.on_event("startup")
async def startup_event():
    print("=" * 50)
    print("ResearchAI — RAG Service starting...")

    # 1. Pre-load embedding model (eliminates ~3s cold start on first query)
    print("Warming up embedding model...")
    try:
        warmup_embedder()
    except Exception as e:
        print(f"Warning: Embedder warmup failed ({e})")

    # 2. Pre-load reranker model
    print("Warming up reranker model...")
    try:
        from src.reranker import _get_reranker
        _get_reranker()
    except Exception as e:
        print(f"Warning: Reranker warmup failed ({e})")

    # 3. Pre-build BM25 index
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
        "service": "researchai-python",
        "version": "3.0.0",
        "pipeline": "FastEmbed (cached) → Hybrid Search → Reranker → Groq LLM",
        "features": ["embedding_cache", "conversation_memory", "answer_styles"],
        "answer_styles": list(ANSWER_STYLES.keys()),
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
    """Standard RAG query with conversation memory and answer style control."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Convert history models to dicts
    history = None
    if request.history:
        history = [{"role": m.role, "text": m.text} for m in request.history]

    try:
        result = answer(
            request.question,
            top_k=request.top_k,
            history=history,
            answer_style=request.answer_style,
        )
    except Exception as e:
        _handle_groq_error(e)

    return QueryResponse(
        answer=result["answer"],
        sources=result["sources"]
    )


# ─── Stream (token-by-token SSE with full guardrails) ────────────────────────

@app.post("/stream")
async def stream_query(request: QueryRequest):
    """
    Streaming RAG query using Server-Sent Events (SSE).
    Full guardrail parity with /query endpoint.
    Supports conversation memory and answer style control.
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY not configured in backend-python/.env"
        )

    # Resolve answer style
    style_name = request.answer_style if request.answer_style in ANSWER_STYLES else DEFAULT_STYLE
    style = ANSWER_STYLES[style_name]

    # Convert history
    history = None
    if request.history:
        history = [{"role": m.role, "text": m.text} for m in request.history]

    async def generate():
        from groq import Groq
        from src.hybrid_search import hybrid_search
        from src.reranker import rerank

        try:
            # Step 1: Enrich query with conversation context
            search_query = enrich_query(request.question, history)

            # Step 2: Embed query (cached)
            query_vector = get_embedding(search_query, is_query=True)

            # Step 3: Hybrid search
            candidates = hybrid_search(query_vector, search_query)

            if not candidates:
                yield f"data: {json.dumps({'token': REFUSAL_MSG})}\n\n"
                yield f"data: {json.dumps({'done': True, 'sources': [], 'refused': True})}\n\n"
                return

            # Step 4: Rerank
            reranked = rerank(request.question, candidates, top_k=request.top_k)

            # Step 5: Full guardrail check (Layer 1 + Layer 2)
            should_refuse, refuse_reason = check_guardrails(reranked)
            if should_refuse:
                print(f"  [Stream Guardrail BLOCKED] {refuse_reason}")
                yield f"data: {json.dumps({'token': REFUSAL_MSG})}\n\n"
                yield f"data: {json.dumps({'done': True, 'sources': [], 'refused': True})}\n\n"
                return

            # Only pass chunks that cleared the threshold
            passing_chunks = filter_chunks_by_threshold(reranked)

            # Step 6: Build prompt with history + style
            prompt = build_prompt(
                request.question,
                passing_chunks,
                history=history,
                answer_style=style_name,
            )

            # Step 7: Stream from Groq
            client = Groq(api_key=GROQ_API_KEY)
            stream = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=style["max_tokens"],
                stream=True
            )

            full_response = ""
            for chunk in stream:
                token = chunk.choices[0].delta.content or ""
                if token:
                    full_response += token
                    yield f"data: {json.dumps({'token': token})}\n\n"

            # Step 8: Layer 3 — detect off-document answer
            if detect_off_document_answer(full_response):
                print("  [Stream Guardrail L3] Off-document answer detected")
                yield f"data: {json.dumps({'replace': REFUSAL_MSG})}\n\n"
                yield f"data: {json.dumps({'done': True, 'sources': [], 'refused': True})}\n\n"
                return

            # Step 9: Send sources
            sources = list({c["source"] for c in passing_chunks})
            yield f"data: {json.dumps({'done': True, 'sources': sources, 'refused': False})}\n\n"

        except Exception as e:
            error_msg = str(e)
            print(f"  [Stream Error] {error_msg}")
            yield f"data: {json.dumps({'error': error_msg})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ─── Upload ──────────────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload a PDF, TXT, or DOCX file. Auto-chunks, embeds, stores in Qdrant."""
    allowed = {".pdf", ".txt", ".docx"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: PDF, TXT, DOCX"
        )

    MAX_SIZE = 50 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 50MB.")

    os.makedirs(DOCS_FOLDER, exist_ok=True)
    save_path = os.path.join(DOCS_FOLDER, file.filename)

    with open(save_path, "wb") as f:
        f.write(content)

    print(f"Uploaded: {file.filename} ({len(content) / 1024:.1f} KB)")

    try:
        from src.chunker import load_document, chunk_document
        from src.embedder import embed_chunks
        from src.vector_store import store_chunks

        pages = load_document(save_path)
        if not pages:
            os.remove(save_path)
            raise HTTPException(
                status_code=422,
                detail="No text could be extracted from the file."
            )

        chunks = chunk_document(pages, source_name=file.filename)
        embedded = embed_chunks(chunks)
        store_chunks(embedded)
        rebuild_bm25_index()

        return {
            "message": f"Successfully indexed '{file.filename}'",
            "chunks_created": len(chunks),
            "file_size_kb": round(len(content) / 1024, 1)
        }
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(save_path):
            os.remove(save_path)
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")


# ─── Index Rebuild ───────────────────────────────────────────────────────────

@app.post("/rebuild-index")
def rebuild_index():
    """Rebuild the in-memory BM25 index from Qdrant."""
    try:
        rebuild_bm25_index()
        info = get_collection_info()
        return {"status": "ok", "message": "BM25 index rebuilt successfully", "collection": info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Error handler ───────────────────────────────────────────────────────────

def _handle_groq_error(e: Exception):
    """Convert known Groq/pipeline errors into clean HTTP responses."""
    error_msg = str(e)

    if "GROQ_API_KEY not set" in error_msg or "your_groq_api_key_here" in error_msg:
        raise HTTPException(status_code=503, detail="Groq API key not configured.")
    if "rate_limit" in error_msg.lower():
        raise HTTPException(status_code=429, detail="Groq rate limit reached. Wait a moment.")
    if "model_decommissioned" in error_msg:
        raise HTTPException(status_code=502, detail="Groq model decommissioned. Update GROQ_MODEL in .env")
    if "No relevant documents" in error_msg:
        raise HTTPException(status_code=404, detail="No documents indexed.")

    raise HTTPException(status_code=500, detail=f"RAG pipeline error: {error_msg}")
