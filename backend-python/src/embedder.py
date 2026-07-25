"""
Local embedding using FastEmbed (ONNX runtime).
Runs entirely on CPU — no VPS, no GPU, no network required.
Supports batch embedding for fast indexing of large document sets.

v2.1 — Added LRU query cache (128 entries) for instant repeated queries.
"""
import os
import hashlib
from collections import OrderedDict
from dotenv import load_dotenv
from fastembed import TextEmbedding

load_dotenv()

EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-ai/nomic-embed-text-v1.5")
EMBED_BATCH_SIZE = int(os.getenv("EMBED_BATCH_SIZE", "32"))  # Safe for 8GB RAM

# Lazy-load model (downloads ~140MB on first run, cached after that)
_model = None

# ─── LRU Query Embedding Cache ───────────────────────────────────────────────
_CACHE_MAX = 128
_query_cache = OrderedDict()


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        print(f"Loading embedding model: {EMBED_MODEL} (first run downloads ~140MB)...")
        _model = TextEmbedding(model_name=EMBED_MODEL)
        print("Embedding model loaded.")
    return _model


def warmup():
    """Pre-load embedding model so first real query is instant."""
    _get_model()
    print("Embedder warmed up.")


def _cache_key(text: str) -> str:
    """Fast hash for cache lookup."""
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def get_embedding(text: str, is_query: bool = True) -> list[float]:
    """
    Embed a single text string locally using FastEmbed ONNX.
    Uses task-specific prefixes for nomic-embed-text (search_query / search_document).
    Query embeddings are cached (LRU-128) for instant repeated lookups.
    """
    prefix = "search_query: " if is_query else "search_document: "
    prefixed = prefix + text

    # Check cache for queries
    if is_query:
        key = _cache_key(prefixed)
        if key in _query_cache:
            _query_cache.move_to_end(key)
            return _query_cache[key]

    model = _get_model()

    # FastEmbed returns a generator, convert to list
    embeddings = list(model.embed([prefixed]))
    result = embeddings[0].tolist()

    # Store in cache for queries
    if is_query:
        _query_cache[key] = result
        if len(_query_cache) > _CACHE_MAX:
            _query_cache.popitem(last=False)

    return result


def embed_chunks(chunks: list[dict]) -> list[dict]:
    """
    Batch-embed all chunks locally using FastEmbed ONNX.
    Streams one batch at a time to stay within 8GB RAM limits.
    """
    from tqdm import tqdm

    model = _get_model()
    total = len(chunks)

    print(f"Embedding {total} chunks locally using {EMBED_MODEL}...")
    print(f"  Batch size: {EMBED_BATCH_SIZE} (RAM-safe for 8GB)")

    # Process in explicit batches to avoid OOM — stream one batch at a time
    for start in tqdm(range(0, total, EMBED_BATCH_SIZE), desc="  Embedding", unit="batch"):
        batch = chunks[start: start + EMBED_BATCH_SIZE]
        texts = ["search_document: " + c["text"] for c in batch]

        # embed() returns a generator — consume immediately, don't buffer all
        embeddings = list(model.embed(texts, batch_size=EMBED_BATCH_SIZE))

        for i, chunk in enumerate(batch):
            chunk["embedding"] = embeddings[i].tolist()

    print(f"Embedding complete. {total} chunks embedded.")
    return chunks
