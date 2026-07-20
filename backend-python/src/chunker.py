"""
Document chunking with paragraph-aware splitting and page tracking.
Supports PDF, TXT, and DOCX formats.
Designed for 20GB+ document corpora with efficient memory usage.
"""
from pathlib import Path
from pypdf import PdfReader

CHUNK_SIZE = 1200       # ~300 tokens per chunk
CHUNK_OVERLAP = 200     # overlap to preserve context across boundaries


def split_text_paragraphs(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    """
    Paragraph-aware chunking:
    1. Split on double newlines (paragraph boundaries)
    2. Merge small paragraphs together up to chunk_size
    3. Apply overlap between chunks to preserve cross-boundary context
    """
    # Split into paragraphs
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks = []
    current_chunk = []
    current_length = 0

    for para in paragraphs:
        para_len = len(para)

        # If a single paragraph exceeds chunk_size, split it by words
        if para_len > chunk_size:
            # Flush current chunk first
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = []
                current_length = 0

            # Split oversized paragraph by words
            words = para.split()
            word_chunk = []
            word_len = 0
            for word in words:
                word_chunk.append(word)
                word_len += len(word) + 1
                if word_len >= chunk_size:
                    chunks.append(" ".join(word_chunk))
                    # Keep overlap
                    overlap_words = []
                    overlap_len = 0
                    for w in reversed(word_chunk):
                        overlap_words.insert(0, w)
                        overlap_len += len(w) + 1
                        if overlap_len >= chunk_overlap:
                            break
                    word_chunk = overlap_words
                    word_len = overlap_len
            if word_chunk:
                chunks.append(" ".join(word_chunk))
            continue

        # If adding this paragraph exceeds chunk_size, flush
        if current_length + para_len + 2 > chunk_size and current_chunk:
            chunks.append("\n\n".join(current_chunk))

            # Keep last paragraph(s) as overlap
            overlap_text = current_chunk[-1] if current_chunk else ""
            if len(overlap_text) < chunk_overlap and len(current_chunk) >= 2:
                overlap_text = "\n\n".join(current_chunk[-2:])

            current_chunk = [overlap_text] if overlap_text else []
            current_length = len(overlap_text)

        current_chunk.append(para)
        current_length += para_len + 2  # +2 for \n\n

    # Flush remaining
    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return [c.strip() for c in chunks if c.strip()]


def load_pdf(file_path: str) -> list[dict]:
    """Load PDF with per-page text extraction and page number tracking."""
    reader = PdfReader(file_path)
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            pages.append({"text": text, "page": i + 1})
    return pages


def load_txt(file_path: str) -> list[dict]:
    """Load plain text file."""
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        text = f.read()
    return [{"text": text, "page": 1}] if text.strip() else []


def load_docx(file_path: str) -> list[dict]:
    """Load DOCX file with paragraph extraction."""
    try:
        from docx import Document
        doc = Document(file_path)
        text = "\n\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        return [{"text": text, "page": 1}] if text.strip() else []
    except ImportError:
        print(f"  Warning: python-docx not installed, skipping {file_path}")
        return []


def load_document(file_path: str) -> list[dict]:
    """Load document and return list of {text, page} dicts."""
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        return load_pdf(file_path)
    elif ext == ".txt":
        return load_txt(file_path)
    elif ext == ".docx":
        return load_docx(file_path)
    else:
        print(f"  Skipping unsupported file: {file_path}")
        return []


def chunk_document(pages: list[dict], source_name: str) -> list[dict]:
    """
    Chunk a document's pages into embedding-ready chunks.
    Each chunk carries metadata: source, chunk_index, page numbers.
    """
    # Combine all page texts (track which pages contribute to each section)
    full_text = "\n\n".join([p["text"] for p in pages])
    raw_chunks = split_text_paragraphs(full_text, CHUNK_SIZE, CHUNK_OVERLAP)

    result = []
    for i, chunk_text in enumerate(raw_chunks):
        # Determine which pages this chunk spans
        chunk_pages = []
        for p in pages:
            if any(line in p["text"] for line in chunk_text.split("\n")[:3]):
                chunk_pages.append(p["page"])

        result.append({
            "text": chunk_text,
            "metadata": {
                "source": source_name,
                "chunk_index": i,
                "total_chunks": len(raw_chunks),
                "pages": chunk_pages[:3] if chunk_pages else [1]
            }
        })
    return result


def load_all_documents(docs_folder: str) -> list[dict]:
    """Load and chunk all supported documents from the folder."""
    all_chunks = []
    docs_path = Path(docs_folder)
    supported = {".pdf", ".txt", ".docx"}

    files = [f for f in docs_path.iterdir() if f.suffix.lower() in supported]
    print(f"Found {len(files)} document(s) in {docs_folder}")

    for file_path in sorted(files):
        print(f"Loading: {file_path.name}")
        pages = load_document(str(file_path))
        if pages:
            chunks = chunk_document(pages, source_name=file_path.name)
            all_chunks.extend(chunks)
            print(f"  -> {len(chunks)} chunks created ({sum(len(p['text']) for p in pages)} chars)")
        else:
            print(f"  -> No text extracted (scanned PDF or empty file)")

    print(f"\nTotal chunks ready: {len(all_chunks)}")
    return all_chunks
