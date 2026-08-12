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
import hashlib
import re
from collections import OrderedDict
import threading
from datetime import datetime
from typing import Optional, AsyncIterator

from groq import AsyncGroq
from fastapi import FastAPI, HTTPException, UploadFile, File, Request, Header, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs):
        return False

from src.rag_pipeline import (
    answer,
    build_fused_prompt,
    build_shopping_prompt,
    build_current_time_response,
    check_guardrails,
    filter_chunks_by_threshold,
    detect_off_document_answer,
    detect_time_intent,
    enrich_query,
    classify_query_intent,
    source_confidence_score,
    INTENT_META,
    REFUSAL_MSG,
    RELEVANCE_THRESHOLD,
    MIN_RELEVANT_CHUNKS,
    ANSWER_STYLES,
    DEFAULT_STYLE,
    LLM_TEMPERATURE,
)
from src.vector_store import get_collection_info, get_indexed_sources
from src.hybrid_search import rebuild_bm25_index, _build_bm25_index, add_chunks_to_bm25, remove_chunks_from_bm25
from src.embedder import get_embedding, warmup as warmup_embedder
from src.web_search import perform_web_search, needs_freshness
from src.hybrid_search import hybrid_search
from src.reranker import rerank
import src.rag_pipeline as rag

# ── Supported Groq models (validated allowlist — prevents silent fallbacks) ──
SUPPORTED_GROQ_MODELS = {
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "gemma2-9b-it",
    "gemma-7b-it",
    "council",
}

SUPPORTED_GEMINI_MODELS = {
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    "gemini-2.0-flash-lite",
}

COUNCIL_MODELS = [
    os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
    "gemma2-9b-it",
]

DEPRECATED_MODEL_ALIASES = {
    "mixtral-8x7b-32768":  os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
    "llama2-70b-4096":     os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
    "gemini-mini":         "gemini-2.0-flash",
    "gemini-1.0":          "gemini-1.5-flash",
    "gemini-1.0-pro":      "gemini-1.5-pro",
}

load_dotenv()

DOCS_FOLDER = os.path.join(os.path.dirname(__file__), "../data/documents")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")

def _sanitize_doc_path(filename: str) -> tuple[str, str]:
    """
    Sanitize and validate user-supplied filenames to prevent path traversal attacks.
    """
    if not filename or not isinstance(filename, str):
        raise HTTPException(status_code=400, detail="Filename cannot be empty.")

    if "\0" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename: null bytes not allowed.")

    if ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename: path traversal '..' not allowed.")

    if os.path.isabs(filename) or filename.startswith("/") or filename.startswith("\\"):
        raise HTTPException(status_code=400, detail="Invalid filename: absolute paths not allowed.")

    safe_name = os.path.basename(filename).strip()
    if not safe_name or safe_name in {".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    abs_docs_folder = os.path.abspath(DOCS_FOLDER)
    final_path = os.path.abspath(os.path.join(abs_docs_folder, safe_name))

    try:
        common = os.path.commonpath([abs_docs_folder, final_path])
        if common != abs_docs_folder:
            raise HTTPException(status_code=400, detail="Invalid filename: path resolves outside document storage.")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid filename path resolution.")

    return safe_name, final_path

def verify_internal_key(x_internal_key: Optional[str] = Header(None, alias="X-Internal-Key")):
    """
    FastAPI security dependency for service-to-service internal authentication.
    """
    if INTERNAL_API_KEY:
        if not x_internal_key or x_internal_key != INTERNAL_API_KEY:
            raise HTTPException(
                status_code=401,
                detail="Unauthorized: Invalid or missing X-Internal-Key header."
            )

ALLOWED_ORIGINS_ENV = os.getenv("ALLOWED_ORIGINS", "")
NODE_URL = os.getenv("NODE_URL", "http://localhost:5000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
raw_origins = [origin.strip() for origin in ALLOWED_ORIGINS_ENV.split(",") if origin.strip()]
if not raw_origins:
    raw_origins = [
        NODE_URL,
        FRONTEND_URL,
        "http://localhost:5000",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

app = FastAPI(
    title="ResearchFlow AI — Expert RAG Service",
    description="Expert knowledge retrieval for scientific, medical, technical, and multidisciplinary research queries.",
    version="6.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=raw_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# ─── Startup warmup ───────────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    """
    v7.0: Warm up expensive components at server start. Logs Gemini & Auth status.
    """
    import threading
    if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
        print("  [Startup] WARNING: GROQ_API_KEY not set -- Groq streaming will fail.")
    else:
        _get_async_groq()
        print("  [Startup] OK: AsyncGroq singleton ready.")

    if GEMINI_API_KEY and GEMINI_API_KEY not in ("your_gemini_api_key_here", ""):
        print(f"  [Startup] OK: GEMINI_API_KEY detected — Gemini models enabled ({GEMINI_DEFAULT_MODEL}).")
    else:
        print("  [Startup] INFO: No GEMINI_API_KEY set. Gemini models will return an error until key is added to .env.")

    if INTERNAL_API_KEY:
        print("  [Startup] OK: INTERNAL_API_KEY detected — service-to-service internal auth ENABLED.")
    else:
        print("  [Startup] WARNING: INTERNAL_API_KEY not set in backend-python/.env — internal auth is DISABLED.")

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
        try:
            from src.reranker import rerank
            rerank("warmup", [{"text": "warmup text"}], top_k=1)
            print("  [Startup] OK: Cross-Encoder reranker model warmed up.")
        except Exception as e:
            print(f"  [Startup] WARNING: Reranker warmup failed: {e}")

    threading.Thread(target=_warmup, daemon=True).start()
    print("  [Startup] NexusAI v7.0 ready.")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(exc.body)},
    )

# ─── Query Cache (Phase 1: LRU In-Memory Cache) ───────────────────────────────
class QueryCache:
    def __init__(self, capacity=100):
        self.cache = OrderedDict()
        self.capacity = capacity
        self._lock = threading.Lock()

    def get(self, key):
        with self._lock:
            if key not in self.cache:
                return None
            self.cache.move_to_end(key)
            return list(self.cache[key])

    def put(self, key, value):
        with self._lock:
            self.cache[key] = list(value)
            self.cache.move_to_end(key)
            if len(self.cache) > self.capacity:
                self.cache.popitem(last=False)

_query_cache = QueryCache(capacity=100)
_sync_query_cache = QueryCache(capacity=100)

# ─── AsyncGroq singleton ─────────────────────────────────────────────────────
_async_groq: AsyncGroq = None

def _get_async_groq() -> AsyncGroq:
    global _async_groq
    if _async_groq is None:
        _async_groq = AsyncGroq(api_key=GROQ_API_KEY)
        print("  [AsyncGroq] Singleton initialized.")
    return _async_groq


async def stream_llm_tokens(
    model_name: str,
    sys_content: str,
    user_content: str,
    max_tokens: int,
    language: str = "en",
) -> AsyncIterator[str]:
    """
    Unified async generator streaming text tokens across Groq, Gemini, or future providers.
    """
    if language == "ur":
        sys_content += "\n\nCRITICAL DIRECTIVE: The user is speaking Urdu. You MUST reply completely in native Urdu language (using Urdu script)."

    if _is_gemini_model(model_name):
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured in backend-python/.env")
        try:
            from google import genai as google_genai
            from google.genai import types as genai_types
        except ImportError:
            raise HTTPException(status_code=500, detail="google-genai package missing. Run: pip install google-genai")

        gem_client = google_genai.Client(api_key=GEMINI_API_KEY, http_options={"api_version": "v1"})
        try:
            combined_prompt = f"{sys_content}\n\n---\n\n{user_content}"
            stream = await gem_client.aio.models.generate_content_stream(
                model=model_name,
                contents=combined_prompt,
                config=genai_types.GenerateContentConfig(
                    max_output_tokens=max_tokens,
                    temperature=rag.LLM_TEMPERATURE,
                ),
            )
            async for chunk in stream:
                token = (chunk.text or "") if hasattr(chunk, "text") else ""
                if token:
                    yield token
        except Exception as e:
            err_str = str(e)
            if "API_KEY" in err_str or "UNAUTHENTICATED" in err_str or "invalid" in err_str.lower():
                raise HTTPException(status_code=401, detail="Invalid GEMINI_API_KEY.")
            elif "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                raise HTTPException(status_code=429, detail="Gemini rate limit / quota exceeded.")
            else:
                raise HTTPException(status_code=500, detail=f"Gemini API error: {err_str}")
    else:
        if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
            raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured in backend-python/.env")

        client = _get_async_groq()
        try:
            groq_stream = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": sys_content},
                    {"role": "user",   "content": user_content},
                ],
                temperature=rag.LLM_TEMPERATURE,
                max_tokens=max_tokens,
                stream=True,
            )
            async for chunk in groq_stream:
                token = chunk.choices[0].delta.content or ""
                if token:
                    yield token
        except Exception as e:
            _handle_groq_error(e)

# ─── Gemini async client (google-generativeai) ────────────────────────────────
_gemini_client = None
_gemini_available = False

def _get_gemini_client():
    global _gemini_client, _gemini_available
    if _gemini_client is not None:
        return _gemini_client
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set.")
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        _gemini_client = genai
        _gemini_available = True
        return _gemini_client
    except ImportError:
        raise RuntimeError("google-generativeai not installed.")

def _is_gemini_model(model_name: str) -> bool:
    return model_name in SUPPORTED_GEMINI_MODELS


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class HistoryMessage(BaseModel):
    role: Optional[str] = "user"
    text: Optional[str] = ""

class QueryRequest(BaseModel):
    question:     str = Field(..., min_length=1, max_length=50_000)
    top_k:        Optional[int] = Field(default=8, ge=1, le=50)
    history:      Optional[list[HistoryMessage]] = Field(
        default=None,
    )
    answer_style: Optional[str] = Field(
        default=None,
        description="short | technical | detailed | case_study | conversational"
    )
    max_tokens:   Optional[int] = Field(
        default=None, ge=1, le=32_768,
        description="Override max LLM generation tokens"
    )
    research_mode: Optional[str] = Field(
        default="quick",
        description="quick | deep"
    )
    model: Optional[str] = Field(
        default=None,
        description="Model identifier or 'council'"
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


_DEEP_RESEARCH_HINTS = re.compile(
    r"\b(latest|current|recent|breaking|today|this week|this month|compare|comparison|"
    r"trend|trends|overview|survey|analysis|report|new developments|state of|roadmap|"
    r"what changed|how has|global|worldwide|across|multi[- ]?part|in depth|deep dive)\b",
    re.IGNORECASE,
)


def _should_use_deep_research(question: str, history: Optional[list[HistoryMessage]] = None, research_mode: str = "quick") -> bool:
    """Promote broad, current, or multi-part questions into the deep-research path."""
    if detect_time_intent(question):
        return False

    intent = classify_query_intent(question)
    if intent in {"chat", "coaching", "opinion", "shopping"}:
        return False

    if research_mode == "deep":
        return True

    q = (question or "").strip()
    if not q:
        return False

    words = q.split()
    if len(words) >= 18:
        return True

    if _DEEP_RESEARCH_HINTS.search(q):
        return True

    clauses = len(re.findall(r"[;,]|\band\b|\bor\b|\bversus\b|\bvs\b", q, re.IGNORECASE))
    if clauses >= 2 and len(words) >= 10:
        return True

    if history and len(history) >= 3 and len(words) >= 12:
        return True

    return False


def _normalize_requested_model(model_name: str | None) -> str:
    """
    Map retired, unknown, or incorrectly-named model strings to a currently
    supported model. Routes gemini-* to Gemini API, groq models to Groq.

    Priority:
      1. 'council' passthrough
      2. Deprecated / alias redirect (may redirect gemini-mini -> gemini-2.0-flash)
      3. Gemini model passthrough (real models go directly to Gemini API)
      4. SUPPORTED_GROQ_MODELS allowlist
      5. Fallback to GROQ_MODEL with a warning
    """
    default_model = rag.GROQ_MODEL
    if not model_name:
        return default_model

    # 1. Passthrough council
    if model_name == "council":
        return "council"

    # 2. Deprecated / alias redirect
    if model_name in DEPRECATED_MODEL_ALIASES:
        remapped = DEPRECATED_MODEL_ALIASES[model_name]
        print(f"  [Model] '{model_name}' remapped to '{remapped}' (alias/deprecated)")
        return remapped  # may result in a Gemini model after redirect

    # 3. Gemini model — pass through directly to Gemini API handler
    if model_name in SUPPORTED_GEMINI_MODELS:
        if not GEMINI_API_KEY:
            print(f"  [Model] WARNING: '{model_name}' is a Gemini model but GEMINI_API_KEY is not set.")
        return model_name  # handled by _is_gemini_model() check in stream_query

    # 4. Groq allowlist check
    if model_name not in SUPPORTED_GROQ_MODELS:
        print(f"  [Model] WARNING: '{model_name}' not in SUPPORTED_GROQ_MODELS or SUPPORTED_GEMINI_MODELS — "
              f"falling back to '{default_model}'.")
        return default_model

    return model_name



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

@app.get("/documents", dependencies=[Depends(verify_internal_key)])
def list_documents():
    """List all indexed research document sources and total chunk count."""
    sources = get_indexed_sources()
    info    = get_collection_info()
    return {
        "documents":    sources,
        "total_chunks": info.get("points_count", 0),
    }


# ─── Query (standard — full response at once) ─────────────────────────────────

@app.post("/query", response_model=QueryResponse, dependencies=[Depends(verify_internal_key)])
def query(request: QueryRequest):
    """Standard ResearchFlow AI RAG query with conversation memory and answer style control."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    history = None
    if request.history:
        history = [{"role": m.role, "text": m.text} for m in request.history]

    cache_key_raw = f"sync:{request.question}_{request.answer_style}_{request.top_k}_{json.dumps(history)}"
    cache_key = hashlib.md5(cache_key_raw.encode()).hexdigest()

    cached = _sync_query_cache.get(cache_key)
    if cached:
        print("  [Query] Sync cache hit! Returning cached response.")
        cached_dict = cached[0] if isinstance(cached, list) and len(cached) > 0 else cached
        return QueryResponse(**cached_dict)

    try:
        result = answer(
            request.question,
            top_k=request.top_k,
            history=history,
            answer_style=request.answer_style,
        )
    except Exception as e:
        _handle_groq_error(e)

    response_data = {
        "answer": result["answer"],
        "sources": result.get("sources", []),
        "web_sources": result.get("web_sources", []),
        "is_web_fallback": result.get("is_web_fallback", False),
        "intent": result.get("intent", "general"),
    }
    _sync_query_cache.put(cache_key, [response_data])

    return QueryResponse(**response_data)


# ─── OpenAI / Ollama Compatible Endpoint ──────────────────────────────────────

@app.post("/v1/chat/completions", dependencies=[Depends(verify_internal_key)])
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
        "id": f"chatcmpl-researchflow-{int(time.time())}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": request.model or "researchflow-rag",
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
        "researchflow_metadata": {
            "sources":         result.get("sources", []),
            "web_sources":     result.get("web_sources", []),
            "is_web_fallback": result.get("is_web_fallback", False),
            "intent":          result.get("intent", "general"),
        }
    }


# ─── Stream (token-by-token SSE — AsyncGroq Parallel RAG+Web Fusion) ──────────

@app.post("/stream", dependencies=[Depends(verify_internal_key)])
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

    if detect_time_intent(request.question):
        return StreamingResponse(_stream_local_time_response(request.question), media_type="text/event-stream")

    direct_answer_intents = {"chat", "coaching", "opinion"}

    request_model = _normalize_requested_model(request.model)
    using_gemini = _is_gemini_model(request_model)
    if not using_gemini and (not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here"):
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY not configured in backend-python/.env"
        )

    if using_gemini and not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured in backend-python/.env")

    style_name = request.answer_style if request.answer_style in ANSWER_STYLES else None
    history = None
    if request.history:
        history = [{"role": m.role, "text": m.text} for m in request.history]

    use_deep_research = _should_use_deep_research(
        request.question,
        history=history,
        research_mode=request.research_mode or "quick",
    )

    # Generate a cache key
    cache_key_raw = f"{request.question}_{style_name}_{request_model}_{'deep' if use_deep_research else request.research_mode}_{json.dumps(history)}"
    cache_key = hashlib.md5(cache_key_raw.encode()).hexdigest()

    # Check cache for Quick Search mode
    if request.research_mode == "quick":
        cached_events = _query_cache.get(cache_key)
        if cached_events:
            print("  [Stream] Cache hit! Serving instantly.")
            async def replay_cache():
                for event in cached_events:
                    yield event
                    # Tiny sleep to let frontend render text smoothly instead of instantaneously pasting it all
                    await asyncio.sleep(0)
            return StreamingResponse(replay_cache(), media_type="text/event-stream")

    async def generate():
        events_to_cache = []
        
        # Intercept yield to populate cache
        async def yield_event(data):
            events_to_cache.append(data)
            return data

        try:
            # ── Step 0: Classify intent and language immediately ──────────────
            intent      = classify_query_intent(request.question)
            
            # Simple Unicode block check for Urdu/Arabic script
            language = "ur" if re.search(r'[\u0600-\u06FF]', request.question) else "en"
            intent_info = INTENT_META.get(intent, INTENT_META["general"])

            # Auto-select style from intent if not user-specified
            nonlocal style_name
            if style_name is None:
                style_name = intent_info["style"]

            style = ANSWER_STYLES[style_name]

            if intent in direct_answer_intents and not using_gemini:
                print(f"  [Stream] Direct-answer fast path triggered for intent: {intent}")
                yield await yield_event(f"data: {json.dumps({'status_text': '💬 Drafting direct answer...'})}\n\n")

                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S (%A)")
                current_year = datetime.now().year
                sys_c = rag._build_system_prompt(style_name, now_str, current_year)

                if language == "ur":
                    sys_c += "\n\nCRITICAL DIRECTIVE: The user is speaking Urdu. You MUST reply completely in native Urdu language (using Urdu script)."

                usr_c = f"{rag._build_history_xml(history)}<user_query>\n{request.question}\n</user_query>\n\n<response>"

                client = _get_async_groq()
                groq_stream = await client.chat.completions.create(
                    model=request_model,
                    messages=[
                        {"role": "system", "content": sys_c},
                        {"role": "user",   "content": usr_c},
                    ],
                    temperature=rag.LLM_TEMPERATURE,
                    max_tokens=style["max_tokens"],
                    stream=True,
                )

                direct_token_count = 0
                async for chunk in groq_stream:
                    token = chunk.choices[0].delta.content or ""
                    if token:
                        direct_token_count += 1
                        yield await yield_event(f"data: {json.dumps({'token': token})}\n\n")

                if direct_token_count == 0:
                    fallback_text = "I think AI is most useful when it is applied to real problems, checked carefully, and used to augment human judgment rather than replace it."
                    yield await yield_event(f"data: {json.dumps({'token': fallback_text})}\n\n")

                yield await yield_event(f"data: {json.dumps({'done': True, 'sources': [], 'web_sources': [], 'web_results': [], 'is_web_fallback': False, 'refused': False, 'intent': intent, 'intent_info': intent_info, 'rag_source_details': [], 'provider': 'gemini' if using_gemini else 'groq', 'model': request_model})}\n\n")
                _query_cache.put(cache_key, events_to_cache)
                return

            # Emit intent badge right away — frontend shows it immediately
            yield await yield_event(f"data: {json.dumps({'intent': intent, 'intent_info': intent_info, 'language': language})}\n\n")

            if intent == "shopping" and not using_gemini:
                print("  [Stream] Shopping fast-path triggered (web-only comparison)")
                yield await yield_event(f"data: {json.dumps({'status_text': '🛒 Comparing products...'})}\n\n")

                search_query = enrich_query(request.question, history)
                loop = asyncio.get_event_loop()

                async def do_web_shopping():
                    if not rag.WEB_ALWAYS_ON:
                        return []
                    try:
                        return await loop.run_in_executor(rag._executor, perform_web_search, search_query, rag.MAX_WEB_RESULTS)
                    except Exception as e:
                        print(f"Web shopping search error: {e}")
                        return []

                web_results = await do_web_shopping()
                print(f"  [Stream] Shopping web results collected: {len(web_results)}")

                yield await yield_event(f"data: {json.dumps({'status_text': '⚡ Synthesizing comparison table...'})}\n\n")

                sys_c, usr_c = build_shopping_prompt(
                    request.question,
                    web_results,
                    history=history,
                    answer_style=style_name,
                )

                if language == "ur":
                    sys_c += "\n\nCRITICAL DIRECTIVE: The user is speaking Urdu. You MUST reply completely in native Urdu language (using Urdu script)."

                client = _get_async_groq()
                groq_stream = await client.chat.completions.create(
                    model=request_model,
                    messages=[
                        {"role": "system", "content": sys_c},
                        {"role": "user",   "content": usr_c},
                    ],
                    temperature=rag.LLM_TEMPERATURE,
                    max_tokens=style["max_tokens"],
                    stream=True,
                )

                shopping_token_count = 0
                async for chunk in groq_stream:
                    token = chunk.choices[0].delta.content or ""
                    if token:
                        shopping_token_count += 1
                        yield await yield_event(f"data: {json.dumps({'token': token})}\n\n")

                if shopping_token_count == 0:
                    yield await yield_event(f"data: {json.dumps({'token': 'I could not verify live product data, so I cannot confidently rank these options.'})}\n\n")

                web_sources = [r["url"] for r in web_results if r.get("url")]
                web_titles  = [r["title"] for r in web_results if r.get("title")]
                yield await yield_event(f"data: {json.dumps({'done': True, 'sources': web_titles[:3], 'web_sources': web_sources, 'web_results': web_results, 'rag_source_details': [], 'is_web_fallback': True, 'refused': False, 'intent': intent, 'intent_info': intent_info, 'language': language, 'provider': 'gemini' if using_gemini else 'groq', 'model': request_model})}\n\n")
                _query_cache.put(cache_key, events_to_cache)
                return

            # ── Fast-path for chat intent ──────────────────────────────────────────────
            if intent == "chat" and style_name == "conversational" and not using_gemini:
                print("  [Stream] Chat fast-path triggered (bypassing search)")
                yield await yield_event(f"data: {json.dumps({'status_text': '⚡ Chatting...'})}\n\n")
                
                now_str      = datetime.now().strftime("%Y-%m-%d %H:%M:%S (%A)")
                current_year = datetime.now().year
                sys_c = rag._build_system_prompt(style_name, now_str, current_year)
                
                if language == "ur":
                    sys_c += "\n\nCRITICAL DIRECTIVE: The user is speaking Urdu. You MUST reply completely in native Urdu language (using Urdu script)."
                
                usr_c = f"{rag._build_history_xml(history)}<user_query>\n{request.question}\n</user_query>\n\n<response>"
                
                client = _get_async_groq()
                groq_stream = await client.chat.completions.create(
                    model=request_model,
                    messages=[
                        {"role": "system", "content": sys_c},
                        {"role": "user",   "content": usr_c},
                    ],
                    temperature=rag.LLM_TEMPERATURE,
                    max_tokens=style["max_tokens"],
                    stream=True,
                )
                
                async for chunk in groq_stream:
                    token = chunk.choices[0].delta.content or ""
                    if token:
                        yield await yield_event(f"data: {json.dumps({'token': token})}\n\n")
                        
                yield await yield_event(f"data: {json.dumps({'done': True, 'sources': [], 'web_sources': [], 'web_results': [], 'is_web_fallback': False, 'refused': False, 'intent': intent, 'intent_info': intent_info, 'rag_source_details': [], 'provider': 'gemini' if using_gemini else 'groq', 'model': request_model})}\n\n")
                
                # Save to cache
                _query_cache.put(cache_key, events_to_cache)
                return

            # ── Deep Research Mode ───────────────────────────────────────────────────
            if use_deep_research and not using_gemini:
                from src.deep_research import perform_deep_research
                await perform_deep_research(
                    request=request, 
                    history=history, 
                    style_name=style_name, 
                    intent=intent, 
                    intent_info=intent_info, 
                    language=language,
                    client=_get_async_groq(), 
                    yield_event=yield_event, 
                    cache_key=cache_key, 
                    events_to_cache=events_to_cache, 
                    query_cache=_query_cache
                )
                return

            yield await yield_event(f"data: {json.dumps({'status_text': '🔍 Searching knowledge base...'})}\n\n")

            # ── Step 1: Enrich query ──────────────────────────────────────────
            search_query = enrich_query(request.question, history)
            query_needs_web = rag.WEB_ALWAYS_ON or needs_freshness(search_query) or intent in ("shopping", "news")

            yield ": keep-alive\n\n"
            loop = asyncio.get_event_loop()

            # ── Step 2 & 3: Parallel RAG & Smart Web Search ───────────────────
            async def do_rag():
                try:
                    q_vec = await loop.run_in_executor(rag._executor, get_embedding, search_query, True)
                    cands = await loop.run_in_executor(rag._executor, hybrid_search, q_vec, search_query)
                    if cands:
                        return await loop.run_in_executor(rag._executor, rerank, request.question, cands, request.top_k)
                    return []
                except Exception as e:
                    print(f"RAG error: {e}")
                    return []

            async def do_web():
                try:
                    return await loop.run_in_executor(rag._executor, perform_web_search, search_query, rag.MAX_WEB_RESULTS)
                except Exception as e:
                    print(f"Web search error: {e}")
                    return []

            if query_needs_web:
                reranked, web_results = await asyncio.gather(do_rag(), do_web())
            else:
                reranked = await do_rag()
                top_score = reranked[0]["score"] if reranked else -999.0
                should_refuse_rag = not reranked or (top_score < rag.RELEVANCE_THRESHOLD)
                
                if should_refuse_rag or top_score < rag.WEB_SUPPLEMENT_THRESHOLD:
                    print(f"  [Stream] Supplemental web search triggered (top score {round(top_score, 2)} < threshold {rag.WEB_SUPPLEMENT_THRESHOLD})")
                    web_results = await do_web()
                else:
                    print(f"  [Stream] Web search skipped! RAG top score {round(top_score, 2)} >= {rag.WEB_SUPPLEMENT_THRESHOLD}")
                    web_results = []

            yield await yield_event(f"data: {json.dumps({'status_text': '🌐 Enriching with live web intel...'})}\n\n")
            print(f"  [Stream] Web results collected: {len(web_results)}")

            # ── Step 6: Guardrails ────────────────────────────────────────────
            if reranked:
                _, refuse_reason, passing_chunks = check_guardrails(reranked)
            else:
                refuse_reason  = "No RAG candidates"
                passing_chunks = []
            should_refuse = False

            if should_refuse and not web_results:
                yield await yield_event(f"data: {json.dumps({'token': REFUSAL_MSG})}\n\n")
                yield await yield_event(f"data: {json.dumps({'done': True, 'sources': [], 'web_sources': [], 'web_results': [], 'is_web_fallback': False, 'refused': True, 'intent': intent, 'provider': 'gemini' if using_gemini else 'groq', 'model': request_model})}\n\n")
                _query_cache.put(cache_key, events_to_cache)
                return

            # ── Step 7: Build FUSED prompt ────────────────────────────────────
            yield await yield_event(f"data: {json.dumps({'status_text': '⚡ Synthesizing answer...'})}\n\n")

            sys_c, usr_c = build_fused_prompt(
                request.question,
                passing_chunks,
                web_results,
                history=history,
                answer_style=style_name,
            )

            if language == "ur":
                sys_c += "\n\nCRITICAL DIRECTIVE: The user is speaking Urdu. You MUST reply completely in native Urdu language (using Urdu script), ensuring high-quality formatting and correct terminology."

            # ── Step 8: Route to Gemini or Groq based on model selection ─────

            # Always use Groq for related questions (fast, cheap, 3 short Qs)
            _groq_client_for_related = _get_async_groq() if GROQ_API_KEY else None
            effective_max_tokens = min(
                request.max_tokens or style.get("max_tokens", 2000),
                style.get("max_tokens", 2000),
                getattr(rag, "GLOBAL_MAX_TOKENS", 3000)
            )

            # ─── GEMINI ROUTE ────────────────────────────────────────────────
            if _is_gemini_model(request_model):
                yield await yield_event(f"data: {json.dumps({'status_text': f'🤖 Streaming from Gemini ({request_model})...'})}\n\n")
                async def fetch_related_questions_gemini():
                    if _groq_client_for_related is None:
                        return []
                    try:
                        sys_r = "You are an AI research assistant. Based on the user's query, suggest exactly 3 short, relevant follow-up questions. Output ONLY a JSON object with a single key 'questions' containing an array of 3 strings."
                        resp = await _groq_client_for_related.chat.completions.create(
                            model=rag.GROQ_MODEL,
                            messages=[{"role": "system", "content": sys_r}, {"role": "user", "content": request.question}],
                            temperature=0.3, max_tokens=200, response_format={"type": "json_object"}
                        )
                        return json.loads(resp.choices[0].message.content).get("questions", [])[:3]
                    except Exception:
                        return []
                related_task = asyncio.create_task(fetch_related_questions_gemini())
                try:
                    from google import genai as google_genai
                    from google.genai import types as genai_types
                    # Use API v1 (stable) — v1beta returns 404 for gemini-1.5/2.0 models
                    gem_client = google_genai.Client(
                        api_key=GEMINI_API_KEY,
                        http_options={"api_version": "v1"},
                    )
                    full_response = ""
                    # Combined system + user prompt (new SDK uses single `contents` field)
                    combined_prompt = f"{sys_c}\n\n---\n\n{usr_c}"
                    async for chunk in await gem_client.aio.models.generate_content_stream(
                        model=request_model,
                        contents=combined_prompt,
                        config=genai_types.GenerateContentConfig(
                            max_output_tokens=effective_max_tokens,
                            temperature=rag.LLM_TEMPERATURE,
                        ),
                    ):
                        token = (chunk.text or "") if hasattr(chunk, "text") else ""
                        if token:
                            full_response += token
                            yield await yield_event(f"data: {json.dumps({'token': token})}\n\n")
                            await asyncio.sleep(0)

                    related_questions = await related_task
                    rag_sources  = list({c["source"] for c in passing_chunks})
                    web_src_urls = [r["url"] for r in web_results if r.get("url")]
                    rag_source_details = []
                    for src in rag_sources:
                        src_chunks = [c for c in passing_chunks if c["source"] == src]
                        top_score  = max((c.get("rerank_score", -99) for c in src_chunks), default=-99)
                        rag_source_details.append({"source": src, "chunks": len(src_chunks), "confidence": source_confidence_score(top_score)})
                    yield await yield_event(f"data: {json.dumps({'done': True, 'sources': rag_sources, 'web_sources': web_src_urls, 'web_results': web_results, 'rag_source_details': rag_source_details, 'is_web_fallback': bool(should_refuse), 'refused': False, 'intent': intent, 'intent_info': intent_info, 'language': language, 'related_questions': related_questions, 'provider': 'gemini', 'model': request_model})}\n\n")
                    if request.research_mode == "quick":
                        _query_cache.put(cache_key, events_to_cache)
                    return
                except ImportError:
                    yield f"data: {json.dumps({'error': '🔧 google-genai package missing. Run: pip install google-genai'})}\n\n"
                    return
                except Exception as gemini_err:
                    err_str = str(gemini_err)
                    print(f"  [Gemini Error] {err_str}")
                    if "API_KEY" in err_str or "API key" in err_str or "UNAUTHENTICATED" in err_str or "invalid" in err_str.lower():
                        yield f"data: {json.dumps({'error': '🔑 Gemini API key missing or invalid. Add GEMINI_API_KEY=your_key to backend-python/.env — free key at https://aistudio.google.com/app/apikey'})}\n\n"
                    elif "quota" in err_str.lower() or "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        yield f"data: {json.dumps({'error': '⏳ Gemini free-tier rate limit reached. Wait 1 minute or switch to a Groq model.'})}\n\n"
                    else:
                        yield f"data: {json.dumps({'error': f'Gemini error: {err_str[:200]}'})}\n\n"
                    return

            # ─── GROQ ROUTE ──────────────────────────────────────────────────
            # BUG FIX: client MUST be initialised before creating the related_task
            client = _groq_client_for_related


            # Start fetching related questions concurrently (client is now defined)
            async def fetch_related_questions():
                try:
                    sys_r = "You are an AI research assistant. Based on the user's query, suggest exactly 3 short, relevant follow-up questions they could ask to learn more. Output ONLY a JSON object with a single key 'questions' containing an array of 3 strings."
                    if language == "ur":
                        sys_r += " The user's query is in Urdu, so the follow-up questions MUST be in Urdu."
                    resp = await client.chat.completions.create(
                        model=rag.GROQ_MODEL,
                        messages=[
                            {"role": "system", "content": sys_r},
                            {"role": "user", "content": request.question},
                        ],
                        temperature=0.3,
                        max_tokens=200,
                        response_format={"type": "json_object"}
                    )
                    parsed = json.loads(resp.choices[0].message.content)
                    return parsed.get("questions", [])[:3]
                except Exception as e:
                    print(f"  [Related Questions Error]: {e}")
                    return []

            related_task = asyncio.create_task(fetch_related_questions())

            is_council = (request_model == "council")
            target_models = COUNCIL_MODELS if is_council else [request_model]
            
            full_response = ""
            
            async def stream_model(mod_name):
                nonlocal full_response
                try:
                    stream = await client.chat.completions.create(
                        model=mod_name,
                        messages=[
                            {"role": "system", "content": sys_c},
                            {"role": "user",   "content": usr_c},
                        ],
                        temperature=rag.LLM_TEMPERATURE,
                        max_tokens=effective_max_tokens,
                        stream=True,
                    )
                    count = 0
                    async for chunk in stream:
                        token = chunk.choices[0].delta.content or ""
                        if token:
                            count += 1
                            if not is_council:
                                full_response += token
                            
                            payload = {'model': mod_name, 'token': token} if is_council else {'token': token}
                            yield await yield_event(f"data: {json.dumps(payload)}\n\n")
                            
                            if count % 20 == 0:
                                await asyncio.sleep(0)
                except Exception as e:
                    print(f"  [Stream Error for {mod_name}]: {e}")

            # Run all models concurrently, but we must yield from them as they produce chunks.
            # To do this safely inside an async generator, we use an asyncio.Queue
            queue = asyncio.Queue()
            
            async def producer(mod_name):
                try:
                    stream = await client.chat.completions.create(
                        model=mod_name,
                        messages=[
                            {"role": "system", "content": sys_c},
                            {"role": "user",   "content": usr_c},
                        ],
                        temperature=rag.LLM_TEMPERATURE,
                        max_tokens=effective_max_tokens,
                        stream=True,
                    )
                    async for chunk in stream:
                        token = chunk.choices[0].delta.content or ""
                        if token:
                            await queue.put({'model': mod_name, 'token': token})
                except Exception as e:
                    err_str = str(e)
                    print(f"  [Stream Error for {mod_name}]: {err_str}")
                    # Emit a visible SSE error token so the user sees the failure
                    # instead of silently getting a different model's output.
                    if is_council:
                        await queue.put({'model': mod_name, 'token': f'\n\n> ⚠️ Model `{mod_name}` error: {err_str[:120]}\n'})
                finally:
                    await queue.put({"_done": mod_name})

            # Start producers
            tasks = [asyncio.create_task(producer(m)) for m in target_models]
            
            # Consume from queue
            active_producers = len(target_models)
            count = 0
            tokens_emitted = 0
            while active_producers > 0:
                item = await queue.get()
                if "_done" in item:
                    active_producers -= 1
                else:
                    tokens_emitted += 1
                    if not is_council:
                        full_response += item['token']
                        payload = {'token': item['token']}
                    else:
                        payload = item
                    
                    yield await yield_event(f"data: {json.dumps(payload)}\n\n")
                    
                    count += 1
                    if count % 20 == 0:
                        await asyncio.sleep(0)

            if not is_council and tokens_emitted == 0:
                print("  [Stream] No streamed tokens received, falling back to supported default model")
                fallback_stream = await client.chat.completions.create(
                    model=rag.GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": sys_c},
                        {"role": "user",   "content": usr_c},
                    ],
                    temperature=rag.LLM_TEMPERATURE,
                    max_tokens=effective_max_tokens,
                    stream=True,
                )
                async for fallback_chunk in fallback_stream:
                    fallback_token = fallback_chunk.choices[0].delta.content or ""
                    if fallback_token:
                        full_response += fallback_token
                        yield await yield_event(f"data: {json.dumps({'token': fallback_token})}\n\n")

            if is_council and tokens_emitted == 0:
                print("  [Council] No streamed tokens received, falling back to single-model synthesis")
                fallback_stream = await client.chat.completions.create(
                    model=rag.GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": sys_c},
                        {"role": "user",   "content": usr_c},
                    ],
                    temperature=rag.LLM_TEMPERATURE,
                    max_tokens=effective_max_tokens,
                    stream=True,
                )
                async for fallback_chunk in fallback_stream:
                    fallback_token = fallback_chunk.choices[0].delta.content or ""
                    if fallback_token:
                        full_response += fallback_token
                        yield await yield_event(f"data: {json.dumps({'token': fallback_token})}\n\n")


            # ── Step 9: Layer 3 — off-document detection ──────────────────────
            if detect_off_document_answer(full_response) and passing_chunks and web_results:
                print("  [Stream L3] INSUFFICIENT_DOCUMENT_COVERAGE — retrying web-primary")
                yield await yield_event(f"data: {json.dumps({'replace': ''})}\n\n")
                yield await yield_event(f"data: {json.dumps({'status_text': '🌐 Re-fetching with web-primary context...'})}\n\n")

                sys_c2, usr_c2 = build_fused_prompt(
                    request.question, [], web_results,
                    history=history, answer_style=style_name,
                )
                
                if language == "ur":
                    sys_c2 += "\n\nCRITICAL DIRECTIVE: The user is speaking Urdu. You MUST reply completely in native Urdu language (using Urdu script)."
                groq_stream2 = await client.chat.completions.create(
                    model=rag.GROQ_MODEL,
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
                        yield await yield_event(f"data: {json.dumps({'token': token2})}\n\n")

                web_sources = [r["url"]   for r in web_results if r.get("url")]
                web_titles  = [r["title"] for r in web_results if r.get("title")]
                yield await yield_event(f"data: {json.dumps({'done': True, 'sources': web_titles[:3], 'web_sources': web_sources, 'web_results': web_results, 'rag_source_details': [], 'is_web_fallback': True, 'refused': False, 'intent': intent, 'intent_info': intent_info, 'provider': 'gemini' if using_gemini else 'groq', 'model': request_model})}\n\n")
                _query_cache.put(cache_key, events_to_cache)
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

            related_questions = await related_task
            yield await yield_event(f"data: {json.dumps({'done': True, 'sources': rag_sources, 'web_sources': web_sources, 'web_results': web_results, 'rag_source_details': rag_source_details, 'is_web_fallback': bool(should_refuse), 'refused': False, 'intent': intent, 'intent_info': intent_info, 'language': language, 'related_questions': related_questions, 'provider': 'gemini' if using_gemini else 'groq', 'model': request_model})}\n\n")

            # Cache the successful response
            if request.research_mode == "quick":
                _query_cache.put(cache_key, events_to_cache)

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


async def _stream_local_time_response(question: str):
    """Emit a fast SSE response for current date/time queries without hitting RAG or web search."""
    payload = build_current_time_response(question)
    yield f"data: {json.dumps({'status_text': '🕒 Answering with local server time...'})}\n\n"
    yield f"data: {json.dumps({'intent': 'general', 'intent_info': INTENT_META['general'], 'language': 'en'})}\n\n"
    for line in payload["answer"].splitlines():
        if line:
            yield f"data: {json.dumps({'token': line + '\n'})}\n\n"
    yield f"data: {json.dumps({'done': True, 'sources': [], 'web_sources': [], 'web_results': [], 'rag_source_details': [], 'is_web_fallback': False, 'refused': False, 'intent': 'general', 'intent_info': INTENT_META['general'], 'language': 'en', 'related_questions': []})}\n\n"


# ─── Upload ───────────────────────────────────────────────────────────────────

@app.post("/upload", dependencies=[Depends(verify_internal_key)])
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a research document (PDF, TXT, DOCX, MD).
    Auto-chunks with semantic boundaries, embeds with BGE-base, stores in Qdrant.
    Includes SHA-256 content deduplication and incremental BM25 index updates.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename cannot be empty.")

    safe_filename, save_path = _sanitize_doc_path(file.filename)

    allowed = {".pdf", ".txt", ".docx", ".md"}
    ext     = os.path.splitext(safe_filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: PDF, TXT, DOCX, MD"
        )

    MAX_SIZE = 50 * 1024 * 1024  # 50MB
    content  = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 50MB.")

    # ── SHA-256 Content Deduplication Check ────────────────────────────────────
    content_hash = hashlib.sha256(content).hexdigest()
    client = vector_store.get_client()
    if client:
        try:
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            existing, _ = client.scroll(
                collection_name=vector_store.COLLECTION_NAME,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(key="source", match=MatchValue(value=safe_filename)),
                        FieldCondition(key="content_hash", match=MatchValue(value=content_hash)),
                    ]
                ),
                limit=1,
                with_payload=False,
                with_vectors=False,
            )
            if existing and len(existing) > 0:
                print(f"  [Upload] Document '{safe_filename}' content hash unchanged ({content_hash[:8]}). Skipping re-index.")
                return {
                    "message": f"Document '{safe_filename}' is unchanged, skipping re-index.",
                    "skipped": True,
                    "source": safe_filename,
                    "file_size_kb": round(len(content) / 1024, 1),
                }
        except Exception as hash_err:
            print(f"  [Upload] Deduplication check warning: {hash_err}")

    os.makedirs(DOCS_FOLDER, exist_ok=True)

    with open(save_path, "wb") as f:
        f.write(content)

    print(f"Uploaded: {safe_filename} ({len(content) / 1024:.1f} KB)")

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

        chunks = chunk_document(pages, source_name=safe_filename)
        for c in chunks:
            if "metadata" not in c:
                c["metadata"] = {}
            c["metadata"]["content_hash"] = content_hash

        embedded = embed_chunks(chunks)
        store_chunks(embedded, recreate=False)   # Incremental — don't wipe existing

        # ── Incremental BM25 Add ──────────────────────────────────────────────
        bm25_chunks = []
        for c in chunks:
            meta = c.get("metadata", {})
            bm25_chunks.append({
                "id": c.get("id"),
                "text": c.get("text", ""),
                "source": safe_filename,
                "chunk_index": meta.get("chunk_index", 0),
                "pages": meta.get("pages", [1]),
                "content_type": meta.get("content_type", "general"),
                "cves": meta.get("cves", []),
                "section": meta.get("section", ""),
            })
        add_chunks_to_bm25(bm25_chunks)

        code_chunks = sum(1 for c in chunks if c["metadata"].get("content_type") == "code")
        cve_chunks  = sum(1 for c in chunks if c["metadata"].get("cves"))

        return {
            "message":        f"Successfully indexed '{safe_filename}'",
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

@app.delete("/documents/{source}", dependencies=[Depends(verify_internal_key)])
def delete_document(source: str):
    """Delete a research document and all its vector chunks from Qdrant."""
    from src.vector_store import delete_document_by_source

    safe_source, file_path = _sanitize_doc_path(source)

    print(f"Deleting document: '{safe_source}'...")
    deleted_from_qdrant = delete_document_by_source(safe_source)

    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            print(f"  Deleted local file '{file_path}'")
        except Exception as e:
            print(f"  Warning: could not delete file '{file_path}': {e}")

    # Incremental BM25 Remove
    remove_chunks_from_bm25(safe_source)

    return {
        "status":               "ok",
        "message":              f"Successfully deleted document '{safe_source}'",
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


@app.get("/settings", dependencies=[Depends(verify_internal_key)])
def get_settings():
    """Get current active ResearchFlow AI runtime thresholds."""
    return {
        "guardrail": {
            "threshold": rag.RELEVANCE_THRESHOLD,
            "minChunks": rag.MIN_RELEVANT_CHUNKS,
        },
        "llm": {
            "provider": getattr(rag, "LLM_PROVIDER", "groq"),
            "model": getattr(rag, "GROQ_MODEL", "llama-3.3-70b-versatile"),
            "geminiModel": getattr(rag, "GEMINI_MODEL", "gemini-mini"),
            "maxTokens": getattr(rag, "GLOBAL_MAX_TOKENS", 4000),
        },
        "max_tokens":    getattr(rag, "GLOBAL_MAX_TOKENS", 4000),
        "answer_styles": list(ANSWER_STYLES.keys()),
        "default_style": DEFAULT_STYLE,
    }


@app.post("/settings", dependencies=[Depends(verify_internal_key)])
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

    # Update LLM provider/model runtime hints if provided
    if update.llm and isinstance(update.llm, dict):
        if "provider" in update.llm:
            try:
                rag.LLM_PROVIDER = str(update.llm["provider"]).lower()
                print(f"  [Runtime] LLM_PROVIDER = {rag.LLM_PROVIDER}")
            except Exception:
                pass
        if "geminiModel" in update.llm:
            try:
                rag.GEMINI_MODEL = str(update.llm["geminiModel"])
                print(f"  [Runtime] GEMINI_MODEL = {rag.GEMINI_MODEL}")
            except Exception:
                pass
        if "model" in update.llm:
            try:
                rag.GROQ_MODEL = str(update.llm["model"])
                print(f"  [Runtime] GROQ_MODEL = {rag.GROQ_MODEL}")
            except Exception:
                pass

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

@app.post("/rebuild-index", dependencies=[Depends(verify_internal_key)])
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
