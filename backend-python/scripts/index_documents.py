"""
=============================================================
  MedResearch AI -- Full Re-index / Incremental Pipeline v2.0
=============================================================
"""
import sys
import os
import time

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from src.chunker import load_all_documents
from src.embedder import embed_chunks
from src.vector_store import store_chunks, get_indexed_sources, get_collection_info
from src.hybrid_search import rebuild_bm25_index


def format_time(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.1f}s"
    minutes = int(seconds // 60)
    secs = seconds % 60
    return f"{minutes}m {secs:.0f}s"


def main(incremental: bool = False):
    docs_folder = os.path.join(os.path.dirname(__file__), "../data/documents")
    t_total = time.time()

    print("=" * 60)
    print("  MedResearch AI -- Document Indexing Pipeline v2.0")
    print("=" * 60)
    print(f"  Mode: {'Incremental (skip existing)' if incremental else 'Full re-index'}")
    print(f"  Documents folder: {docs_folder}")
    print()

    # Step 1: Load & Chunk
    print("=== Step 1: Loading and Chunking Documents ===")
    t1 = time.time()
    all_chunks = load_all_documents(docs_folder)

    if not all_chunks:
        print("  No documents found.")
        return

    if incremental:
        existing = set(get_indexed_sources())
        if existing:
            all_chunks = [c for c in all_chunks if c["metadata"]["source"] not in existing]
            if not all_chunks:
                print("  All documents already indexed.")
                return

    t_load = time.time() - t1
    print(f"  Loaded {len(all_chunks)} chunks in {format_time(t_load)}")

    # Step 2: Stream Embed & Store into Qdrant in batches of 100
    BATCH_SIZE = 100
    total_chunks = len(all_chunks)
    total_batches = (total_chunks + BATCH_SIZE - 1) // BATCH_SIZE

    print(f"\n=== Step 2: Streaming Embed & Store ({total_batches} batches of {BATCH_SIZE}) ===")

    for b_idx, start in enumerate(range(0, total_chunks, BATCH_SIZE), 1):
        batch = all_chunks[start: start + BATCH_SIZE]
        t_b = time.time()

        embedded_batch = embed_chunks(batch)
        recreate_flag = (b_idx == 1 and not incremental)
        store_chunks(embedded_batch, recreate=recreate_flag)

        dur = time.time() - t_b
        percent = (start + len(batch)) / total_chunks * 100
        print(f"  [Batch {b_idx}/{total_batches}] {percent:.1f}% done ({start + len(batch)}/{total_chunks} chunks stored into Qdrant in {dur:.1f}s)")

    # Step 3: Rebuild BM25 Keyword Search Index
    print(f"\n=== Step 3: Building BM25 Keyword Index ===")
    t4 = time.time()
    rebuild_bm25_index()
    print(f"  BM25 index built in {format_time(time.time() - t4)}")

    # Summary
    info = get_collection_info()
    print()
    print("=" * 60)
    print("  Indexing Complete!")
    print("=" * 60)
    print(f"  Total time      : {format_time(time.time() - t_total)}")
    print(f"  Qdrant total    : {info.get('points_count', 'N/A')} chunks")
    print("=" * 60)


if __name__ == "__main__":
    incremental = "--incremental" in sys.argv
    main(incremental=incremental)
