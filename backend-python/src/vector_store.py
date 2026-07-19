import os
import uuid
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from dotenv import load_dotenv

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "medresearch")
VECTOR_SIZE = 768  # nomic-embed-text outputs 768-dim vectors


def get_client() -> QdrantClient:
    return QdrantClient(url=QDRANT_URL)


def create_collection():
    """Create the Qdrant collection if it does not exist."""
    client = get_client()
    existing = [c.name for c in client.get_collections().collections]

    if COLLECTION_NAME not in existing:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=VECTOR_SIZE,
                distance=Distance.COSINE
            )
        )
        print(f"Collection '{COLLECTION_NAME}' created.")
    else:
        print(f"Collection '{COLLECTION_NAME}' already exists.")


def store_chunks(embedded_chunks: list[dict]):
    """Store all embedded chunks into Qdrant."""
    client = get_client()
    create_collection()

    points = []
    for chunk in embedded_chunks:
        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector=chunk["embedding"],
                payload={
                    "text": chunk["text"],
                    "source": chunk["metadata"]["source"],
                    "chunk_index": chunk["metadata"]["chunk_index"]
                }
            )
        )

    # Upload in batches of 100
    batch_size = 100
    for i in range(0, len(points), batch_size):
        batch = points[i: i + batch_size]
        client.upsert(collection_name=COLLECTION_NAME, points=batch)
        print(f"  Stored batch {i // batch_size + 1}")

    print(f"Total {len(points)} chunks stored in Qdrant.")


def search(query_vector: list[float], top_k: int = 5) -> list[dict]:
    """Search Qdrant for the most similar chunks to the query vector."""
    client = get_client()

    results = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=top_k
    )

    matches = []
    for r in results:
        matches.append({
            "text": r.payload["text"],
            "source": r.payload["source"],
            "chunk_index": r.payload["chunk_index"],
            "score": round(r.score, 4)
        })

    return matches
