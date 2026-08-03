"""
ResearchFlow AI — FastAPI REST Service
v6.0.0 — AsyncGroq Streaming + Startup Warmup + Keep-Alive

Bug Fixes (v6.0):
  AsyncGroq   — Replaced sync Groq client with AsyncGroq inside async generate().
                The sync Groq client was blocking the FastAPI event loop on every
                streaming request, causing the frontend to receive no tokens.
  Keep-Alive  — SSE keep-alive comment frames prevent proxy/nginx timeout on slow LLM.
  Warmup      — Embedder + BM25 index warm up at startup → no cold-start delay.
  Import Bug  — source_confidence_score import moved from inside generate() to module-level.

Endpoints:
  GET  /health          — Service status and config
  GET  /documents       — List indexed research documents
  POST /query           — Standard RAG query (full response)
  POST /stream          — Streaming RAG query (SSE token-by-token, AsyncGroq)
  POST /upload          — Upload document (PDF/TXT/DOCX/MD)
  DELETE /documents/:s  — Delete document and its vectors
  GET  /settings        — Get active guardrail config
  POST /settings        — Update runtime settings
  POST /rebuild-index   — Rebuild BM25 keyword index
"""
import os
import json
import time
import asyncio

# ── Module-level imports (v6.0: AsyncGroq replaces sync Groq — never blocks event loop) ──
from groq import AsyncGroq
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from dotenv import load_dotenv

from src.rag_pipeline import (
    answer,
    build_fused_prompt,
    check_guardrails,
    filter_chunks_by_threshold,
    detect_off_document_answer,
    enrich_query,
    classify_query_intent,
    source_confidence_score,   # v6.0: module-level import (was wrongly inside generate())
    INTENT_META,
    REFUSAL_MSG,
    RELEVANCE_THRESHOLD,
    MIN_RELEVANT_CHUNKS,
    ANSWER_STYLES,
    DEFAULT_STYLE,
    LLM_TEMPERATURE,
)
from src.vector_store import get_collection_info, get_indexed_sources
from src.hybrid_search import rebuild_bm25_index, _build_bm25_index
from src.embedder import get_embedding, warmup as warmup_embedder
from src.web_search import perform_web_search
from src.hybrid_search import hybrid_search
from src.reranker import rerank
import src.rag_pipeline as rag

load_dotenv()

DOCS_FOLDER  = os.path.join(os.path.dirname(__file__), "../data/documents")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL",   "llama-3.3-70b-versatile")

app = FastAPI(
    title="ResearchFlow AI — Expert RAG Service",
    description=(
        "Expert knowledge retrieval for scientific, medical, technical, and multidisciplinary research queries. "
        "Powered by BGE-base embeddings, hybrid BM25+vector search, cross-encoder reranking, "
        "and Groq LLM (AsyncGroq). Supports Python, Bash, C/C++, JavaScript, PowerShell, "
        "Ruby, SQL, Assembly, Go, Rust."
    ),
    version="6.0.0"
)

# ─── AsyncGroq singleton (v6.0) — one async client reused across all requests ──
# AsyncGroq is non-blocking: awaiting it yields control to asyncio event loop
# between token chunks, allowing FastAPI to serve other requests concurrently.
_async_groq: AsyncGroq = None

def _get_async_groq() -> AsyncGroq:
    """Return or create the module-level AsyncGroq singleton."""
    global _async_groq
    if _async_groq is None:
        _async_groq = AsyncGroq(api_key=GROQ_API_KEY)
        print("  [AsyncGroq] Singleton initialized.")
    return _async_groq

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)


# ─── Startup warmup ───────────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    """
    v6.0: Warm up expensive components at server start so the first user
    request doesn't suffer a 2-5 second cold-start delay.
    """
    import threading
    if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
        print("  [Startup] WARNING: GROQ_API_KEY not set -- streaming will fail.")
    else:
        _get_async_groq()   # pre-init AsyncGroq singleton
        print("  [Startup] OK: AsyncGroq singleton ready.")

    def _warmup():
        try:
            warmup_embedder()
            print("  [Startup] OK: BGE embedder warmed up.")
        except Exception as e:
            print(f"  [Startup] WARNING: Embedder warmup failed: {e}")
        try:
            from src.hybrid_search import _build_bm25_index
            _build_bm25_index()
            print("  [Startup] OK: BM25 index ready.")
        except Exception as e:
            print(f"  [Startup] WARNING: BM25 warmup failed: {e}")

    threading.Thread(target=_warmup, daemon=True).start()
    print("  [Startup] ResearchFlow AI v6.0 ready.")


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
    web_sources:     Optional[list[str]] = Field(default=[], description="URLs of live web search sources")
    is_web_fallback: Optional[bool]      = Field(default=False, description="True if answer was generated via live web search fallback")
    intent:          Optional[str]       = Field(default="general", description="Detected query intent")


# ─── OpenAI / Ollama Compatibility Models ─────────────────────────────────────

class OpenAIChatMessage(BaseModel):
    role: str
    content: str

class OpenAIChatRequest(BaseModel):
    model:       Optional[str]               = "researchflow-rag"
    messages:    list[OpenAIChatMessage]
    temperature: Optional[float]             = 0.1
    max_tokens:  Optional[int]               = None
    stream:      Optional[bool]              = False



# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    info = get_collection_info()
    return {
        "status":        "ok",
        "service":       "researchflow-python",
        "version":       "6.0.0",
        "pipeline":      "BGE-base (cached) → Parallel [RAG + Web] → Fused Prompt → Groq LLM",
        "features":      [
            "parallel_rag_web_fusion",
            "semantic_chunking",
            "code_block_preservation",
            "query_expansion_research_sites",
            "bge_base_embeddings",
            "hybrid_bm25_vector_rrf",
            "cross_encoder_reranking",
            "conversation_memory",
            "multi_language_codegen",
            "answer_styles",
            "research_system_prompt",
            "query_intent_classifier",
            "source_confidence_scoring",
            "singleton_qdrant_client",
            "thread_safe_bm25_cache",
            "thread_safe_web_cache",
            "groq_system_user_split",
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
    """Standard ResearchFlow AI RAG query with conversation memory and answer style control."""
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
        is_web_fallback=result.get("is_web_fallback", False),
        intent=result.get("intent", "general"),
    )


# ─── OpenAI / Ollama Compatible Endpoint ──────────────────────────────────────

@app.post("/v1/chat/completions")
def openai_chat_completions(request: OpenAIChatRequest):
    """
    OpenAI / Ollama compatible endpoint (/v1/chat/completions).
    """
    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided.")

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
            "sources":         result.get("sources", []),
            "web_sources":     result.get("web_sources", []),
            "is_web_fallback": result.get("is_web_fallback", False),
            "intent":          result.get("intent", "general"),
        }
    }


# ─── Stream (token-by-token SSE — AsyncGroq Parallel RAG+Web Fusion) ──────────

@app.post("/stream")
async def stream_query(request: QueryRequest):
    """
    Streaming ResearchFlow AI RAG+Web Fusion query via Server-Sent Events (SSE).

    v6.0 Critical Fix — AsyncGroq:
      The previous version used sync Groq inside async def generate(), which
      blocked the entire FastAPI event loop on every streaming request.
      This is now fixed: AsyncGroq + `async for chunk in stream` is used so
      the event loop is never blocked and tokens stream in real-time.

    v6.0 SSE events:
      {status_text: str}           — pipeline stage update
      {intent: str, intent_info: {label, emoji}}  — query intent
      {token: str}                 — streaming LLM token
      {replace: str}               — replace accumulated text (L3 retry)
      {done: true, sources, web_sources, web_results, rag_source_details,
             is_web_fallback, refused, intent}  — final metadata
      {error: str}                 — pipeline error
      : keep-alive                 — SSE heartbeat (prevents proxy timeout)
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY not configured in backend-python/.env"
        )

    style_name = request.answer_style if request.answer_style in ANSWER_STYLES else None
    history = None
    if request.history:
        history = [{"role": m.role, "text": m.text} for m in request.history]

    async def generate():
        try:
            # ── Step 0: Classify intent immediately ───────────────────────────
            intent      = classify_query_intent(request.question)
            intent_info = INTENT_META.get(intent, INTENT_META["general"])

            # Auto-select style from intent if not user-specified
            nonlocal style_name
            if style_name is None:
                style_name = intent_info["style"]

            style = ANSWER_STYLES[style_name]

            # Emit intent badge right away — frontend shows it immediately
            yield f"data: {json.dumps({'intent': intent, 'intent_info': intent_info})}\n\n"
            yield f"data: {json.dumps({'status_text': '🔍 Searching knowledge base...'})}\n\n"

            # ── Step 1: Enrich query ──────────────────────────────────────────
            search_query = enrich_query(request.question, history)

            # ── Step 2: Fire web search IMMEDIATELY in background ─────────────
            # Keep-alive: yield an SSE comment to prevent proxy timeout during
            # the CPU-heavy embed + search + rerank phase (can take 1-3s).
            yield ": keep-alive\n\n"

            web_future = rag._executor.submit(
                perform_web_search, search_query, rag.MAX_WEB_RESULTS
            ) if rag.WEB_ALWAYS_ON else None

            # ── Step 3: Embed + RAG search (web runs concurrently) ────────────
            # Run CPU-bound work in thread pool to avoid blocking event loop
            loop = asyncio.get_event_loop()
            query_vector = await loop.run_in_executor(
                rag._executor, get_embedding, search_query, True
            )
            candidates = await loop.run_in_executor(
                rag._executor, hybrid_search, query_vector, search_query
            )

            # ── Step 4: Cross-encoder reranking (thread pool, non-blocking) ───
            if candidates:
                reranked = await loop.run_in_executor(
                    rag._executor, rerank, request.question, candidates, request.top_k
                )
            else:
                reranked = []

            # ── Step 5: Collect web results ───────────────────────────────────
            yield f"data: {json.dumps({'status_text': '🌐 Enriching with live web intel...'})}\n\n"
            if web_future:
                web_results = await loop.run_in_executor(None, web_future.result)
            else:
                web_results = []
            print(f"  [Stream] Web results collected: {len(web_results)}")

            # ── Step 6: Guardrails ────────────────────────────────────────────
            if candidates:
                should_refuse, refuse_reason, passing_chunks = check_guardrails(reranked)
            else:
                should_refuse  = True
                refuse_reason  = "No RAG candidates"
                passing_chunks = []

            if should_refuse and not web_results:
                yield f"data: {json.dumps({'token': REFUSAL_MSG})}\n\n"
                yield f"data: {json.dumps({'done': True, 'sources': [], 'web_sources': [], 'web_results': [], 'is_web_fallback': False, 'refused': True, 'intent': intent})}\n\n"
                return

            # ── Step 7: Build FUSED prompt ────────────────────────────────────
            yield f"data: {json.dumps({'status_text': '⚡ Synthesizing answer...'})}\n\n"

            sys_c, usr_c = build_fused_prompt(
                request.question,
                passing_chunks,
                web_results,
                history=history,
                answer_style=style_name,
            )

            # ── Step 8: Stream from Groq via AsyncGroq (v6.0 critical fix) ────
            # Using AsyncGroq + async for means the event loop is NEVER blocked.
            # Each `async for chunk` yields control back to asyncio between tokens.
            client = _get_async_groq()
            effective_max_tokens = min(
                style.get("max_tokens", 2000),
                getattr(rag, "GLOBAL_MAX_TOKENS", 3000)
            )

            groq_stream = await client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": sys_c},
                    {"role": "user",   "content": usr_c},
                ],
                temperature=rag.LLM_TEMPERATURE,
                max_tokens=effective_max_tokens,
                stream=True,
            )

            full_response = ""
            token_count   = 0
            async for chunk in groq_stream:
                token = chunk.choices[0].delta.content or ""
                if token:
                    full_response += token
                    token_count   += 1
                    yield f"data: {json.dumps({'token': token})}\n\n"
                    # Yield control to event loop every 20 tokens so other
                    # concurrent requests can be served during long generations
                    if token_count % 20 == 0:
                        await asyncio.sleep(0)

            # ── Step 9: Layer 3 — off-document detection ──────────────────────
            if detect_off_document_answer(full_response) and passing_chunks and web_results:
                print("  [Stream L3] INSUFFICIENT_DOCUMENT_COVERAGE — retrying web-primary")
                yield f"data: {json.dumps({'replace': ''})}\n\n"
                yield f"data: {json.dumps({'status_text': '🌐 Re-fetching with web-primary context...'})}\n\n"

                sys_c2, usr_c2 = build_fused_prompt(
                    request.question, [], web_results,
                    history=history, answer_style=style_name,
                )
                groq_stream2 = await client.chat.completions.create(
                    model=GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": sys_c2},
                        {"role": "user",   "content": usr_c2},
                    ],
                    temperature=rag.LLM_TEMPERATURE,
                    max_tokens=effective_max_tokens,
                    stream=True,
                )
                async for chunk2 in groq_stream2:
                    token2 = chunk2.choices[0].delta.content or ""
                    if token2:
                        yield f"data: {json.dumps({'token': token2})}\n\n"

                web_sources = [r["url"]   for r in web_results if r.get("url")]
                web_titles  = [r["title"] for r in web_results if r.get("title")]
                yield f"data: {json.dumps({'done': True, 'sources': web_titles[:3], 'web_sources': web_sources, 'web_results': web_results, 'rag_source_details': [], 'is_web_fallback': True, 'refused': False, 'intent': intent, 'intent_info': intent_info})}\n\n"
                return

            # ── Done — return enriched metadata ───────────────────────────────
            rag_sources = list({c["source"] for c in passing_chunks})
            web_sources = [r["url"] for r in web_results if r.get("url")]

            # Build rag_source_details with confidence (v6.0: no inline import)
            rag_source_details = []
            for src in rag_sources:
                src_chunks = [c for c in passing_chunks if c["source"] == src]
                top_score  = max((c.get("rerank_score", -99) for c in src_chunks), default=-99)
                rag_source_details.append({
                    "source":     src,
                    "chunks":     len(src_chunks),
                    "confidence": source_confidence_score(top_score),
                })

            yield f"data: {json.dumps({'done': True, 'sources': rag_sources, 'web_sources': web_sources, 'web_results': web_results, 'rag_source_details': rag_source_details, 'is_web_fallback': bool(should_refuse), 'refused': False, 'intent': intent, 'intent_info': intent_info})}\n\n"

        except Exception as e:
            error_msg = str(e)
            print(f"  [Stream Error] {error_msg}")

            if "rate_limit" in error_msg.lower() or "429" in error_msg:
                friendly = "⏳ Groq API rate limit reached. Please wait a few minutes and try again."
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
    """Get current active ResearchFlow AI runtime thresholds."""
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
        "message": "ResearchFlow AI runtime settings updated",
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

    raise HTTPException(status_code=500, detail=f"ResearchFlow AI pipeline error: {error_msg}")
