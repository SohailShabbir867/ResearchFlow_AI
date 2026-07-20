"""
Cross-encoder reranker using FastEmbed ONNX.
Re-scores candidate chunks against the query for precision filtering.
Runs on CPU with minimal RAM (~80MB model).
"""
import os
from dotenv import load_dotenv

load_dotenv()

RERANKER_MODEL = os.getenv("RERANKER_MODEL", "Xenova/ms-marco-MiniLM-L-6-v2")
RERANKER_TOP_K = int(os.getenv("RERANKER_TOP_K", "5"))

# Lazy-load reranker
_reranker = None


def _get_reranker():
    global _reranker
    if _reranker is None:
        from fastembed.rerank.cross_encoder import TextCrossEncoder
        print(f"Loading reranker model: {RERANKER_MODEL}...")
        _reranker = TextCrossEncoder(model_name=RERANKER_MODEL)
        print("Reranker model loaded.")
    return _reranker


def rerank(query: str, chunks: list[dict], top_k: int = None) -> list[dict]:
    """
    Re-score and re-rank chunks against the query using a cross-encoder.
    fastembed reranker.rerank() returns a flat list of floats in the same
    order as the input texts (one score per chunk, no index/score dict).
    Returns the top_k most relevant chunks, sorted by reranker score.
    """
    if top_k is None:
        top_k = RERANKER_TOP_K

    if not chunks:
        return []

    reranker = _get_reranker()
    texts = [c["text"] for c in chunks]

    # fastembed returns list of floats, one per input text, in original order
    scores = list(reranker.rerank(query, texts))

    # Attach scores to each chunk by position
    for i, score in enumerate(scores):
        chunks[i]["rerank_score"] = round(float(score), 4)

    # Sort by rerank score descending and return top_k
    ranked = sorted(chunks, key=lambda x: x.get("rerank_score", 0), reverse=True)
    return ranked[:top_k]
