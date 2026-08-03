"""
Document indexing script — upgrades for 20GB+ scale.
Features:
- FastEmbed local embeddings (no VPS needed)
- Progress bars via tqdm
- Incremental indexing (skip already-indexed files)
- Timing stats for each step
- BM25 index rebuild after storage
"""
import sys
import os
import time

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from src.chunker import load_all_documents
from src.embedder import embed_chunks
from src.vector_store import store_chunks, get_indexed_sources, get_collection_info


def format_time(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.1f}s"
    minutes = int(seconds // 60)
    secs = seconds % 60
    return f"{minutes}m {secs:.0f}s"


def main(incremental: bool = False):
    """
    Index all documents in data/documents/.
    
    Args:
        incremental: If True, skip documents already in Qdrant.
                     If False (default), wipe and re-index everything.
    """
    docs_folder = os.path.join(os.path.dirname(__file__), "../data/documents")
    t_total = time.time()

    print("="*60)
    print("  ResearchFlow AI — Document Indexing Pipeline v1.0")
    print("  BGE-base embeddings · Semantic chunking · Cybersec tokenizer")
    print("="*60)
    print(f"  Mode: {'Incremental (skip existing)' if incremental else 'Full re-index'}")
    print(f"  Documents folder: {docs_folder}")
    print()

    # ── Step 1: Load & Chunk ─────────────────────────────────────────────────
    print("=== Step 1: Loading and Chunking Documents ===")
    t1 = time.time()

    all_chunks = load_all_documents(docs_folder)

    if not all_chunks:
        print("  No documents found. Add PDF, TXT, DOCX, or MD files to data/documents/")
        return

    # Incremental mode: filter out already-indexed sources
    if incremental:
        existing = set(get_indexed_sources())
        if existing:
            print(f"\n  Already indexed: {sorted(existing)}")
            all_chunks = [c for c in all_chunks if c["metadata"]["source"] not in existing]
            if not all_chunks:
                print("  All documents already indexed. Nothing to do.")
                print("  Use full re-index mode to update existing documents.")
                return
            print(f"  New chunks to index: {len(all_chunks)}")

    t_load = time.time() - t1
    print(f"  Loading complete in {format_time(t_load)}")

    # ── Step 2: Embed ────────────────────────────────────────────────────────
    print(f"\n=== Step 2: Embedding {len(all_chunks)} Chunks Locally ===")
    print("  Using FastEmbed ONNX (local CPU — no VPS required)")
    t2 = time.time()

    embedded = embed_chunks(all_chunks)

    t_embed = time.time() - t2
    chunks_per_sec = len(all_chunks) / t_embed if t_embed > 0 else 0
    print(f"  Embedding complete in {format_time(t_embed)} ({chunks_per_sec:.1f} chunks/sec)")

    # ── Step 3: Store ────────────────────────────────────────────────────────
    print(f"\n=== Step 3: Storing Vectors in Qdrant ===")
    t3 = time.time()

    recreate = not incremental
    store_chunks(embedded, recreate=recreate)

    t_store = time.time() - t3
    print(f"  Storage complete in {format_time(t_store)}")

    # ── Step 4: Build BM25 Index ─────────────────────────────────────────────
    print(f"\n=== Step 4: Building BM25 Keyword Index ===")
    t4 = time.time()
    from src.hybrid_search import rebuild_bm25_index
    rebuild_bm25_index()
    t_bm25 = time.time() - t4
    print(f"  BM25 index built in {format_time(t_bm25)}")

    # ── Summary ──────────────────────────────────────────────────────────────
    t_all = time.time() - t_total
    info = get_collection_info()

    print()
    print("=" * 60)
    print("  Indexing Complete!")
    print("=" * 60)
    print(f"  Total time      : {format_time(t_all)}")
    print(f"  Chunks embedded : {len(embedded)}")
    print(f"  Embed speed     : {chunks_per_sec:.1f} chunks/sec")
    print(f"  Qdrant total    : {info.get('points_count', 'N/A')} chunks")
    print(f"  Embed time      : {format_time(t_embed)}")
    print(f"  Store time      : {format_time(t_store)}")
    print()
    print("  Your cybersec documents are ready to query!")
    print("  Run: venv\\Scripts\\uvicorn src.api:app --reload --port 8000")
    print("=" * 60)


if __name__ == "__main__":
    # Support --incremental flag
    incremental = "--incremental" in sys.argv
    main(incremental=incremental)
