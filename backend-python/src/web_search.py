"""
CyberSecAI — Live Web Search Fallback Engine
Uses DuckDuckGo Search (DDGS) to query live web intelligence when local document RAG coverage is insufficient.

Extracts titles, snippets, source URLs, and formats context blocks for LLM prompt augmentation.
Includes LRU cache (128 entries) for fast repeated web queries.
"""
import hashlib
import time
from collections import OrderedDict
try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS

_CACHE_MAX = 128
_web_cache = OrderedDict()
_CACHE_TTL = 3600  # 1 hour TTL for web results


def _cache_key(query: str) -> str:
    return hashlib.md5(query.strip().lower().encode("utf-8")).hexdigest()


def perform_web_search(query: str, max_results: int = 5) -> list[dict]:
    """
    Perform a live web search using DuckDuckGo.

    Args:
        query: Search query string
        max_results: Maximum number of search results to return (default 5)

    Returns:
        List of dicts: [{"title": str, "snippet": str, "url": str}, ...]
    """
    cleaned_query = query.strip()
    if not cleaned_query:
        return []

    # Check cache
    key = _cache_key(cleaned_query)
    now = time.time()
    if key in _web_cache:
        entry = _web_cache[key]
        if now - entry["timestamp"] < _CACHE_TTL:
            _web_cache.move_to_end(key)
            print(f"  [Web Search Cache Hit] '{cleaned_query[:40]}...' ({len(entry['results'])} results)")
            return entry["results"]

    print(f"  [Web Search] Querying DuckDuckGo: '{cleaned_query[:60]}...'")

    results = []
    try:
        ddgs = DDGS()
        # Query DuckDuckGo text search
        raw_results = list(ddgs.text(cleaned_query, max_results=max_results))
        for r in raw_results:
            title = r.get("title", "").strip()
            snippet = r.get("body", r.get("snippet", "")).strip()
            url = r.get("href", r.get("link", "")).strip()

            if title and snippet:
                results.append({
                    "title": title,
                    "snippet": snippet,
                    "url": url,
                })

        print(f"  [Web Search Success] Retrieved {len(results)} web results")

    except Exception as e:
        print(f"  [Web Search Warning] DuckDuckGo query failed: {e}")
        # Return empty list on failure so caller can handle gracefully
        return []

    # Store in cache
    _web_cache[key] = {
        "timestamp": now,
        "results": results,
    }
    if len(_web_cache) > _CACHE_MAX:
        _web_cache.popitem(last=False)

    return results


def format_web_context(web_results: list[dict]) -> str:
    """Format web search results into clean XML blocks for LLM prompting."""
    if not web_results:
        return ""

    blocks = []
    for i, res in enumerate(web_results):
        title = res.get("title", "Web Source")
        snippet = res.get("snippet", "").strip()
        url = res.get("url", "")
        blocks.append(
            f'<web_source index="{i+1}" title="{title}" url="{url}">\n{snippet}\n</web_source>'
        )

    return "\n\n".join(blocks)
