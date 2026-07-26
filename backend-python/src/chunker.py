"""
CyberSecAI — Smart Document Chunking Engine
Optimized for ethical hacking books, CTF writeups, CVE databases, and tool documentation.

Key improvements over generic chunkers:
  1. Semantic boundary detection  — never splits inside a ## section or CVE block
  2. Code block preservation      — fenced ``` blocks are NEVER split mid-code
  3. Larger chunks (600 tokens)   — keeps attack sequences and technique descriptions whole
  4. Bigger overlap (100 tokens)  — catches answers that straddle boundaries
  5. Sentence-aware splitting     — handles IPs (192.168.1.1), CVE IDs, file paths

Supports: PDF, TXT, DOCX, MD
"""
from __future__ import annotations
import re
from pathlib import Path

# ─── Chunking config (in TOKENS) ─────────────────────────────────────────────
CHUNK_SIZE    = 600   # Larger for dense cybersec text (attack chains, CVE details)
CHUNK_OVERLAP = 100   # Bigger overlap catches answers at boundaries

# Cybersecurity section header patterns (never split mid-section)
_SECTION_HEADER_RE = re.compile(
    r'^(#+\s|'                          # Markdown headers (#, ##, ###)
    r'CVE-\d{4}-\d+|'                  # CVE identifiers
    r'(?:CHAPTER|SECTION|MODULE|LAB|EXERCISE|STEP)\s+\d+|'  # Book structure
    r'(?:Attack|Exploit|Payload|Enumeration|Reconnaissance|'
    r'Post.Exploitation|Privilege.Escalation|Lateral.Movement|'
    r'Defense.Evasion|Persistence|Command.and.Control|Exfiltration|'
    r'Impact|Discovery|Collection|Credential.Access)'
    r'\s*[:\-])',
    re.IGNORECASE | re.MULTILINE
)

# Fenced code block detector
_CODE_FENCE_RE = re.compile(r'^```', re.MULTILINE)


# ─── Tokenizer ───────────────────────────────────────────────────────────────

def _get_tokenizer():
    """Lazy-load tiktoken. Falls back to char/4 estimate if not installed."""
    try:
        import tiktoken
        return tiktoken.get_encoding("cl100k_base")
    except ImportError:
        return None


def _count_tokens(text: str, tokenizer) -> int:
    if tokenizer:
        return len(tokenizer.encode(text))
    return len(text) // 4


# ─── Code block extraction ────────────────────────────────────────────────────

def _extract_code_blocks(text: str) -> tuple[str, dict[str, str]]:
    """
    Replace fenced code blocks with placeholders so they are never split.
    Returns (text_with_placeholders, {placeholder: original_block}).
    """
    placeholders = {}
    idx = 0

    def replace_block(m):
        nonlocal idx
        key = f"__CODE_BLOCK_{idx}__"
        idx += 1
        placeholders[key] = m.group(0)
        return key

    # Match fenced code blocks (``` ... ```)
    pattern = re.compile(r'```[\s\S]*?```', re.DOTALL)
    replaced = pattern.sub(replace_block, text)
    return replaced, placeholders


def _restore_code_blocks(text: str, placeholders: dict[str, str]) -> str:
    for key, val in placeholders.items():
        text = text.replace(key, val)
    return text


# ─── Sentence splitter (cybersec-safe) ───────────────────────────────────────

def _split_sentences(text: str) -> list[str]:
    """
    Split text into sentences. Uses nltk if available; otherwise uses a
    cybersec-safe regex that doesn't split on IPs, CVE IDs, or file paths.
    """
    try:
        import nltk
        try:
            nltk.data.find("tokenizers/punkt_tab")
        except LookupError:
            nltk.download("punkt_tab", quiet=True)
        from nltk.tokenize import sent_tokenize
        return sent_tokenize(text)
    except Exception:
        # Fallback: regex sentence split, preserving IPs, URLs, CVEs
        # Only split on '. ' followed by uppercase, but NOT inside IPs or numbers
        pattern = re.compile(r'(?<=[a-z])\.(?=\s+[A-Z])')
        parts = pattern.split(text)
        return [p.strip() for p in parts if p.strip()]


# ─── Core chunker ─────────────────────────────────────────────────────────────

def split_by_tokens(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    """
    Semantic, token-aware chunking for cybersecurity documents:

    1. Extract and protect code blocks (never split inside them)
    2. Split text into semantic units (section headers trigger chunk boundary)
    3. Merge units until chunk_size tokens is reached
    4. Apply token-counted overlap between consecutive chunks
    5. Restore code blocks in final chunks
    """
    tokenizer = _get_tokenizer()

    # Step 1: Protect code blocks
    text_safe, code_placeholders = _extract_code_blocks(text)

    # Step 2: Split into semantic paragraphs
    # Use double newlines AND section headers as split points
    raw_paras = re.split(r'\n{2,}', text_safe)
    paragraphs = [p.strip() for p in raw_paras if p.strip()]

    chunks: list[str] = []
    current_paras: list[str] = []
    current_tokens: int = 0

    for para in paragraphs:
        # Force a chunk boundary BEFORE any section header
        if _SECTION_HEADER_RE.match(para) and current_paras and current_tokens > chunk_size // 3:
            chunk_text = "\n\n".join(current_paras)
            chunks.append(_restore_code_blocks(chunk_text, code_placeholders))

            # Keep overlap
            overlap_paras, overlap_tok = _build_overlap(current_paras, chunk_overlap, tokenizer)
            current_paras = overlap_paras
            current_tokens = overlap_tok

        para_tokens = _count_tokens(para, tokenizer)

        # Single para larger than chunk_size → split by sentences
        if para_tokens > chunk_size:
            if current_paras:
                chunk_text = "\n\n".join(current_paras)
                chunks.append(_restore_code_blocks(chunk_text, code_placeholders))
                overlap_paras, overlap_tok = _build_overlap(current_paras, chunk_overlap, tokenizer)
                current_paras = overlap_paras
                current_tokens = overlap_tok

            # Split large paragraph into sentence-level chunks
            sentence_chunks = _chunk_sentences(para, chunk_size, chunk_overlap, tokenizer)
            for sc in sentence_chunks[:-1]:
                chunks.append(_restore_code_blocks(sc, code_placeholders))
            # Last sentence chunk goes back into current buffer
            if sentence_chunks:
                last = sentence_chunks[-1]
                last_tok = _count_tokens(last, tokenizer)
                current_paras = [last]
                current_tokens = last_tok
            continue

        # Would overflow → flush first
        if current_tokens + para_tokens > chunk_size and current_paras:
            chunk_text = "\n\n".join(current_paras)
            chunks.append(_restore_code_blocks(chunk_text, code_placeholders))

            overlap_paras, overlap_tok = _build_overlap(current_paras, chunk_overlap, tokenizer)
            current_paras = overlap_paras
            current_tokens = overlap_tok

        current_paras.append(para)
        current_tokens += para_tokens

    # Flush remainder
    if current_paras:
        chunk_text = "\n\n".join(current_paras)
        chunks.append(_restore_code_blocks(chunk_text, code_placeholders))

    return [c.strip() for c in chunks if c.strip()]


def _build_overlap(paras: list[str], overlap_budget: int, tokenizer) -> tuple[list[str], int]:
    """Walk backwards through paragraphs, accumulate up to overlap_budget tokens."""
    overlap_paras: list[str] = []
    overlap_tok = 0
    for p in reversed(paras):
        t = _count_tokens(p, tokenizer)
        if overlap_tok + t > overlap_budget:
            break
        overlap_paras.insert(0, p)
        overlap_tok += t
    return overlap_paras, overlap_tok


def _chunk_sentences(text: str, chunk_size: int, chunk_overlap: int, tokenizer) -> list[str]:
    """Split a large paragraph into sentence-level chunks with overlap."""
    sentences = _split_sentences(text)
    chunks: list[str] = []
    buf: list[str] = []
    buf_tok = 0

    for sent in sentences:
        s_tok = _count_tokens(sent, tokenizer)
        if buf_tok + s_tok > chunk_size and buf:
            chunks.append(" ".join(buf))
            overlap_buf, overlap_tok = _build_overlap(buf, chunk_overlap, tokenizer)
            buf = overlap_buf + [sent]
            buf_tok = overlap_tok + s_tok
        else:
            buf.append(sent)
            buf_tok += s_tok

    if buf:
        chunks.append(" ".join(buf))
    return chunks


# ─── Metadata enrichment ──────────────────────────────────────────────────────

def _detect_content_type(text: str) -> str:
    """Classify chunk content type for metadata tagging."""
    if re.search(r'```', text):
        return "code"
    if re.search(r'CVE-\d{4}-\d+', text, re.IGNORECASE):
        return "cve"
    if re.search(r'(?:nmap|metasploit|burp|wireshark|sqlmap|hydra|hashcat|aircrack|'
                 r'nikto|dirb|gobuster|netcat|nc |curl|wget)\b', text, re.IGNORECASE):
        return "tool_usage"
    if re.search(r'(?:exploit|payload|shellcode|buffer.overflow|heap.spray|'
                 r'use.after.free|format.string|race.condition)\b', text, re.IGNORECASE):
        return "exploit"
    if re.search(r'(?:MITRE|ATT&CK|T\d{4}|TA\d{4})', text):
        return "mitre"
    if re.search(r'(?:password|hash|crack|brute.force|rainbow|credential)', text, re.IGNORECASE):
        return "credential"
    if re.search(r'(?:network|port|protocol|TCP|UDP|ICMP|HTTP|HTTPS|SSH|FTP|SMB|DNS|LDAP)', text, re.IGNORECASE):
        return "network"
    return "general"


def _extract_cves(text: str) -> list[str]:
    """Extract all CVE IDs mentioned in a chunk."""
    return re.findall(r'CVE-\d{4}-\d+', text, re.IGNORECASE)


def _extract_section_header(text: str) -> str:
    """Extract the first detected section header from a chunk."""
    match = _SECTION_HEADER_RE.search(text)
    if match:
        # Return first line that is/contains the header
        for line in text.split('\n'):
            if _SECTION_HEADER_RE.match(line.strip()):
                return line.strip()[:120]
    # Fallback: first non-empty line
    for line in text.split('\n'):
        if line.strip():
            return line.strip()[:120]
    return ""


# ─── Document loaders ─────────────────────────────────────────────────────────

def load_pdf(file_path: str) -> list[dict]:
    """Load PDF with per-page text and page number tracking."""
    from pypdf import PdfReader
    reader = PdfReader(file_path)
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            pages.append({"text": text, "page": i + 1})
    return pages


def load_txt(file_path: str) -> list[dict]:
    """Load plain text / markdown file."""
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
    loaders = {
        ".pdf": load_pdf,
        ".txt": load_txt,
        ".md":  load_txt,   # Markdown treated as plain text
        ".docx": load_docx,
    }
    if ext in loaders:
        return loaders[ext](file_path)
    print(f"  Skipping unsupported file: {file_path}")
    return []


# ─── Chunker ──────────────────────────────────────────────────────────────────

def chunk_document(pages: list[dict], source_name: str) -> list[dict]:
    """
    Split document pages into semantic, token-safe chunks.
    Each chunk carries rich metadata for filtering and display.
    """
    full_text = "\n\n".join([p["text"] for p in pages])
    raw_chunks = split_by_tokens(full_text, CHUNK_SIZE, CHUNK_OVERLAP)

    result = []
    for i, chunk_text in enumerate(raw_chunks):
        # Page tracking: find which pages contain lines from this chunk
        chunk_pages = []
        sample_lines = [l for l in chunk_text.split("\n") if l.strip()][:3]
        for p in pages:
            if any(line in p["text"] for line in sample_lines):
                chunk_pages.append(p["page"])

        content_type = _detect_content_type(chunk_text)
        cves         = _extract_cves(chunk_text)
        section      = _extract_section_header(chunk_text)

        result.append({
            "text": chunk_text,
            "metadata": {
                "source":       source_name,
                "chunk_index":  i,
                "total_chunks": len(raw_chunks),
                "pages":        chunk_pages[:3] if chunk_pages else [1],
                "content_type": content_type,
                "cves":         cves,
                "section":      section,
            }
        })

    return result


def load_all_documents(docs_folder: str) -> list[dict]:
    """Load and chunk all supported documents from the folder."""
    all_chunks = []
    docs_path  = Path(docs_folder)
    supported  = {".pdf", ".txt", ".docx", ".md"}

    files = [f for f in docs_path.iterdir() if f.suffix.lower() in supported]
    print(f"Found {len(files)} document(s) in {docs_folder}")

    tokenizer = _get_tokenizer()
    if tokenizer:
        print(f"Semantic chunking active — chunk_size={CHUNK_SIZE} tokens, overlap={CHUNK_OVERLAP} tokens")
    else:
        print("Warning: tiktoken not installed — using char/4 estimate. Run: pip install tiktoken")

    for file_path in sorted(files):
        print(f"\nLoading: {file_path.name}")
        pages = load_document(str(file_path))
        if pages:
            chunks = chunk_document(pages, source_name=file_path.name)
            all_chunks.extend(chunks)
            total_chars  = sum(len(p["text"]) for p in pages)
            code_chunks  = sum(1 for c in chunks if c["metadata"]["content_type"] == "code")
            cve_chunks   = sum(1 for c in chunks if c["metadata"]["cves"])
            print(f"  -> {len(chunks)} chunks | {total_chars:,} chars | "
                  f"{code_chunks} code chunks | {cve_chunks} CVE chunks")
        else:
            print(f"  -> No text extracted (scanned PDF or empty file)")

    print(f"\nTotal chunks ready: {len(all_chunks)}")
    return all_chunks
