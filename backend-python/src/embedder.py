import ollama
import os
from dotenv import load_dotenv

load_dotenv()

EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")


def get_embedding(text: str) -> list[float]:
    """Convert a single text string into a vector using Ollama."""
    response = ollama.embeddings(
        model=EMBED_MODEL,
        prompt=text
    )
    return response["embedding"]


def embed_chunks(chunks: list[dict]) -> list[dict]:
    """
    Takes chunks from chunker.py and adds an 'embedding' field to each.
    Returns the same list with vectors attached.
    """
    print(f"Embedding {len(chunks)} chunks using {EMBED_MODEL}...")

    for i, chunk in enumerate(chunks):
        chunk["embedding"] = get_embedding(chunk["text"])

        if (i + 1) % 10 == 0:
            print(f"  Embedded {i + 1}/{len(chunks)}")

    print("Embedding complete.")
    return chunks
