"""
watcher.py — Auto-Embedding File Watcher Daemon
================================================
Watches backend-python/data/documents/ for new or modified files.
When a supported file is detected:
  1. SHA-256 deduplication — already-indexed files are skipped instantly.
  2. The file is queued and processed serially (no parallel embed storms).
  3. Uses the same chunker → embedder → vector_store pipeline as the API.
  4. Results are written to PM2 logs (stdout/stderr).

Run via PM2:
  pm2 start backend-python/src/watcher.py \
      --name medresearch-watcher \
      --interpreter backend-python/.venv/bin/python \
      --cwd /home/ubuntu/medresearch-ai

The process auto-restarts on crash and persists across reboots via `pm2 save`.
"""

import os
import sys
import time
import json
import queue
import hashlib
import logging
import threading
from pathlib import Path
from datetime import datetime

# ─── Logging setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [WATCHER] %(levelname)-8s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("watcher")

# ─── Paths ────────────────────────────────────────────────────────────────────
SRC_DIR   = Path(__file__).parent                          # backend-python/src/
BASE_DIR  = SRC_DIR.parent                                 # backend-python/
DOCS_DIR  = BASE_DIR / "data" / "documents"
STATE_FILE = BASE_DIR / "data" / ".watcher_state.json"     # persists processed hashes

SUPPORTED = {".pdf", ".txt", ".docx", ".md"}

# How long to wait after a file event before trying to read it
# (avoids reading a half-written file during large copies)
SETTLE_DELAY = 3.0   # seconds

MAX_RETRIES  = 3
RETRY_DELAY  = 10.0  # seconds between retries

# ─── Shared state ─────────────────────────────────────────────────────────────
embed_queue: "queue.Queue[Path]" = queue.Queue()

# ─── Python path: allow `from src.xxx import` exactly as api.py does ──────────
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))


# ─── Processed-hash persistence ───────────────────────────────────────────────

def _load_state() -> dict:
    """Return {filename: sha256_hex} mapping of already-processed files."""
    try:
        if STATE_FILE.exists():
            with open(STATE_FILE) as f:
                return json.load(f)
    except Exception as e:
        log.warning(f"Could not load watcher state ({e}); starting fresh.")
    return {}


def _save_state(state: dict) -> None:
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(STATE_FILE, "w") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        log.warning(f"Could not save watcher state: {e}")


def _file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


# ─── Core embed logic (mirrors api.py upload_document) ────────────────────────

def _embed_file(path: Path, state: dict) -> bool:
    """
    Embed a single file into Qdrant.
    Returns True on success, False on recoverable failure.
    Raises on unrecoverable errors.
    """
    filename = path.name

    # Wait for file to fully settle (copy / rsync completion)
    time.sleep(SETTLE_DELAY)

    if not path.exists():
        log.warning(f"File disappeared before embedding: {filename}")
        return True  # nothing to do

    file_hash = _file_sha256(path)

    # Skip if same content was already indexed
    if state.get(filename) == file_hash:
        log.info(f"SKIP (unchanged)  {filename}  [{file_hash[:8]}]")
        return True

    log.info(f"START embedding   {filename}  [{file_hash[:8]}]  ({path.stat().st_size / 1024:.1f} KB)")
    t0 = time.time()

    from src.chunker     import load_document, chunk_document
    from src.embedder    import embed_chunks
    from src.vector_store import store_chunks

    pages = load_document(str(path))
    if not pages:
        log.error(f"No text extracted from {filename} — skipping (scanned PDF?).")
        return True  # don't retry a fundamentally unreadable file

    chunks = chunk_document(pages, source_name=filename)
    for c in chunks:
        if "metadata" not in c:
            c["metadata"] = {}
        c["metadata"]["content_hash"] = file_hash

    embedded = embed_chunks(chunks)
    store_chunks(embedded, recreate=False)

    # ── Incremental BM25 update ───────────────────────────────────────────────
    try:
        from src.hybrid_search import add_chunks_to_bm25
        bm25_chunks = []
        for c in chunks:
            meta = c.get("metadata", {})
            bm25_chunks.append({
                "id":           c.get("id"),
                "text":         c.get("text", ""),
                "source":       filename,
                "chunk_index":  meta.get("chunk_index", 0),
                "pages":        meta.get("pages", [1]),
                "content_type": meta.get("content_type", "general"),
                "cves":         meta.get("cves", []),
                "section":      meta.get("section", ""),
            })
        add_chunks_to_bm25(bm25_chunks)
    except ImportError:
        pass  # BM25 is optional — hybrid_search may not exist in all versions
    except Exception as bm25_err:
        log.warning(f"BM25 update skipped: {bm25_err}")

    elapsed = time.time() - t0
    code_chunks = sum(1 for c in chunks if c.get("metadata", {}).get("content_type") == "code")
    cve_chunks  = sum(1 for c in chunks if c.get("metadata", {}).get("cves"))
    log.info(
        f"DONE  {filename}  "
        f"{len(chunks)} chunks  ({code_chunks} code, {cve_chunks} CVE)  "
        f"in {elapsed:.1f}s"
    )

    state[filename] = file_hash
    _save_state(state)
    return True


# ─── Worker thread ────────────────────────────────────────────────────────────

def _worker(state: dict) -> None:
    """
    Pulls files from embed_queue one at a time and embeds them.
    Retries up to MAX_RETRIES times on failure.
    This thread runs forever alongside the watcher.
    """
    log.info("Worker thread started — waiting for files to embed.")
    while True:
        path: Path = embed_queue.get()
        log.info(f"Dequeued: {path.name}  (queue size: {embed_queue.qsize()})")

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                _embed_file(path, state)
                break
            except Exception as e:
                if attempt < MAX_RETRIES:
                    log.error(
                        f"Embed attempt {attempt}/{MAX_RETRIES} failed for "
                        f"{path.name}: {e} — retrying in {RETRY_DELAY}s"
                    )
                    time.sleep(RETRY_DELAY)
                else:
                    log.error(
                        f"FAILED after {MAX_RETRIES} attempts — "
                        f"{path.name}: {e}"
                    )

        embed_queue.task_done()


# ─── Watchdog event handler ───────────────────────────────────────────────────

try:
    from watchdog.observers import Observer
    from watchdog.events    import FileSystemEventHandler, FileCreatedEvent, FileModifiedEvent
except ImportError:
    log.critical(
        "watchdog is not installed. Run: "
        "uv pip install watchdog --python .venv"
    )
    sys.exit(1)


class DocHandler(FileSystemEventHandler):
    """Handle file creation and modification events in the documents folder."""

    # Track recently queued paths to debounce duplicate events
    _queued: set = set()
    _lock = threading.Lock()

    def _should_process(self, path_str: str) -> bool:
        p = Path(path_str)
        # Ignore hidden/temp files (.part, .tmp, ~file, .swp …)
        if p.name.startswith(".") or p.name.startswith("~") or p.suffix.lower() in {".tmp", ".part", ".swp"}:
            return False
        if p.suffix.lower() not in SUPPORTED:
            return False
        return True

    def _enqueue(self, path_str: str) -> None:
        if not self._should_process(path_str):
            return
        p = Path(path_str)
        with self._lock:
            if path_str in self._queued:
                return
            self._queued.add(path_str)

        log.info(f"Detected: {p.name}")
        embed_queue.put(p)

        # Remove from debounce set after a short window
        def _cleanup():
            time.sleep(30)
            with self._lock:
                self._queued.discard(path_str)

        threading.Thread(target=_cleanup, daemon=True).start()

    def on_created(self, event):
        if not event.is_directory:
            self._enqueue(event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self._enqueue(event.src_path)

    def on_moved(self, event):
        # Handle moves/renames into the folder
        if not event.is_directory:
            self._enqueue(event.dest_path)


# ─── Startup: index any existing unprocessed files ───────────────────────────

def _scan_existing(state: dict) -> None:
    """
    On startup, queue any files in DOCS_DIR that haven't been embedded yet
    or whose content has changed since last embed.
    """
    if not DOCS_DIR.exists():
        return
    queued = 0
    for p in sorted(DOCS_DIR.iterdir()):
        if p.is_file() and p.suffix.lower() in SUPPORTED and not p.name.startswith("."):
            file_hash = _file_sha256(p)
            if state.get(p.name) != file_hash:
                log.info(f"Startup scan — queuing unindexed file: {p.name}")
                embed_queue.put(p)
                queued += 1
    if queued:
        log.info(f"Startup scan complete — {queued} file(s) queued.")
    else:
        log.info("Startup scan complete — all existing files already indexed.")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    log.info("=" * 60)
    log.info("  ResearchFlow AI — Auto-Embedding Watcher")
    log.info(f"  Watching: {DOCS_DIR}")
    log.info(f"  State:    {STATE_FILE}")
    log.info("=" * 60)

    DOCS_DIR.mkdir(parents=True, exist_ok=True)

    state = _load_state()

    # Start the embed worker thread (serializes all embedding work)
    worker_thread = threading.Thread(target=_worker, args=(state,), daemon=True, name="embed-worker")
    worker_thread.start()

    # Queue any pre-existing unindexed files
    _scan_existing(state)

    # Start watchdog observer
    handler  = DocHandler()
    observer = Observer()
    observer.schedule(handler, str(DOCS_DIR), recursive=False)
    observer.start()

    log.info("Watching for new documents… (Ctrl+C to stop)")

    try:
        while True:
            time.sleep(5)
            # Heartbeat every 5 minutes so PM2 logs show it's alive
            if int(time.time()) % 300 < 5:
                q_size = embed_queue.qsize()
                status = f"queue={q_size}" if q_size else "idle"
                log.info(f"Heartbeat — {status}")
    except KeyboardInterrupt:
        log.info("Shutting down observer…")
        observer.stop()

    observer.join()
    log.info("Watcher stopped.")


if __name__ == "__main__":
    main()
