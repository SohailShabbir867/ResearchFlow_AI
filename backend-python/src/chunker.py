from pathlib import Path
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


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
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ".", " "]
    )
    chunks = splitter.split_text(text)

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
