import os
import requests
from dotenv import load_dotenv

load_dotenv()

# Point to your VPS Ollama instance — set OLLAMA_URL in .env
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")


def get_embedding(text: str) -> list[float]:
    """Convert a single text string into a vector using Ollama on VPS."""
    url = f"{OLLAMA_URL}/api/embeddings"
    payload = {
        "model": EMBED_MODEL,
        "prompt": text
    }
    response = requests.post(url, json=payload, timeout=120)
    response.raise_for_status()
    data = response.json()
    return data["embedding"]


def embed_chunks(chunks: list[dict]) -> list[dict]:
    """
    Takes chunks from chunker.py and adds an 'embedding' field to each.
    Returns the same list with vectors attached.
    """
    print(f"Embedding {len(chunks)} chunks using {EMBED_MODEL} @ {OLLAMA_URL}...")

    for i, chunk in enumerate(chunks):
        chunk["embedding"] = get_embedding(chunk["text"])

        if (i + 1) % 10 == 0:
            print(f"  Embedded {i + 1}/{len(chunks)}")

    print("Embedding complete.")
    return chunks
