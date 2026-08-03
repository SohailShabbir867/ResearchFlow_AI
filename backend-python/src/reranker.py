"""
ResearchFlow AI — Cross-Encoder Reranker
Re-scores candidate chunks against the query for precision filtering.
Uses ms-marco-MiniLM-L-6-v2 via FastEmbed ONNX (CPU, ~80MB).

v4.0 — Cybersec upgrades:
  - top_k increased to 8 (more context for complex attack sequences)
  - Wider reranker window gives LLM broader coverage of techniques
"""
import os
from dotenv import load_dotenv

load_dotenv()

RERANKER_MODEL = os.getenv("RERANKER_MODEL", "Xenova/ms-marco-MiniLM-L-12-v2")  # v6.0: 12-layer model (better precision)
RERANKER_TOP_K = int(os.getenv("RERANKER_TOP_K", "8"))

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

    The cross-encoder jointly encodes (query, passage) pairs — far more
    accurate than bi-encoder cosine similarity alone. This is the main
    precision layer that filters out irrelevant chunks before the LLM sees them.

    Returns the top_k most relevant chunks sorted by reranker score.
    """
    if top_k is None:
        top_k = RERANKER_TOP_K

    if not chunks:
        return []

    reranker = _get_reranker()
    texts    = [c["text"] for c in chunks]

    # fastembed returns list of floats, one per input text
    scores = list(reranker.rerank(query, texts))

    for i, score in enumerate(scores):
        chunks[i]["rerank_score"] = round(float(score), 4)

    ranked = sorted(chunks, key=lambda x: x.get("rerank_score", 0), reverse=True)
    return ranked[:top_k]
