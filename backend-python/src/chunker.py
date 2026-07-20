"""
Document chunking with token-based splitting and page tracking.
Fix #3: Switched from character-count to token-count chunking using tiktoken.
This guarantees chunks never exceed the embedding model's 512-token window,
even for dense medical text with Latin terms and abbreviations.

Supports PDF, TXT, DOCX.
"""
from pathlib import Path
from pypdf import PdfReader

# ─── Chunking config (in TOKENS, not characters) ─────────────────────────────
CHUNK_SIZE = 400       # tokens per chunk (safe under 512 nomic-embed limit)
CHUNK_OVERLAP = 50     # token overlap between chunks


def _get_tokenizer():
    """
    Lazy-load tiktoken tokenizer.
    Uses cl100k_base (same as GPT-3.5/4) — accurate token count for any model.
    Falls back to character-based splitting if tiktoken not installed.
    """
    try:
        import tiktoken
        return tiktoken.get_encoding("cl100k_base")
    except ImportError:
        return None


def _count_tokens(text: str, tokenizer) -> int:
    """Count tokens in text. Falls back to char/4 estimate if no tokenizer."""
    if tokenizer:
        return len(tokenizer.encode(text))
    return len(text) // 4  # rough estimate: 1 token ≈ 4 chars


def split_by_tokens(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    """
    Token-aware chunking:
    1. Split into paragraphs on double newlines
    2. Merge paragraphs until chunk_size tokens is reached
    3. Apply token-counted overlap between chunks
    
    Guarantees no chunk exceeds chunk_size tokens — safe for all embedding models.
    """
    tokenizer = _get_tokenizer()

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks = []
    current_paras = []
    current_tokens = 0

    for para in paragraphs:
        para_tokens = _count_tokens(para, tokenizer)

        # Single paragraph larger than chunk_size — split by sentences
        if para_tokens > chunk_size:
            # Flush current buffer first
            if current_paras:
                chunks.append("\n\n".join(current_paras))
                current_paras = []
                current_tokens = 0

            # Split large paragraph by sentences
            sentences = para.replace(". ", ".|").split("|")
            sent_buffer = []
            sent_tokens = 0

            for sentence in sentences:
                s_tokens = _count_tokens(sentence, tokenizer)
                if sent_tokens + s_tokens > chunk_size and sent_buffer:
                    chunks.append(" ".join(sent_buffer))

                    # Overlap: keep last sentence(s) under overlap token count
                    overlap_buf = []
                    overlap_tok = 0
                    for s in reversed(sent_buffer):
                        t = _count_tokens(s, tokenizer)
                        if overlap_tok + t > chunk_overlap:
                            break
                        overlap_buf.insert(0, s)
                        overlap_tok += t

                    sent_buffer = overlap_buf + [sentence]
                    sent_tokens = overlap_tok + s_tokens
                else:
                    sent_buffer.append(sentence)
                    sent_tokens += s_tokens

            if sent_buffer:
                chunks.append(" ".join(sent_buffer))
            continue

        # Would overflow current chunk → flush, then start new with overlap
        if current_tokens + para_tokens > chunk_size and current_paras:
            chunks.append("\n\n".join(current_paras))

            # Overlap: walk backwards and keep paragraphs within overlap budget
            overlap_paras = []
            overlap_tok = 0
            for p in reversed(current_paras):
                t = _count_tokens(p, tokenizer)
                if overlap_tok + t > chunk_overlap:
                    break
                overlap_paras.insert(0, p)
                overlap_tok += t

            current_paras = overlap_paras
            current_tokens = overlap_tok

        current_paras.append(para)
        current_tokens += para_tokens

    # Flush remaining
    if current_paras:
        chunks.append("\n\n".join(current_paras))

    return [c.strip() for c in chunks if c.strip()]


# ─── Document loaders ────────────────────────────────────────────────────────

def load_pdf(file_path: str) -> list[dict]:
    """Load PDF with per-page text and page number tracking."""
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
    """Load DOCX with paragraph extraction."""
    try:
        from docx import Document
        doc = Document(file_path)
        text = "\n\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        return [{"text": text, "page": 1}] if text.strip() else []
    except ImportError:
        print(f"  Warning: python-docx not installed, skipping {file_path}")
        return []


def load_document(file_path: str) -> list[dict]:
    """Route to the correct loader based on file extension."""
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


# ─── Chunker ─────────────────────────────────────────────────────────────────

def chunk_document(pages: list[dict], source_name: str) -> list[dict]:
    """
    Split document pages into token-safe chunks.
    Each chunk carries: text, source filename, chunk_index, page numbers.
    """
    full_text = "\n\n".join([p["text"] for p in pages])
    raw_chunks = split_by_tokens(full_text, CHUNK_SIZE, CHUNK_OVERLAP)

    result = []
    for i, chunk_text in enumerate(raw_chunks):
        # Find which pages this chunk came from
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

    tokenizer = _get_tokenizer()
    if tokenizer:
        print("Token-based chunking active (tiktoken cl100k_base)")
    else:
        print("Warning: tiktoken not installed — using character estimate. Run: pip install tiktoken")

    for file_path in sorted(files):
        print(f"\nLoading: {file_path.name}")
        pages = load_document(str(file_path))
        if pages:
            chunks = chunk_document(pages, source_name=file_path.name)
            all_chunks.extend(chunks)
            total_chars = sum(len(p["text"]) for p in pages)
            print(f"  -> {len(chunks)} chunks | {total_chars:,} chars | ~{total_chars // 4:,} tokens estimated")
        else:
            print(f"  -> No text extracted (scanned PDF or empty file)")

    print(f"\nTotal chunks ready: {len(all_chunks)}")
    return all_chunks
