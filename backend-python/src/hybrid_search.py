"""
Hybrid search combining dense vector search (Qdrant) with sparse keyword search (BM25).
Results are fused using Reciprocal Rank Fusion (RRF) for optimal retrieval quality.
"""
import os
import re
from dotenv import load_dotenv
from rank_bm25 import BM25Okapi
from src.vector_store import search as vector_search, get_client

load_dotenv()

COLLECTION_NAME = os.getenv("COLLECTION_NAME", "medresearch")
HYBRID_CANDIDATE_COUNT = int(os.getenv("HYBRID_CANDIDATE_COUNT", "20"))

# Module-level BM25 index cache
_bm25_index = None
_bm25_chunks = None


def _tokenize(text: str) -> list[str]:
    """Simple tokenizer: lowercase, split on non-alphanumeric, remove short tokens."""
    tokens = re.findall(r'\b[a-z0-9]{2,}\b', text.lower())
    return tokens


def _build_bm25_index():
    """Build BM25 index from all chunks stored in Qdrant."""
    global _bm25_index, _bm25_chunks

    client = get_client()

    # Scroll through all points in the collection
    all_chunks = []
    offset = None
    batch_size = 500

    while True:
        results = client.scroll(
            collection_name=COLLECTION_NAME,
            limit=batch_size,
            offset=offset,
            with_payload=True,
            with_vectors=False
        )
        points, next_offset = results

        for point in points:
            all_chunks.append({
                "id": point.id,
                "text": point.payload.get("text", ""),
                "source": point.payload.get("source", ""),
                "chunk_index": point.payload.get("chunk_index", 0),
                "pages": point.payload.get("pages", [1])
            })

        if next_offset is None:
            break
        offset = next_offset

    if not all_chunks:
        _bm25_index = None
        _bm25_chunks = []
        return

    # Build BM25 corpus
    tokenized_corpus = [_tokenize(c["text"]) for c in all_chunks]
    _bm25_index = BM25Okapi(tokenized_corpus)
    _bm25_chunks = all_chunks
    print(f"  BM25 index built: {len(all_chunks)} chunks indexed")


def get_bm25_results(query: str, top_k: int = 20) -> list[dict]:
    """Search using BM25 keyword matching."""
    global _bm25_index, _bm25_chunks

    if _bm25_index is None:
        _build_bm25_index()

    if _bm25_index is None or not _bm25_chunks:
        return []

    tokenized_query = _tokenize(query)
    scores = _bm25_index.get_scores(tokenized_query)

    # Get top-k indices
    scored = [(i, float(scores[i])) for i in range(len(scores))]
    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:top_k]

    results = []
    for idx, score in top:
        if score > 0:
            chunk = _bm25_chunks[idx]
            results.append({
                "text": chunk["text"],
                "source": chunk["source"],
                "chunk_index": chunk["chunk_index"],
                "pages": chunk.get("pages", [1]),
                "score": score,
                "method": "bm25"
            })

    return results


def reciprocal_rank_fusion(
    vector_results: list[dict],
    bm25_results: list[dict],
    k: int = 60
) -> list[dict]:
    """
    Reciprocal Rank Fusion (RRF) to merge results from vector search and BM25.
    RRF score = sum( 1 / (k + rank) ) across all methods where the document appears.
    """
    # Use (source, chunk_index) as unique key
    fused_scores = {}
    chunk_data = {}

    for rank, result in enumerate(vector_results):
        key = (result["source"], result["chunk_index"])
        fused_scores[key] = fused_scores.get(key, 0) + 1.0 / (k + rank + 1)
        chunk_data[key] = result
        chunk_data[key]["vector_score"] = result.get("score", 0)

    for rank, result in enumerate(bm25_results):
        key = (result["source"], result["chunk_index"])
        fused_scores[key] = fused_scores.get(key, 0) + 1.0 / (k + rank + 1)
        if key not in chunk_data:
            chunk_data[key] = result
        chunk_data[key]["bm25_score"] = result.get("score", 0)

    # Sort by fused score
    sorted_keys = sorted(fused_scores.keys(), key=lambda k: fused_scores[k], reverse=True)

    results = []
    for key in sorted_keys:
        data = chunk_data[key]
        data["rrf_score"] = round(fused_scores[key], 6)
        data["score"] = data["rrf_score"]
        data["method"] = "hybrid"
        results.append(data)

    return results


def hybrid_search(query_vector: list[float], query_text: str, top_k: int = None) -> list[dict]:
    """
    Perform hybrid search:
    1. Dense vector search via Qdrant
    2. BM25 keyword search
    3. Reciprocal Rank Fusion to merge results
    """
    if top_k is None:
        top_k = HYBRID_CANDIDATE_COUNT

    # 1. Vector search
    vector_results = vector_search(query_vector, top_k=top_k)
    for r in vector_results:
        r["method"] = "vector"

    # 2. BM25 search
    bm25_results = get_bm25_results(query_text, top_k=top_k)

    # 3. Fuse with RRF
    fused = reciprocal_rank_fusion(vector_results, bm25_results)

    return fused


def rebuild_bm25_index():
    """Force rebuild of BM25 index (call after re-indexing documents)."""
    global _bm25_index, _bm25_chunks
    _bm25_index = None
    _bm25_chunks = None
    _build_bm25_index()
