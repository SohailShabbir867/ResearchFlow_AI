import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from src.chunker import load_all_documents
from src.embedder import embed_chunks
from src.vector_store import store_chunks


def main():
    docs_folder = os.path.join(os.path.dirname(__file__), "../data/documents")

    print("=== Step 1: Loading and chunking documents ===")
    chunks = load_all_documents(docs_folder)

    if not chunks:
        print("No documents found. Add PDF or .txt files to data/documents/")
        return

    print("\n=== Step 2: Embedding chunks with Ollama ===")
    embedded = embed_chunks(chunks)

    print("\n=== Step 3: Storing vectors in Qdrant ===")
    store_chunks(embedded)

    print("\nIndexing complete! Your documents are ready to query.")


if __name__ == "__main__":
    main()
