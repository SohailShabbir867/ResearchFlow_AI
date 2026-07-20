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
    Returns the top_k most relevant chunks, sorted by reranker score.
    """
    if top_k is None:
        top_k = RERANKER_TOP_K

    if not chunks:
        return []

    # If fewer chunks than top_k, return all (still reranked)
    if len(chunks) <= top_k:
        reranker = _get_reranker()
        pairs = [(query, c["text"]) for c in chunks]
        scores = list(reranker.rerank(query, [c["text"] for c in chunks]))

        for i, score_obj in enumerate(scores):
            chunks[score_obj["index"]]["rerank_score"] = round(float(score_obj["score"]), 4)

        return sorted(chunks, key=lambda x: x.get("rerank_score", 0), reverse=True)

    reranker = _get_reranker()

    # Rerank all candidates
    texts = [c["text"] for c in chunks]
    scores = list(reranker.rerank(query, texts))

    # Attach scores to chunks
    for score_obj in scores:
        idx = score_obj["index"]
        chunks[idx]["rerank_score"] = round(float(score_obj["score"]), 4)

    # Sort by rerank score and return top_k
    ranked = sorted(chunks, key=lambda x: x.get("rerank_score", 0), reverse=True)
    return ranked[:top_k]
