"""
=============================================================
  MedResearch AI -- Add New Documents (Streaming Batch Indexer)
=============================================================
"""
import sys
import os
import time

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from src.chunker import load_all_documents
from src.vector_store import store_chunks, get_indexed_sources, get_collection_info
from src.hybrid_search import rebuild_bm25_index
from src.embedder import embed_chunks


def format_time(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.1f}s"
    minutes = int(seconds // 60)
    secs = seconds % 60
    return f"{minutes}m {secs:.0f}s"


def main():
    docs_folder = os.path.join(os.path.dirname(__file__), "../data/documents")
    t_total = time.time()

    print("=" * 60)
    print("  MedResearch AI -- Streaming Batch Indexer")
    print("=" * 60)
    print(f"  Folder: {os.path.abspath(docs_folder)}")
    print()

    # Step 1: Find already-indexed documents
    print("=== Step 1: Checking existing index ===")
    existing = set(get_indexed_sources())
    if existing:
        print(f"  Already indexed ({len(existing)} file(s)):")
        for src in sorted(existing):
            print(f"    - {src}")
    else:
        print("  No documents indexed yet.")
    print()

    # Step 2: Load all docs and filter new ones
    print("=== Step 2: Scanning for new documents ===")
    all_chunks = load_all_documents(docs_folder)
    new_chunks = [c for c in all_chunks if c["metadata"]["source"] not in existing]

    if not new_chunks:
        print("  No new documents found! Everything is already indexed.")
        return

    new_sources = sorted({c["metadata"]["source"] for c in new_chunks})
    print(f"\n  {len(new_sources)} new document(s) found with {len(new_chunks)} total chunks:")
    for src in new_sources:
        count = sum(1 for c in new_chunks if c["metadata"]["source"] == src)
        print(f"    + {src} ({count} chunks)")

    # Step 3: Stream embed & store in RAM-safe micro-batches of 100
    BATCH_SIZE = 100
    total_chunks = len(new_chunks)
    total_batches = (total_chunks + BATCH_SIZE - 1) // BATCH_SIZE

    print(f"\n=== Step 3: Streaming Embed & Store ({total_batches} batches of {BATCH_SIZE}) ===")
    
    for b_idx, start in enumerate(range(0, total_chunks, BATCH_SIZE), 1):
        batch = new_chunks[start: start + BATCH_SIZE]
        t_b = time.time()
        
        # Embed batch
        embedded_batch = embed_chunks(batch)
        
        # Immediately save batch to Qdrant
        store_chunks(embedded_batch, recreate=False)
        
        dur = time.time() - t_b
        percent = (start + len(batch)) / total_chunks * 100
        print(f"  [Batch {b_idx}/{total_batches}] {percent:.1f}% done ({start + len(batch)}/{total_chunks} chunks stored into Qdrant in {dur:.1f}s)")

    # Step 4: Rebuild BM25 keyword search index
    print(f"\n=== Step 4: Rebuilding keyword search index ===")
    rebuild_bm25_index()

    # Summary
    info = get_collection_info()
    t_all = time.time() - t_total
    print()
    print("=" * 60)
    print("  Done! New documents indexed and saved.")
    print("=" * 60)
    print(f"  Total chunks stored in Qdrant : {info.get('points_count', 'N/A')}")
    print(f"  Time taken                   : {format_time(t_all)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
