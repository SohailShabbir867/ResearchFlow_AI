"""
ResearchFlow AI — Qdrant Vector Store
HNSW-indexed vector database for research document corpora.

v4.1 — Bug Fixes:
  - Singleton QdrantClient (Bug 9): replaced per-call client construction with
    a module-level instance. Eliminates per-request TCP handshakes and connection
    storms under concurrent load.
  - Collection renamed to 'researchflow'
  - Payload indexing on content_type, source fields
  - HNSW tuned for 768-dim BGE-base vectors
"""
import os
import uuid
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    HnswConfigDiff, OptimizersConfigDiff,
    PayloadSchemaType
)
try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs):
        return False

load_dotenv()

QDRANT_URL      = os.getenv("QDRANT_URL",      "http://localhost:6333")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "researchflow")
EMBED_DIM       = int(os.getenv("EMBED_DIM",   "768"))
VECTOR_SIZE     = EMBED_DIM  # Default BAAI/bge-base-en-v1.5: 768-dim

# ─── Singleton Qdrant client (Bug 9 Fix) ─────────────────────────────────────
# One persistent connection shared across all requests — no TCP overhead per call.
_qdrant_client: QdrantClient = None


def get_client() -> QdrantClient:
    """Return the module-level singleton QdrantClient, creating it if needed.
    Returns None silently if Qdrant is not running (RAG will fall back to web-only).
    """
    global _qdrant_client
    if _qdrant_client is None:
        try:
            _qdrant_client = QdrantClient(
                url=QDRANT_URL,
                check_compatibility=False,  # suppress version mismatch warning
            )
            print(f"  [Qdrant] Singleton client initialized → {QDRANT_URL}")
        except Exception as e:
            print(f"  [Qdrant] WARNING: Cannot connect to {QDRANT_URL} — RAG disabled, web-only mode active. ({e})")
            return None
    return _qdrant_client


def create_collection(recreate: bool = False):
    """Create Qdrant collection with HNSW config optimized for research corpus."""
    client = get_client()
    if client is None: return

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
                size=EMBED_DIM,
                distance=Distance.COSINE
            ),
            hnsw_config=HnswConfigDiff(
                m=16,               # Graph connectivity (16 = good recall/RAM balance)
                ef_construct=300,   # Higher quality index build (better recall)
            ),
            optimizers_config=OptimizersConfigDiff(
                indexing_threshold=10000,   # Start HNSW after 10k points
            )
        )
        print(f"  Collection '{COLLECTION_NAME}' created ({EMBED_DIM}-dim, COSINE, HNSW ef=300).")

        # Create payload indexes for filtered search
        try:
            client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name="content_type",
                field_schema=PayloadSchemaType.KEYWORD,
            )
            client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name="source",
                field_schema=PayloadSchemaType.KEYWORD,
            )
            print("  Payload indexes created (content_type, source).")
        except Exception as e:
            print(f"  Warning: payload index creation failed ({e})")
    else:
        # Startup check: verify existing collection's vector dimension matches EMBED_DIM
        try:
            info = client.get_collection(COLLECTION_NAME)
            existing_size = None
            if hasattr(info, "config") and hasattr(info.config, "params"):
                params = info.config.params
                if hasattr(params, "vectors"):
                    vectors_cfg = params.vectors
                    if hasattr(vectors_cfg, "size"):
                        existing_size = vectors_cfg.size
                    elif isinstance(vectors_cfg, dict) and "size" in vectors_cfg:
                        existing_size = vectors_cfg["size"]

            if existing_size and existing_size != EMBED_DIM:
                raise ValueError(
                    f"Vector dimension mismatch for Qdrant collection '{COLLECTION_NAME}': "
                    f"existing collection uses {existing_size}-dim vectors, but EMBED_DIM is configured as {EMBED_DIM}. "
                    f"Please set EMBED_DIM={existing_size} in environment or recreate the collection."
                )
            print(f"  Collection '{COLLECTION_NAME}' already exists (verified {existing_size or EMBED_DIM}-dim).")
        except ValueError:
            raise
        except Exception as e:
            print(f"  Collection '{COLLECTION_NAME}' already exists (dimension check skipped: {e}).")


def get_collection_info() -> dict:
    """Get collection statistics."""
    client = get_client()
    try:
        info = client.get_collection(COLLECTION_NAME)
        return {
            "name":          COLLECTION_NAME,
            "points_count":  info.points_count,
            "vectors_count": info.vectors_count,
            "status":        str(info.status),
        }
    except Exception:
        return {"name": COLLECTION_NAME, "points_count": 0, "status": "not_found"}


def get_indexed_sources() -> list[str]:
    """Get list of unique source document names in the collection."""
    client = get_client()
    try:
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
    """Store all embedded chunks into Qdrant in batches with rich metadata."""
    from tqdm import tqdm

    client = get_client()
    create_collection(recreate=recreate)

    points = []
    for chunk in embedded_chunks:
        meta = chunk.get("metadata", {})
        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector=chunk["embedding"],
                payload={
                    "text":         chunk["text"],
                    "source":       meta.get("source",       "unknown"),
                    "chunk_index":  meta.get("chunk_index",  0),
                    "pages":        meta.get("pages",        [1]),
                    "content_type": meta.get("content_type", "general"),
                    "cves":         meta.get("cves",         []),
                    "section":      meta.get("section",      ""),
                    "content_hash": meta.get("content_hash", ""),
                }
            )
        )

    batch_size = 500
    for i in tqdm(range(0, len(points), batch_size), desc="  Storing", unit="batch"):
        batch = points[i: i + batch_size]
        client.upsert(collection_name=COLLECTION_NAME, points=batch)

    print(f"  Stored {len(points)} chunks in Qdrant collection '{COLLECTION_NAME}'.")


def search(query_vector: list[float], top_k: int = 30) -> list[dict]:
    """Dense vector search via Qdrant with tuned HNSW ef_runtime."""
    client = get_client()

    results = client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        limit=top_k,
        search_params={"hnsw_ef": 128}  # v6.0: up from default 64 → better recall
    )

    matches = []
    for r in results.points:
        matches.append({
            "text":         r.payload["text"],
            "source":       r.payload["source"],
            "chunk_index":  r.payload["chunk_index"],
            "pages":        r.payload.get("pages",        [1]),
            "content_type": r.payload.get("content_type", "general"),
            "cves":         r.payload.get("cves",         []),
            "section":      r.payload.get("section",      ""),
            "score":        round(r.score, 4)
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
        print(f"  Deleted all points for '{source_name}' from '{COLLECTION_NAME}'.")
        return True
    except Exception as e:
        print(f"  Error deleting points for '{source_name}': {e}")
        return False
