"""
ResearchFlow AI — Hybrid Search Engine
Combines dense vector search (Qdrant/BGE) with sparse keyword search (BM25).
Results fused via Reciprocal Rank Fusion (RRF) for maximum recall.

v4.1 — Bug Fixes:
  - Bug 4 Fix: Added threading.Lock around all _bm25_index/_bm25_chunks mutations
    to prevent race conditions when multiple requests arrive simultaneously.
  - Bug 5 Fix: Added threading.Event (_bm25_building) so concurrent requests
    wait for the first build to complete rather than triggering parallel rebuilds
    that could stall request threads for 5–15 seconds.

  - Query expansion: auto-expand cybersec acronyms for better BM25 keyword hits
  - Cybersec-aware BM25 tokenizer: removes generic stopwords, preserves tool names
  - Increased candidate pool: 30 (up from 20) for richer reranker input
  - Rich metadata pass-through: content_type, cves, section propagated to pipeline
"""
import os
import re
import threading
try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs):
        return False
from rank_bm25 import BM25Okapi
import src.vector_store as vector_store

load_dotenv()

COLLECTION_NAME        = os.getenv("COLLECTION_NAME",        "researchflow")
HYBRID_CANDIDATE_COUNT = int(os.getenv("HYBRID_CANDIDATE_COUNT", "50"))  # v6.0: increased from 30 for wider recall

# ─── Thread-safe BM25 index cache (Bug 4 & 5 Fix) ────────────────────────────
_bm25_index   = None
_bm25_chunks  = None
_bm25_lock    = threading.Lock()   # Protects reads/writes to index+chunks
_bm25_building = threading.Event() # Signals when a build is in progress
_bm25_ready   = threading.Event() # Signals when index is valid and ready

# ─── Acronym expansion map ──────────────────────────────────────────
# Expands common abbreviations so BM25 finds them in verbose document text
_ACRONYM_MAP: dict[str, str] = {
    # Add domain-specific acronyms here if needed
}

# Generic English stopwords to remove from BM25 — but KEEP security terms
_GENERIC_STOPWORDS = {
    "the", "and", "for", "are", "but", "not", "you", "all", "can",
    "her", "was", "one", "our", "out", "day", "get", "has", "him",
    "his", "how", "its", "may", "new", "now", "old", "see", "two",
    "who", "did", "she", "too", "use", "dad", "let", "put", "say",
    "she", "too", "use", "via", "very", "been", "that", "this",
    "with", "have", "will", "from", "they", "know", "want", "been",
    "good", "much", "some", "time", "very", "when", "come", "here",
    "just", "like", "long", "make", "many", "more", "only", "over",
    "such", "take", "than", "them", "well", "were",
}


def _tokenize(text: str) -> list[str]:
    """
    Research-aware tokenizer:
    - Lowercases everything
    - Preserves hyphens in CVE IDs (CVE-2021-44228)
    - Removes generic stopwords but keeps all security terms
    - Min token length: 2
    """
    # Preserve CVE-YYYY-NNNN as single tokens
    text_lower = text.lower()
    tokens = re.findall(r'\bcve-\d{4}-\d+\b|[a-z0-9_&\-]{2,}', text_lower)
    return [t for t in tokens if t not in _GENERIC_STOPWORDS]


def _expand_query(query: str) -> str:
    """
    Expand research acronyms in the query so BM25 can find verbose descriptions.
    E.g.: "explain XSS" → "explain XSS cross site scripting xss"
    """
    expanded_terms = []
    query_lower = query.lower()

    for acronym, expansion in _ACRONYM_MAP.items():
        if re.search(r'\b' + re.escape(acronym) + r'\b', query_lower):
            expanded_terms.append(expansion)

    if expanded_terms:
        expanded = query + " " + " ".join(expanded_terms)
        print(f"  [Query Expansion] '{query[:50]}' → added: {expanded_terms}")
        return expanded

    return query


def _build_bm25_index():
    """
    Build BM25 index from all chunks stored in Qdrant.

    Bug 4 & 5 Fix: Protected by _bm25_lock to prevent concurrent rebuilds.
    Uses _bm25_building Event as a guard — only one thread does the rebuild;
    others return immediately (they'll use the index once it's ready via
    _bm25_ready event).
    """
    global _bm25_index, _bm25_chunks

    # If already building in another thread, wait for it to finish
    if _bm25_building.is_set():
        print("  [BM25] Build already in progress, waiting...")
        _bm25_ready.wait(timeout=30)
        return

    with _bm25_lock:
        # Double-check inside lock
        if _bm25_index is not None:
            return

        _bm25_building.set()
        _bm25_ready.clear()

    try:
        client = vector_store.get_client()
        all_chunks = []
        offset = None

        while True:
            results = client.scroll(
                collection_name=COLLECTION_NAME,
                limit=500,
                offset=offset,
                with_payload=True,
                with_vectors=False
            )
            points, next_offset = results

            for point in points:
                all_chunks.append({
                    "id":           point.id,
                    "text":         point.payload.get("text",         ""),
                    "source":       point.payload.get("source",       ""),
                    "chunk_index":  point.payload.get("chunk_index",  0),
                    "pages":        point.payload.get("pages",        [1]),
                    "content_type": point.payload.get("content_type", "general"),
                    "cves":         point.payload.get("cves",         []),
                    "section":      point.payload.get("section",      ""),
                })

            if next_offset is None:
                break
            offset = next_offset

        with _bm25_lock:
            if not all_chunks:
                _bm25_index  = None
                _bm25_chunks = []
            else:
                tokenized_corpus = [_tokenize(c["text"]) for c in all_chunks]
                _bm25_index  = BM25Okapi(tokenized_corpus)
                _bm25_chunks = all_chunks
                print(f"  BM25 index built: {len(all_chunks)} chunks indexed (research tokenizer)")
    except Exception as e:
        print(f"  [BM25] Build failed: {e}")
    finally:
        _bm25_building.clear()
        _bm25_ready.set()


def get_bm25_results(query: str, top_k: int = 30) -> list[dict]:
    """Search using BM25 keyword matching with query expansion."""

    # If index is not ready: trigger build (non-blocking guard) then wait
    with _bm25_lock:
        index_ready = _bm25_index is not None

    if not index_ready:
        # Only one thread will do the build; others wait via Event
        _build_bm25_index()

        with _bm25_lock:
            if _bm25_index is None or not _bm25_chunks:
                return []

    with _bm25_lock:
        index   = _bm25_index
        chunks  = _bm25_chunks

    if index is None or not chunks:
        return []

    # Expand query for better keyword coverage
    expanded = _expand_query(query)
    tokenized_query = _tokenize(expanded)
    scores = index.get_scores(tokenized_query)

    scored = [(i, float(scores[i])) for i in range(len(scores))]
    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:top_k]

    results = []
    for idx, score in top:
        if score > 0:
            chunk = chunks[idx]
            results.append({
                "text":         chunk["text"],
                "source":       chunk["source"],
                "chunk_index":  chunk["chunk_index"],
                "pages":        chunk.get("pages",        [1]),
                "content_type": chunk.get("content_type", "general"),
                "cves":         chunk.get("cves",         []),
                "section":      chunk.get("section",      ""),
                "score":        score,
                "method":       "bm25",
            })

    return results


def reciprocal_rank_fusion(
    vector_results: list[dict],
    bm25_results:   list[dict],
    k: int = 40    # v6.0: tuned from 60 → 40 for stronger rank boosting of top hits
) -> list[dict]:
    """
    Reciprocal Rank Fusion (RRF) to merge vector and BM25 results.
    RRF score = Σ 1/(k + rank) across all retrieval methods.
    Documents appearing in BOTH lists get a significant boost.
    """
    fused_scores: dict = {}
    chunk_data:   dict = {}

    for rank, result in enumerate(vector_results):
        key = (result["source"], result["chunk_index"])
        fused_scores[key] = fused_scores.get(key, 0.0) + 1.0 / (k + rank + 1)
        chunk_data[key]   = result
        chunk_data[key]["vector_score"] = result.get("score", 0)

    for rank, result in enumerate(bm25_results):
        key = (result["source"], result["chunk_index"])
        fused_scores[key] = fused_scores.get(key, 0.0) + 1.0 / (k + rank + 1)
        if key not in chunk_data:
            chunk_data[key] = result
        chunk_data[key]["bm25_score"] = result.get("score", 0)

    sorted_keys = sorted(fused_scores.keys(), key=lambda k: fused_scores[k], reverse=True)

    results = []
    for key in sorted_keys:
        data = chunk_data[key]
        data["rrf_score"] = round(fused_scores[key], 6)
        data["score"]     = data["rrf_score"]
        data["method"]    = "hybrid"
        results.append(data)

    return results


def hybrid_search(query_vector: list[float], query_text: str, top_k: int = None) -> list[dict]:
    """
    Full hybrid search:
    1. Dense vector search (BGE embeddings, Qdrant HNSW)
    2. BM25 keyword search (with query expansion)
    3. RRF fusion of both result lists
    """
    if top_k is None:
        top_k = HYBRID_CANDIDATE_COUNT

    # 1. Vector search (call through vector_store so callers can monkeypatch at runtime)
    vector_results = vector_store.search(query_vector, top_k=top_k)
    for r in vector_results:
        r["method"] = "vector"

    # 2. BM25 search (with query expansion)
    bm25_results = get_bm25_results(query_text, top_k=top_k)

    # 3. Fuse
    fused = reciprocal_rank_fusion(vector_results, bm25_results)

    return fused


def rebuild_bm25_index():
    """Force rebuild of BM25 index (call after re-indexing documents)."""
    global _bm25_index, _bm25_chunks
    with _bm25_lock:
        _bm25_index  = None
        _bm25_chunks = None
    _bm25_ready.clear()
    _bm25_building.clear()
    _build_bm25_index()
