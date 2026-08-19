import os
import sys

# Ensure imports work from backend-python
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, HnswConfigDiff, OptimizersConfigDiff, PayloadSchemaType
from src.vector_store import get_client

def migrate():
    print("Starting migration...")
    client = get_client()
    if client is None:
        print("Qdrant is not running. Start it and retry.")
        return
    
    # 1. Create new researchflow collection
    new_col = "researchflow"
    old_col = "cybersec"
    
    existing = [c.name for c in client.get_collections().collections]
    if new_col not in existing:
        print(f"Creating collection {new_col}...")
        client.create_collection(
            collection_name=new_col,
            vectors_config=VectorParams(size=768, distance=Distance.COSINE),
            hnsw_config=HnswConfigDiff(m=16, ef_construct=300),
            optimizers_config=OptimizersConfigDiff(indexing_threshold=10000)
        )
        client.create_payload_index(new_col, "content_type", PayloadSchemaType.KEYWORD)
        client.create_payload_index(new_col, "source", PayloadSchemaType.KEYWORD)
    else:
        print(f"Collection {new_col} already exists, skipping creation.")

    # 2. Copy points from cybersec to researchflow
    print(f"Copying points from {old_col} to {new_col}...")
    offset = None
    total_copied = 0
    while True:
        results = client.scroll(
            collection_name=old_col,
            limit=500,
            offset=offset,
            with_payload=True,
            with_vectors=True
        )
        points, next_offset = results
        if points:
            from qdrant_client.models import PointStruct
            converted_points = [
                PointStruct(id=p.id, vector=p.vector, payload=p.payload)
                for p in points
            ]
            client.upsert(collection_name=new_col, points=converted_points)
            total_copied += len(points)
            print(f"  Copied {total_copied} points...")
            
        if next_offset is None:
            break
        offset = next_offset
        
    print(f"Migration complete! {total_copied} points copied.")
    
    # 3. Rebuild BM25
    print("Rebuilding BM25 Index for new collection...")
    from src.hybrid_search import rebuild_bm25_index
    # Temporarily force COLLECTION_NAME to new_col in case env is weird
    os.environ["COLLECTION_NAME"] = new_col
    rebuild_bm25_index()
    print("BM25 Rebuild complete!")

if __name__ == "__main__":
    migrate()
