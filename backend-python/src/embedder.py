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
EMBED_BATCH_SIZE = int(os.getenv("EMBED_BATCH_SIZE", "256"))

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
    50-100x faster than sequential HTTP calls to Ollama on VPS.
    """
    from tqdm import tqdm

    model = _get_model()
    texts = ["search_document: " + c["text"] for c in chunks]

    print(f"Embedding {len(chunks)} chunks locally using {EMBED_MODEL}...")
    print(f"  Batch size: {EMBED_BATCH_SIZE}")

    # FastEmbed handles batching internally via generator
    all_embeddings = list(
        tqdm(
            model.embed(texts, batch_size=EMBED_BATCH_SIZE),
            total=len(texts),
            desc="  Embedding",
            unit="chunk"
        )
    )

    for i, chunk in enumerate(chunks):
        chunk["embedding"] = all_embeddings[i].tolist()

    print(f"Embedding complete. {len(chunks)} chunks embedded locally.")
    return chunks
