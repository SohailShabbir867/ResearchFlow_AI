"""
CyberSecAI — FastAPI REST Service
v5.0.0 — Parallel RAG + Web Fusion Engine

Endpoints:
  GET  /health          — Service status and config
  GET  /documents       — List indexed cybersec documents
  POST /query           — Standard RAG query (full response)
  POST /stream          — Streaming RAG query (SSE token-by-token)
  POST /upload          — Upload cybersec document (PDF/TXT/DOCX/MD)
  DELETE /documents/:s  — Delete document and its vectors
  GET  /settings        — Get active guardrail config
  POST /settings        — Update runtime settings
  POST /rebuild-index   — Rebuild BM25 keyword index
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
    answer, build_prompt, build_fused_prompt, check_guardrails,
    filter_chunks_by_threshold, detect_off_document_answer, enrich_query,
    REFUSAL_MSG, RELEVANCE_THRESHOLD, MIN_RELEVANT_CHUNKS,
    ANSWER_STYLES, DEFAULT_STYLE, LLM_TEMPERATURE,
)
from src.vector_store import get_collection_info, get_indexed_sources
from src.hybrid_search import rebuild_bm25_index, _build_bm25_index
from src.embedder import get_embedding, warmup as warmup_embedder

load_dotenv()

DOCS_FOLDER  = os.path.join(os.path.dirname(__file__), "../data/documents")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL",   "llama-3.3-70b-versatile")

app = FastAPI(
    title="CyberSecAI — Ethical Hacking Expert RAG Service",
    description=(
        "Elite cybersecurity knowledge retrieval powered by BGE-base embeddings, "
        "hybrid BM25+vector search, cross-encoder reranking, and Groq LLM. "
        "Supports Python, Bash, C/C++, JavaScript, PowerShell, Ruby, SQL, Assembly."
    ),
    version="5.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class HistoryMessage(BaseModel):
    role: str
    text: str

class QueryRequest(BaseModel):
    question:     str
    top_k:        int           = 8
    history:      Optional[list[HistoryMessage]] = Field(
        default=None,
        description="Previous conversation turns for context-aware follow-ups"
    )
    answer_style: Optional[str] = Field(
        default=None,
        description="short | technical | detailed | ctf"
    )
    max_tokens:   Optional[int] = Field(
        default=None,
        description="Override max LLM generation tokens"
    )

class QueryResponse(BaseModel):
    answer:          str
    sources:         list[str]
    web_sources:     Optional[list[str]] = Field(default=[], description="URLs of live web search sources if fallback was triggered")
    is_web_fallback: Optional[bool]      = Field(default=False, description="True if answer was generated via live web search fallback")


# ─── OpenAI / Ollama Compatibility Models ─────────────────────────────────────

class OpenAIChatMessage(BaseModel):
    role: str
    content: str

class OpenAIChatRequest(BaseModel):
    model:       Optional[str]               = "cybersec-rag"
    messages:    list[OpenAIChatMessage]
    temperature: Optional[float]             = 0.1
    max_tokens:  Optional[int]               = None
    stream:      Optional[bool]              = False



# ─── Startup: pre-load models + BM25 index ───────────────────────────────────

@app.on_event("startup")
async def startup_event():
    print("=" * 60)
    print("CyberSecAI — Ethical Hacking Expert RAG Service v5.0.0")
    print("  Parallel RAG + Web Fusion Engine")
    print("=" * 60)

    print("Step 1/3: Warming up BGE-base embedding model...")
    try:
        warmup_embedder()
    except Exception as e:
        print(f"  Warning: Embedder warmup failed ({e})")

    print("Step 2/3: Warming up cross-encoder reranker...")
    try:
        from src.reranker import _get_reranker
        _get_reranker()
    except Exception as e:
        print(f"  Warning: Reranker warmup failed ({e})")

    print("Step 3/3: Pre-building BM25 index from Qdrant...")
    try:
        _build_bm25_index()
        info   = get_collection_info()
        points = info.get("points_count", 0)
        print(f"  BM25 index ready — {points} cybersec chunks indexed.")
    except Exception as e:
        print(f"  Warning: BM25 pre-build failed ({e}). Will retry on first query.")

    from src.rag_pipeline import WEB_ALWAYS_ON, MAX_WEB_RESULTS, LLM_TEMPERATURE
    print("=" * 60)
    print(f"CyberSecAI v5.0 is ready. All models loaded.")
    print(f"  Web Fusion: {'ALWAYS-ON (parallel)' if WEB_ALWAYS_ON else 'fallback-only'}")
    print(f"  Max Web Results: {MAX_WEB_RESULTS}")
    print(f"  LLM Temperature: {LLM_TEMPERATURE}")
    print("=" * 60)


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    info = get_collection_info()
    return {
        "status":        "ok",
        "service":       "cybersecai-python",
        "version":       "5.0.0",
        "pipeline":      "BGE-base (cached) → Parallel [RAG + Web] → Fused Prompt → Groq LLM",
        "features":      [
            "parallel_rag_web_fusion",
            "semantic_chunking",
            "code_block_preservation",
            "query_expansion_cybersec_sites",
            "bge_base_embeddings",
            "hybrid_bm25_vector_rrf",
            "cross_encoder_reranking",
            "conversation_memory",
            "multi_language_codegen",
            "answer_styles",
            "elite_cybersec_system_prompt",
        ],
        "answer_styles": list(ANSWER_STYLES.keys()),
        "languages":     ["python", "bash", "c/c++", "javascript", "powershell", "ruby", "sql", "assembly", "go", "rust"],
        "collection":    info,
    }


# ─── Documents ────────────────────────────────────────────────────────────────

@app.get("/documents")
def list_documents():
    """List all indexed cybersecurity document sources and total chunk count."""
    sources = get_indexed_sources()
    info    = get_collection_info()
    return {
        "documents":    sources,
        "total_chunks": info.get("points_count", 0),
    }


# ─── Query (standard — full response at once) ─────────────────────────────────

@app.post("/query", response_model=QueryResponse)
def query(request: QueryRequest):
    """Standard CyberSecAI RAG query with conversation memory and answer style control."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

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
        sources=result.get("sources", []),
        web_sources=result.get("web_sources", []),
        is_web_fallback=result.get("is_web_fallback", False)
    )


# ─── OpenAI / Ollama Compatible Endpoint ──────────────────────────────────────

@app.post("/v1/chat/completions")
def openai_chat_completions(request: OpenAIChatRequest):
    """
    OpenAI / Ollama compatible endpoint (/v1/chat/completions).
    Allows external applications (Ollama clients, Open-WebUI, AnythingLLM, Obsidian Copilot)
    to query the CyberSecAI RAG & Web Fallback engine as a standard LLM backend.
    """
    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided.")

    # Extract last user message
    user_question = request.messages[-1].content
    history = [
        {"role": m.role, "text": m.content}
        for m in request.messages[:-1]
    ]

    try:
        result = answer(
            question=user_question,
            history=history,
            answer_style="technical",
        )
    except Exception as e:
        _handle_groq_error(e)

    return {
        "id": f"chatcmpl-cybersec-{int(time.time())}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": request.model or "cybersec-rag",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": result["answer"],
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0
        },
        "cybersecai_metadata": {
            "sources": result.get("sources", []),
            "web_sources": result.get("web_sources", []),
            "is_web_fallback": result.get("is_web_fallback", False)
        }
    }


# ─── Stream (token-by-token SSE — Parallel RAG+Web Fusion) ───────────────────

@app.post("/stream")
async def stream_query(request: QueryRequest):
    """
    Streaming CyberSecAI RAG+Web Fusion query via Server-Sent Events (SSE).

    v5.0 parallel architecture:
      - Step 0: Web search fires immediately in a background thread
      - Step 1: Query enrichment
      - Step 2: BGE embedding
      - Step 3: RAG hybrid search (while web search runs concurrently)
      - Step 4: Cross-encoder reranking
      - Step 5: Collect web results (usually done by now)
      - Step 6: Build fused prompt (RAG primary + web enrichment)
      - Step 7: Stream from Groq
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY not configured in backend-python/.env"
        )

    style_name = request.answer_style if request.answer_style in ANSWER_STYLES else DEFAULT_STYLE
    style      = ANSWER_STYLES[style_name]

    history = None
    if request.history:
        history = [{"role": m.role, "text": m.text} for m in request.history]

    async def generate():
        import concurrent.futures
        from groq import Groq
        from src.hybrid_search import hybrid_search
        from src.reranker import rerank
        import src.rag_pipeline as rag
        from src.web_search import perform_web_search
        from src.rag_pipeline import (
            WEB_ALWAYS_ON, MAX_WEB_RESULTS, ENABLE_WEB_FALLBACK,
            build_fused_prompt, build_web_prompt,
            filter_chunks_by_threshold, check_guardrails,
            detect_off_document_answer, enrich_query, REFUSAL_MSG,
        )

        try:
            # ── Step 0: Kick off web search IMMEDIATELY in background ──────────
            # This runs concurrently with all subsequent steps so web results
            # are ready (or nearly ready) by the time we need them.
            yield f"data: {json.dumps({'status_text': '\ud83d\udd0d Searching knowledge base...'})}\n\n"

            # Enrich the query first (instant, no I/O)
            search_query = enrich_query(request.question, history)

            # Fire web search in a thread — don't wait yet
            web_future = rag._executor.submit(
                perform_web_search, search_query, MAX_WEB_RESULTS
            ) if WEB_ALWAYS_ON else None

            # ── Step 1: Embed query ───────────────────────────────────────
            query_vector = get_embedding(search_query, is_query=True)

            # ── Step 2: RAG hybrid search ────────────────────────────────
            candidates = hybrid_search(query_vector, search_query)

            # ── Step 3: Cross-encoder reranking ─────────────────────────
            reranked = rerank(request.question, candidates, top_k=request.top_k) if candidates else []

            # ── Step 4: Collect web results (usually already done) ─────────
            yield f"data: {json.dumps({'status_text': '\ud83c\udf10 Enriching with live web intel...'})}\n\n"
            web_results = web_future.result() if web_future else []
            print(f"  [Stream] Web results collected: {len(web_results)}")

            # ── Step 5: Guardrails ──────────────────────────────────
            if candidates:
                should_refuse, refuse_reason = check_guardrails(reranked)
            else:
                should_refuse = True
                refuse_reason = "No RAG candidates"

            passing_chunks = filter_chunks_by_threshold(reranked) if not should_refuse else []

            if should_refuse and not web_results:
                # Both RAG and web failed
                yield f"data: {json.dumps({'token': REFUSAL_MSG})}\n\n"
                yield f"data: {json.dumps({'done': True, 'sources': [], 'web_sources': [], 'is_web_fallback': False, 'refused': True})}\n\n"
                return

            # ── Step 6: Build FUSED prompt ────────────────────────────
            yield f"data: {json.dumps({'status_text': '\u26a1 Synthesizing answer...'})}\n\n"

            prompt = build_fused_prompt(
                request.question,
                passing_chunks,
                web_results,
                history=history,
                answer_style=style_name,
            )

            # ── Step 7: Stream from Groq ─────────────────────────────
            client = Groq(api_key=GROQ_API_KEY)
            effective_max_tokens = (
                request.max_tokens
                or getattr(rag, "GLOBAL_MAX_TOKENS", None)
                or style["max_tokens"]
            )
            if style_name == "detailed":
                effective_max_tokens = max(effective_max_tokens, 5000)

            groq_stream = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=rag.LLM_TEMPERATURE,
                max_tokens=effective_max_tokens,
                stream=True,
            )

            full_response = ""
            for chunk in groq_stream:
                token = chunk.choices[0].delta.content or ""
                if token:
                    full_response += token
                    yield f"data: {json.dumps({'token': token})}\n\n"

            # ── Step 8: Layer 3 — off-document detection ─────────────────
            if detect_off_document_answer(full_response):
                print("  [Stream L3] INSUFFICIENT_DOCUMENT_COVERAGE — retrying with web-primary fused prompt")
                if web_results:
                    yield f"data: {json.dumps({'replace': ''})}\n\n"
                    yield f"data: {json.dumps({'status_text': '\ud83c\udf10 Re-fetching with web-primary context...'})}\n\n"

                    # Retry with web-only fused prompt
                    prompt2 = build_fused_prompt(
                        request.question, [], web_results,
                        history=history, answer_style=style_name,
                    )
                    groq_stream2 = client.chat.completions.create(
                        model=GROQ_MODEL,
                        messages=[{"role": "user", "content": prompt2}],
                        temperature=rag.LLM_TEMPERATURE,
                        max_tokens=effective_max_tokens,
                        stream=True,
                    )
                    for chunk2 in groq_stream2:
                        token2 = chunk2.choices[0].delta.content or ""
                        if token2:
                            yield f"data: {json.dumps({'token': token2})}\n\n"

                    web_sources = [r["url"] for r in web_results if r.get("url")]
                    web_titles  = [r["title"] for r in web_results if r.get("title")]
                    yield f"data: {json.dumps({'done': True, 'sources': web_titles[:3], 'web_sources': web_sources, 'is_web_fallback': True, 'refused': False})}\n\n"
                    return

                yield f"data: {json.dumps({'replace': REFUSAL_MSG})}\n\n"
                yield f"data: {json.dumps({'done': True, 'sources': [], 'web_sources': [], 'is_web_fallback': False, 'refused': True})}\n\n"
                return

            # ── Done — return both RAG and web sources ────────────────
            rag_sources = list({c["source"] for c in passing_chunks})
            web_sources = [r["url"] for r in web_results if r.get("url")]
            yield f"data: {json.dumps({'done': True, 'sources': rag_sources, 'web_sources': web_sources, 'is_web_fallback': bool(should_refuse), 'refused': False})}\n\n"

        except Exception as e:
            error_msg = str(e)
            print(f"  [Stream Error] {error_msg}")

            # Parse known errors into user-friendly messages
            if "rate_limit" in error_msg.lower() or "429" in error_msg:
                friendly = "⏳ Groq API rate limit reached. Please wait a few minutes and try again, or upgrade your Groq plan at console.groq.com"
            elif "model_decommissioned" in error_msg.lower():
                friendly = "🔧 The configured LLM model has been retired. Please update GROQ_MODEL in backend-python/.env"
            elif "GROQ_API_KEY" in error_msg:
                friendly = "🔑 Groq API key is not configured. Set GROQ_API_KEY in backend-python/.env"
            else:
                friendly = f"Pipeline error: {error_msg[:200]}"

            yield f"data: {json.dumps({'error': friendly})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")



# ─── Upload ───────────────────────────────────────────────────────────────────

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a cybersecurity document (PDF, TXT, DOCX, MD).
    Auto-chunks with semantic boundaries, embeds with BGE-base, stores in Qdrant.
    """
    allowed = {".pdf", ".txt", ".docx", ".md"}
    ext     = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: PDF, TXT, DOCX, MD"
        )

    MAX_SIZE = 50 * 1024 * 1024  # 50MB
    content  = await file.read()
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
                detail="No text could be extracted from the file. Is it a scanned PDF?"
            )

        chunks   = chunk_document(pages, source_name=file.filename)
        embedded = embed_chunks(chunks)
        store_chunks(embedded, recreate=False)   # Incremental — don't wipe existing
        rebuild_bm25_index()

        # Count interesting chunk types
        code_chunks = sum(1 for c in chunks if c["metadata"].get("content_type") == "code")
        cve_chunks  = sum(1 for c in chunks if c["metadata"].get("cves"))

        return {
            "message":        f"Successfully indexed '{file.filename}'",
            "chunks_created": len(chunks),
            "code_chunks":    code_chunks,
            "cve_chunks":     cve_chunks,
            "file_size_kb":   round(len(content) / 1024, 1),
        }
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(save_path):
            os.remove(save_path)
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")


# ─── Delete Document ──────────────────────────────────────────────────────────

@app.delete("/documents/{source}")
def delete_document(source: str):
    """Delete a cybersec document and all its vector chunks from Qdrant."""
    from src.vector_store import delete_document_by_source

    print(f"Deleting document: '{source}'...")
    deleted_from_qdrant = delete_document_by_source(source)

    file_path = os.path.join(DOCS_FOLDER, source)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            print(f"  Deleted local file '{file_path}'")
        except Exception as e:
            print(f"  Warning: could not delete file '{file_path}': {e}")

    rebuild_bm25_index()

    return {
        "status":               "ok",
        "message":              f"Successfully deleted document '{source}'",
        "deleted_from_qdrant":  deleted_from_qdrant,
    }


# ─── Settings ─────────────────────────────────────────────────────────────────

class SettingsUpdate(BaseModel):
    threshold:  Optional[float] = None
    minChunks:  Optional[int]   = None
    max_tokens: Optional[int]   = None
    maxTokens:  Optional[int]   = None
    llm:        Optional[dict]  = None
    guardrail:  Optional[dict]  = None


@app.get("/settings")
def get_settings():
    """Get current active CyberSecAI runtime thresholds."""
    import src.rag_pipeline as rag
    return {
        "guardrail": {
            "threshold": rag.RELEVANCE_THRESHOLD,
            "minChunks": rag.MIN_RELEVANT_CHUNKS,
        },
        "max_tokens":    getattr(rag, "GLOBAL_MAX_TOKENS", 4000),
        "answer_styles": list(ANSWER_STYLES.keys()),
        "default_style": DEFAULT_STYLE,
    }


@app.post("/settings")
def update_settings(update: SettingsUpdate):
    """Update runtime guardrail & max_tokens settings dynamically."""
    import src.rag_pipeline as rag

    if update.threshold is not None:
        rag.RELEVANCE_THRESHOLD = float(update.threshold)
        print(f"  [Runtime] RELEVANCE_THRESHOLD = {rag.RELEVANCE_THRESHOLD}")
    elif update.guardrail and "threshold" in update.guardrail:
        rag.RELEVANCE_THRESHOLD = float(update.guardrail["threshold"])

    if update.minChunks is not None:
        rag.MIN_RELEVANT_CHUNKS = int(update.minChunks)
        print(f"  [Runtime] MIN_RELEVANT_CHUNKS = {rag.MIN_RELEVANT_CHUNKS}")
    elif update.guardrail and "minChunks" in update.guardrail:
        rag.MIN_RELEVANT_CHUNKS = int(update.guardrail["minChunks"])

    new_max = update.max_tokens or update.maxTokens
    if not new_max and update.llm and "maxTokens" in update.llm:
        new_max = int(update.llm["maxTokens"])

    if new_max:
        rag.GLOBAL_MAX_TOKENS = int(new_max)
        rag.ANSWER_STYLES["detailed"]["max_tokens"] = int(new_max)
        print(f"  [Runtime] GLOBAL_MAX_TOKENS = {rag.GLOBAL_MAX_TOKENS}")

    return {
        "status":  "ok",
        "message": "CyberSecAI runtime settings updated",
        "guardrail": {
            "threshold": rag.RELEVANCE_THRESHOLD,
            "minChunks": rag.MIN_RELEVANT_CHUNKS,
        },
        "max_tokens": getattr(rag, "GLOBAL_MAX_TOKENS", 4000),
    }


# ─── Index Rebuild ────────────────────────────────────────────────────────────

@app.post("/rebuild-index")
def rebuild_index():
    """Rebuild the in-memory BM25 keyword index from Qdrant."""
    try:
        rebuild_bm25_index()
        info = get_collection_info()
        return {"status": "ok", "message": "BM25 index rebuilt successfully", "collection": info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Error handler ────────────────────────────────────────────────────────────

def _handle_groq_error(e: Exception):
    """Convert known Groq/pipeline errors into clean HTTP responses."""
    error_msg = str(e)

    if "GROQ_API_KEY not set" in error_msg or "your_groq_api_key_here" in error_msg:
        raise HTTPException(status_code=503, detail="Groq API key not configured.")
    if "rate_limit" in error_msg.lower():
        raise HTTPException(status_code=429, detail="Groq rate limit reached. Wait a moment.")
    if "model_decommissioned" in error_msg:
        raise HTTPException(status_code=502, detail="Groq model decommissioned. Update GROQ_MODEL in .env")

    raise HTTPException(status_code=500, detail=f"CyberSecAI pipeline error: {error_msg}")
