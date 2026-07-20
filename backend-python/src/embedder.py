"""
Local embedding using FastEmbed (ONNX runtime).
Runs entirely on CPU — no VPS, no GPU, no network required.
Supports batch embedding for fast indexing of large document sets.
"""
import os
from dotenv import load_dotenv
from fastembed import TextEmbedding

load_dotenv()

EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-ai/nomic-embed-text-v1.5")
EMBED_BATCH_SIZE = int(os.getenv("EMBED_BATCH_SIZE", "32"))  # Safe for 8GB RAM

# Lazy-load model (downloads ~140MB on first run, cached after that)
_model = None


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        print(f"Loading embedding model: {EMBED_MODEL} (first run downloads ~140MB)...")
        _model = TextEmbedding(model_name=EMBED_MODEL)
        print("Embedding model loaded.")
    return _model


def get_embedding(text: str, is_query: bool = True) -> list[float]:
    """
    Embed a single text string locally using FastEmbed ONNX.
    Uses task-specific prefixes for nomic-embed-text (search_query / search_document).
    """
    model = _get_model()
    prefix = "search_query: " if is_query else "search_document: "
    prefixed = prefix + text

    # FastEmbed returns a generator, convert to list
    embeddings = list(model.embed([prefixed]))
    return embeddings[0].tolist()


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
