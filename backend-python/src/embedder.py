"""
ResearchFlow AI — Local Embedding Engine
Uses BAAI/bge-m3 via FastEmbed (ONNX runtime).

Why BGE-m3:
  - 1024-dim dense vectors for high retrieval accuracy
  - Multilingual support including English, Urdu, and technical jargon
  - High recall on research, technical, and domain-specific corpora
  - Downloads once on first run and caches automatically

v4.0 — Optimized with LRU cache (256 entries) for instant repeated lookups.
"""
import os
import hashlib
import threading
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs):
        return False
from fastembed import TextEmbedding

load_dotenv()

# BAAI/bge-m3: 1024-dim, multilingual (Urdu support)
EMBED_MODEL      = os.getenv("EMBED_MODEL", "BAAI/bge-m3")
EMBED_BATCH_SIZE = int(os.getenv("EMBED_BATCH_SIZE", "16"))  # Safe for 8GB RAM

# BGE-m3 does not require a query prefix for standard usage
BGE_QUERY_PREFIX = ""

# Lazy-load model (downloads ~440MB on first run, cached after that)
_model = None

# ─── LRU Query Embedding Cache ───────────────────────────────────────────────
_CACHE_MAX   = 256
_query_cache = OrderedDict()
_cache_lock = threading.Lock()
_model_lock = threading.Lock()


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                print(f"Loading embedding model: {EMBED_MODEL}")
                _model = TextEmbedding(model_name=EMBED_MODEL)
                print("Embedding model loaded successfully.")
    return _model


def warmup():
    """Pre-load embedding model so first real query is instant."""
    _get_model()
    print("Embedder warmed up.")


def _cache_key(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def get_embedding(text: str, is_query: bool = True) -> list[float]:
    """
    Embed a single text string locally using FastEmbed ONNX.

    BGE models require a specific prefix for queries to align the embedding
    space correctly. Documents are stored without the prefix (FastEmbed handles
    the document-side prefix internally via the model config).

    Query embeddings are cached (LRU-256) for instant repeated lookups.
    """
    # For BGE models: manually prepend query prefix so BM25 + vector queries align
    prefixed = (BGE_QUERY_PREFIX + text) if is_query else text

    # Check LRU cache for queries
    if is_query:
        key = _cache_key(prefixed)
        with _cache_lock:
            if key in _query_cache:
                _query_cache.move_to_end(key)
                return _query_cache[key]

    model = _get_model()
    embeddings = list(model.embed([prefixed]))
    result = embeddings[0].tolist()

    if is_query:
        with _cache_lock:
            _query_cache[key] = result
            if len(_query_cache) > _CACHE_MAX:
                _query_cache.popitem(last=False)

    return result


def embed_chunks(chunks: list[dict]) -> list[dict]:
    """
    Batch-embed all chunks locally using FastEmbed ONNX.
    Streams one batch at a time to stay within 8GB RAM limits.
    Each text is embedded as a document (no query prefix) for best retrieval quality.
    """
    from tqdm import tqdm

    model = _get_model()
    total = len(chunks)

    print(f"Embedding {total} chunks with {EMBED_MODEL}...")
    print(f"  Batch size: {EMBED_BATCH_SIZE} (8GB RAM safe)")

    for start in tqdm(range(0, total, EMBED_BATCH_SIZE), desc="  Embedding", unit="batch"):
        batch = chunks[start: start + EMBED_BATCH_SIZE]
        # BGE-base uses "Represent this sentence for searching relevant passages: " for docs too
        # but FastEmbed's internal model config applies this — we pass raw text
        texts = [c["text"] for c in batch]

        embeddings = list(model.embed(texts, batch_size=EMBED_BATCH_SIZE))

        for i, chunk in enumerate(batch):
            chunk["embedding"] = embeddings[i].tolist()

    print(f"Embedding complete. {total} chunks embedded.")
    return chunks
