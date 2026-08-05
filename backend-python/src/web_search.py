"""
ResearchFlow AI — Live Web Search Engine
v5.1 — Bug Fixes + Perplexity Metadata

Bug 6 Fix: Added threading.Lock around all _web_cache reads/writes.
  The OrderedDict was accessed concurrently from ThreadPoolExecutor workers,
  causing potential dict corruption under high load.

New: Enriched result metadata
  - domain: extracted from URL for display
  - favicon_url: constructed Google favicon CDN URL for frontend display
  - confidence: estimated relevance (0–100) based on result position

Uses DuckDuckGo Search (dags) to retrieve live web intelligence that is
ALWAYS combined with local RAG results — not just used as a fallback.
"""
import re
import hashlib
import time
import threading
from collections import OrderedDict
from urllib.parse import urlparse

try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS

# ─── Thread-safe Cache (Bug 6 Fix) ────────────────────────────────────────────
_CACHE_MAX     = 256
_web_cache     = OrderedDict()
_cache_lock    = threading.Lock()   # Protects all _web_cache mutations
_CACHE_TTL     = 3600       # 1 hour default
_FRESH_CACHE_TTL = 1800     # 30 min for news/recent queries (fresher results)


def _cache_key(query: str) -> str:
    return hashlib.md5(query.strip().lower().encode("utf-8")).hexdigest()



def _extract_domain(url: str) -> str:
    """Extract the bare domain from a URL."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc
        # Strip www. prefix
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""


def _favicon_url(domain: str) -> str:
    """Return a Google favicon CDN URL for the given domain."""
    if not domain:
        return ""
    return f"https://www.google.com/s2/favicons?domain={domain}&sz=32"


def _result_confidence(rank: int, total: int) -> int:
    """
    Estimate a 0–100 confidence score for a web result based on its rank.
    Top result = 100, last result decays linearly.
    """
    if total <= 1:
        return 90
    return max(30, round(100 - (rank / max(total - 1, 1)) * 60))


def build_research_web_query(question: str) -> str:
    """
    Transform a raw user question into an adaptive high-signal web query.

    Strategy:
      - Short queries      → Search as-is
      - General queries    → Clean original query to search diverse open web sources
    """
    q = question.strip()
    words = q.split()

    # Conversational or short queries → search as-is to preserve natural intent
    if len(words) <= 4:
        return q

    # Identify if it asks for recent news or fresh info
    news_markers = ["latest", "recent", "news", "today", "update"]
    if any(m in q.lower() for m in news_markers):
        return f"{q} latest news updates"

    # General / Open Web query → return clean question to allow DuckDuckGo to hit diverse open web sources
    return q


def perform_web_search(query: str, max_results: int = 6) -> list[dict]:
    """
    Perform a live web search using DuckDuckGo with retry + exponential backoff.

    v6.0: Added 3-attempt retry with exponential backoff to handle rate limits
    and transient DuckDuckGo blocks. Each retry uses a fresh DDGS instance since
    the connection state may be bad after a rate-limit error.

    Bug 6 Fix: All cache reads and writes are protected by _cache_lock.

    Args:
        query:       Raw search query (transformed by build_research_web_query)
        max_results: Maximum number of results

    Returns:
        List of dicts: [{
            "title": str, "snippet": str, "url": str,
            "domain": str, "favicon_url": str, "confidence": int
        }, ...]
    """
    refined_query = build_research_web_query(query)
    if not refined_query:
        return []

    # TTL depends on query type
    is_news = any(m in query.lower() for m in ["latest", "recent", "news", "today", "update"])
    ttl = _FRESH_CACHE_TTL if is_news else _CACHE_TTL

    key = _cache_key(refined_query)
    now = time.time()

    # Thread-safe cache read
    with _cache_lock:
        if key in _web_cache:
            entry = _web_cache[key]
            if now - entry["timestamp"] < ttl:
                _web_cache.move_to_end(key)
                print(f"  [Web Cache Hit] '{query[:40]}' ({len(entry['results'])} results)")
                return entry["results"]

    print(f"  [Web Search] DuckDuckGo: '{refined_query[:80]}'")

    results = []
    last_error = None

    # v6.0: Retry loop with exponential backoff
    for attempt in range(3):
        try:
            if attempt > 0:
                wait = 2 ** attempt   # 2s, 4s
                print(f"  [Web Search] Retry {attempt}/2 after {wait}s (last error: {last_error})")
                time.sleep(wait)

            ddgs = DDGS()   # Fresh instance on each attempt
            raw = list(ddgs.text(refined_query, max_results=max_results))
            total = len(raw)
            for rank, r in enumerate(raw):
                title   = r.get("title", "").strip()
                snippet = r.get("body", r.get("snippet", "")).strip()
                url     = r.get("href", r.get("link", "")).strip()
                if title and snippet:
                    domain = _extract_domain(url)
                    results.append({
                        "title":       title,
                        "snippet":     snippet,
                        "url":         url,
                        "domain":      domain,
                        "favicon_url": _favicon_url(domain),
                        "confidence":  _result_confidence(rank, total),
                    })

            print(f"  [Web Search OK] {len(results)} results for: '{query[:50]}'")
            break   # Success — exit retry loop

        except Exception as e:
            last_error = str(e)
            error_lower = last_error.lower()
            is_rate_limit = "ratelimit" in error_lower or "rate limit" in error_lower or "429" in last_error
            if is_rate_limit:
                print(f"  [Web Search] Rate limited (attempt {attempt+1}/3)")
            else:
                print(f"  [Web Search Warning] DuckDuckGo error (attempt {attempt+1}/3): {last_error[:120]}")
                if attempt == 2:
                    # Non-rate-limit errors are unlikely to succeed on retry
                    break

    if not results:
        print(f"  [Web Search] All attempts failed — returning empty results")
        return []

    # Thread-safe cache write
    with _cache_lock:
        _web_cache[key] = {"timestamp": now, "results": results}
        if len(_web_cache) > _CACHE_MAX:
            _web_cache.popitem(last=False)

    return results


def format_web_context(web_results: list[dict], max_snippet_len: int = 350) -> str:
    """Format web search results into clean XML blocks for LLM prompting."""
    if not web_results:
        return ""

    blocks = []
    for i, res in enumerate(web_results):
        title   = res.get("title", "Web Source")
        snippet = res.get("snippet", "").strip()
        if len(snippet) > max_snippet_len:
            snippet = snippet[:max_snippet_len] + "..."
        url     = res.get("url", "")
        blocks.append(
            f'<web_source index="{i+1}" title="{title}" url="{url}">\n{snippet}\n</web_source>'
        )

    return "\n\n".join(blocks)
