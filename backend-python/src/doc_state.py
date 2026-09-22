"""
doc_state.py — Shared, cross-process document-processing state.

Both api.py (the /upload endpoint) and watcher.py (the folder-watching daemon)
write files into data/documents/ and independently embed them. Writing the
upload into that folder also triggers the watcher's filesystem event, so
without coordination the same document gets embedded twice — once by the API
request handler and once by the watcher — producing duplicate Qdrant points
and duplicate BM25 entries.

This module is the single source of truth for "has filename+content_hash
already been embedded", persisted to data/.watcher_state.json and guarded by
a lockfile so the two processes never clobber each other's writes.
"""
import os
import json
import time
from pathlib import Path

BASE_DIR   = Path(__file__).parent.parent          # backend-python/
STATE_FILE = BASE_DIR / "data" / ".watcher_state.json"
LOCK_FILE  = BASE_DIR / "data" / ".watcher_state.lock"

_LOCK_TIMEOUT = 5.0   # seconds
_LOCK_POLL    = 0.05  # seconds


def _acquire_lock(timeout: float = _LOCK_TIMEOUT) -> bool:
    """Best-effort cross-process mutex via atomic exclusive file creation."""
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    start = time.time()
    while True:
        try:
            fd = os.open(str(LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.close(fd)
            return True
        except FileExistsError:
            if time.time() - start > timeout:
                return False
            time.sleep(_LOCK_POLL)


def _release_lock() -> None:
    try:
        LOCK_FILE.unlink()
    except FileNotFoundError:
        pass


def load_state() -> dict:
    """Return {filename: sha256_hex} mapping of already-processed files."""
    try:
        if STATE_FILE.exists():
            with open(STATE_FILE) as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def is_processed(filename: str, content_hash: str) -> bool:
    """Fresh read — true if this exact filename+content hash was already embedded."""
    return load_state().get(filename) == content_hash


def mark_processed(filename: str, content_hash: str) -> None:
    """
    Atomically record filename -> content_hash as embedded.

    Always reloads the on-disk state under the lock before writing so a
    concurrent update from the other process (API vs. watcher) is merged
    rather than overwritten by a stale in-memory copy.
    """
    if not _acquire_lock():
        return  # best-effort: a missed mark just means a possible re-embed later
    try:
        state = load_state()
        state[filename] = content_hash
        tmp = STATE_FILE.with_suffix(".tmp")
        with open(tmp, "w") as f:
            json.dump(state, f, indent=2)
        tmp.replace(STATE_FILE)
    finally:
        _release_lock()


def clear_processed(filename: str) -> None:
    """Remove a filename's entry, e.g. after a failed upload whose file was deleted."""
    if not _acquire_lock():
        return
    try:
        state = load_state()
        if filename in state:
            del state[filename]
            tmp = STATE_FILE.with_suffix(".tmp")
            with open(tmp, "w") as f:
                json.dump(state, f, indent=2)
            tmp.replace(STATE_FILE)
    finally:
        _release_lock()
