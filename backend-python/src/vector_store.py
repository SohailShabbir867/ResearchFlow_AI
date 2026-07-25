"""
Qdrant vector store with HNSW indexing optimized for 20GB+ corpora.
Supports batch uploads, incremental indexing, and high-recall search.
"""
import os
import uuid
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    HnswConfigDiff, OptimizersConfigDiff
)
from dotenv import load_dotenv

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "medresearch")
VECTOR_SIZE = 768  # nomic-embed-text v1.5 outputs 768-dim vectors


def get_client() -> QdrantClient:
    return QdrantClient(url=QDRANT_URL)


def create_collection(recreate: bool = False):
    """Create Qdrant collection with HNSW config optimized for 20GB+ scale."""
    client = get_client()

    if recreate:
        try:
            client.delete_collection(collection_name=COLLECTION_NAME)
            print(f"  Deleted existing collection '{COLLECTION_NAME}'")
        except Exception:
            pass

    existing = [c.name for c in client.get_collections().collections]

    if COLLECTION_NAME not in existing:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=VECTOR_SIZE,
                distance=Distance.COSINE
            ),
            hnsw_config=HnswConfigDiff(
                m=16,               # Graph connectivity (higher = better recall, more RAM)
                ef_construct=200,   # Build-time quality (higher = slower build, better index)
            ),
            optimizers_config=OptimizersConfigDiff(
                indexing_threshold=50000,  # Start HNSW indexing after 50k points
            )
        )
        print(f"  Collection '{COLLECTION_NAME}' created with HNSW optimization.")
    else:
        print(f"  Collection '{COLLECTION_NAME}' already exists.")


def get_collection_info() -> dict:
    """Get collection statistics."""
    client = get_client()
    try:
        info = client.get_collection(COLLECTION_NAME)
        return {
            "name": COLLECTION_NAME,
            "points_count": info.points_count,
            "vectors_count": info.vectors_count,
            "status": str(info.status),
        }
    except Exception:
        return {"name": COLLECTION_NAME, "points_count": 0, "status": "not_found"}


def get_indexed_sources() -> list[str]:
    """Get list of unique source document names in the collection."""
    client = get_client()
    try:
        # Scroll through and collect unique sources
        sources = set()
        offset = None
        while True:
            results = client.scroll(
                collection_name=COLLECTION_NAME,
                limit=500,
                offset=offset,
                with_payload=["source"],
                with_vectors=False
            )
            points, next_offset = results
            for p in points:
                sources.add(p.payload.get("source", "unknown"))
            if next_offset is None:
                break
            offset = next_offset
        return sorted(sources)
    except Exception:
        return []


def store_chunks(embedded_chunks: list[dict], recreate: bool = True):
    """Store all embedded chunks into Qdrant in batches."""
    from tqdm import tqdm

    client = get_client()
    create_collection(recreate=recreate)

    points = []
    for chunk in embedded_chunks:
        points.append(
            PointStruct(
                id=uuid.uuid4(),
                vector=chunk["embedding"],
                payload={
                    "text": chunk["text"],
                    "source": chunk["metadata"]["source"],
                    "chunk_index": chunk["metadata"]["chunk_index"],
                    "pages": chunk["metadata"].get("pages", [1])
                }
            )
        )

    # Upload in batches of 500
    batch_size = 500
    for i in tqdm(range(0, len(points), batch_size), desc="  Storing", unit="batch"):
        batch = points[i: i + batch_size]
        client.upsert(collection_name=COLLECTION_NAME, points=batch)

    print(f"  Total {len(points)} chunks stored in Qdrant.")


def search(query_vector: list[float], top_k: int = 20) -> list[dict]:
    """Dense vector search via Qdrant."""
    client = get_client()

    results = client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        limit=top_k
    )

    matches = []
    for r in results.points:
        matches.append({
            "text": r.payload["text"],
            "source": r.payload["source"],
            "chunk_index": r.payload["chunk_index"],
            "pages": r.payload.get("pages", [1]),
            "score": round(r.score, 4)
        })

    return matches


def delete_document_by_source(source_name: str) -> bool:
    """Delete all chunks matching a document source from Qdrant."""
    from qdrant_client.models import Filter, FieldCondition, MatchValue, FilterSelector
    client = get_client()
    try:
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=FilterSelector(
                filter=Filter(
                    must=[
                        FieldCondition(
                            key="source",
                            match=MatchValue(value=source_name)
                        )
                    ]
                )
            )
        )
        print(f"  Deleted all points for document '{source_name}' from Qdrant.")
        return True
    except Exception as e:
        print(f"  Error deleting points for '{source_name}': {e}")
        return False
