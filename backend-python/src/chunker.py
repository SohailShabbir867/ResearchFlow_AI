from pathlib import Path
from pypdf import PdfReader

CHUNK_SIZE = 1200
CHUNK_OVERLAP = 200


def split_text(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    chunks = []
    words = text.split()
    current_chunk = []
    current_length = 0

    for word in words:
        current_chunk.append(word)
        current_length += len(word) + 1  # +1 for space

        if current_length >= chunk_size:
            chunks.append(" ".join(current_chunk))
            # Keep overlap words
            overlap_words = []
            overlap_len = 0
            for w in reversed(current_chunk):
                overlap_words.insert(0, w)
                overlap_len += len(w) + 1
                if overlap_len >= chunk_overlap:
                    break
            current_chunk = overlap_words
            current_length = overlap_len

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


def load_pdf(file_path: str) -> str:
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text


def load_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def load_document(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        return load_pdf(file_path)
    elif ext == ".txt":
        return load_txt(file_path)
    else:
        print(f"Skipping unsupported file: {file_path}")
        return ""


def chunk_text(text: str, source_name: str) -> list[dict]:
    chunks = split_text(text, chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)

    result = []
    for i, chunk in enumerate(chunks):
        result.append({
            "text": chunk,
            "metadata": {
                "source": source_name,
                "chunk_index": i,
                "total_chunks": len(chunks)
            }
        })
    return result


def load_all_documents(docs_folder: str) -> list[dict]:
    all_chunks = []
    docs_path = Path(docs_folder)

    for file_path in docs_path.iterdir():
        if file_path.suffix.lower() in [".pdf", ".txt"]:
            print(f"Loading: {file_path.name}")
            text = load_document(str(file_path))
            if text.strip():
                chunks = chunk_text(text, source_name=file_path.name)
                all_chunks.extend(chunks)
                print(f"  -> {len(chunks)} chunks created")

    print(f"\nTotal chunks ready: {len(all_chunks)}")
    return all_chunks
