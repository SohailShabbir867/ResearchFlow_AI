"""
=============================================================
  MedResearch AI -- Add New Documents (Incremental Indexer)
=============================================================

USAGE:
    1. Drop your PDF/TXT/DOCX files into:
       backend-python/data/documents/

    2. Run this script:
       venv\\Scripts\\python scripts/add_documents.py

    New files are detected and added WITHOUT touching existing data.

FULL RE-INDEX (wipe everything and start fresh):
    venv\Scripts\python scripts/index_documents.py
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
    print("  MedResearch AI -- Add New Documents")
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
        print("  No documents indexed yet (empty index).")
    print()

    # Step 2: Load all docs and filter new ones
    print("=== Step 2: Scanning for new documents ===")
    all_chunks = load_all_documents(docs_folder)
    new_chunks = [c for c in all_chunks if c["metadata"]["source"] not in existing]

    if not new_chunks:
        print()
        print("  No new documents found! Everything is already indexed.")
        print(f"  Tip: Drop new PDF/TXT/DOCX files into:")
        print(f"       {os.path.abspath(docs_folder)}")
        print("  Then run this script again.")
        return

    new_sources = sorted({c["metadata"]["source"] for c in new_chunks})
    print(f"\n  {len(new_sources)} new document(s) found:")
    for src in new_sources:
        count = sum(1 for c in new_chunks if c["metadata"]["source"] == src)
        print(f"    + {src}  ({count} chunks)")

    # Step 3: Embed new chunks
    print(f"\n=== Step 3: Embedding {len(new_chunks)} new chunks ===")
    t2 = time.time()
    embedded = embed_chunks(new_chunks)
    t_embed = time.time() - t2
    print(f"  Embedding complete in {format_time(t_embed)}")

    # Step 4: Add to Qdrant (incremental -- do NOT recreate)
    print(f"\n=== Step 4: Storing in vector database ===")
    t3 = time.time()
    store_chunks(embedded, recreate=False)
    t_store = time.time() - t3
    print(f"  Storage complete in {format_time(t_store)}")

    # Step 5: Rebuild BM25 index
    print(f"\n=== Step 5: Rebuilding keyword search index ===")
    rebuild_bm25_index()

    # Summary
    info = get_collection_info()
    t_all = time.time() - t_total
    print()
    print("=" * 60)
    print("  Done! New documents added successfully.")
    print("=" * 60)
    print(f"  New docs added    : {len(new_sources)}")
    print(f"  New chunks added  : {len(new_chunks)}")
    print(f"  Total in database : {info.get('points_count', 'N/A')} chunks")
    print(f"  Time taken        : {format_time(t_all)}")
    print()
    for src in new_sources:
        print(f"  + {src}")
    print()
    print("  You can now ask questions about the new documents!")
    print("=" * 60)


if __name__ == "__main__":
    main()
