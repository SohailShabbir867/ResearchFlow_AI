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
import os
from datetime import datetime, timezone
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
_MAX_RETRIES = max(0, int(os.getenv("WEB_SEARCH_RETRIES", "1")))

_TRUSTED_DOMAINS = {
    "nih.gov", "ncbi.nlm.nih.gov", "pubmed.ncbi.nlm.nih.gov", "who.int",
    "cdc.gov", "fda.gov", "nature.com", "science.org", "thelancet.com",
    "nejm.org", "bmj.com", "jamanetwork.com", "arxiv.org", "nist.gov",
    "europa.eu", "oecd.org", "worldbank.org", "imf.org", "un.org",
    "reuters.com", "apnews.com", "bbc.com",
}

_AUTHORITATIVE_HINTS = (
    "official",
    "research",
    "study",
    "report",
    "guideline",
    "documentation",
    "docs",
    "paper",
    "publication",
    "statistics",
    "data",
)


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


def _parse_result_time(value):
    """Best-effort parse of a result timestamp field."""
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = str(value).strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _authority_bonus(domain: str) -> int:
    """Prefer authoritative domains for research accuracy."""
    if not domain:
        return 0
    domain_lower = domain.lower()
    if domain_lower in _TRUSTED_DOMAINS:
        return 15
    if domain_lower.endswith(".gov") or domain_lower.endswith(".edu"):
        return 12
    if ".ac." in domain_lower:
        return 8
    return 0


def _keyword_overlap_bonus(query: str, title: str, snippet: str) -> int:
    """Reward results that overlap with the user's terms without overfitting."""
    query_terms = {t for t in re.findall(r"[a-z0-9]+", query.lower()) if len(t) > 3}
    if not query_terms:
        return 0
    haystack = f"{title} {snippet}".lower()
    overlap = sum(1 for term in query_terms if term in haystack)
    if overlap >= 5:
        return 10
    if overlap >= 3:
        return 6
    if overlap >= 1:
        return 3
    return 0


def _query_variants(query: str) -> list[str]:
    """Create a small set of high-signal query variants for better coverage."""
    q = query.strip()
    if not q:
        return []

    variants = [q]
    lowered = q.lower()

    if any(marker in lowered for marker in _AUTHORITATIVE_HINTS):
        variants.append(f"{q} official source")

    if any(marker in lowered for marker in ["latest", "recent", "current", "today", "update", "news"]):
        variants.append(f"{q} latest official updates")

    if any(marker in lowered for marker in ["buy", "purchase", "price", "pricing", "budget", "compare", "comparison"]):
        variants.append(f"{q} specifications pricing review")

    if len(q.split()) > 8:
        # Shorter semantic variant often returns cleaner sources.
        variants.append(" ".join(q.split()[:8]))

    deduped = []
    seen = set()
    for variant in variants:
        normalized = variant.strip().lower()
        if normalized and normalized not in seen:
            seen.add(normalized)
            deduped.append(variant)
    return deduped[:3]


def _freshness_bonus(published_at, is_news: bool) -> int:
    """Prefer recent sources when the query asks for current information."""
    if not published_at:
        return 0
    if not isinstance(published_at, datetime):
        published_at = _parse_result_time(published_at)
    if not published_at:
        return 0
    age_days = max(0, (datetime.now(timezone.utc) - published_at).days)
    if is_news:
        if age_days <= 7:
            return 18
        if age_days <= 30:
            return 12
        if age_days <= 180:
            return 6
        return -4
    if age_days <= 365:
        return 6
    return 0


def _rank_web_results(query: str, raw_results: list[dict]) -> list[dict]:
    """Assign an accuracy-first score and return results sorted best-first."""
    is_news = any(m in query.lower() for m in ["latest", "recent", "news", "today", "update", "current", "2025", "2026"])
    ranked = []
    seen_urls = set()

    for idx, res in enumerate(raw_results):
        title = (res.get("title") or "").strip()
        snippet = (res.get("snippet") or "").strip()
        url = (res.get("url") or "").strip()
        if not title or not snippet or not url:
            continue
        if url in seen_urls:
            continue
        seen_urls.add(url)

        domain = res.get("domain") or _extract_domain(url)
        score = int(res.get("confidence", _result_confidence(idx, max(len(raw_results), 1))))
        score += _authority_bonus(domain)
        score += _keyword_overlap_bonus(query, title, snippet)
        score += _freshness_bonus(res.get("date") or res.get("published"), is_news)

        ranked.append({
            **res,
            "domain": domain,
            "confidence": max(0, min(100, score)),
        })

    ranked.sort(key=lambda item: (item.get("confidence", 0), item.get("domain", "")), reverse=True)
    return ranked


def _merge_ranked_results(query: str, ranked_sets: list[list[dict]], max_results: int) -> list[dict]:
    """Merge multiple ranked result sets while keeping the highest-confidence copy of each URL."""
    merged = {}
    for result_set in ranked_sets:
        for rank, item in enumerate(result_set):
            url = item.get("url")
            if not url:
                continue
            current = merged.get(url)
            if current is None or item.get("confidence", 0) > current.get("confidence", 0):
                merged[url] = item

    results = list(merged.values())
    results = _rank_web_results(query, results)
    return results[:max_results]


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

    query_variants = _query_variants(refined_query)
    print(f"  [Web Search] DuckDuckGo variants: {len(query_variants)} query(ies)")

    ranked_sets = []
    last_error = None

    # v6.0: Retry loop with exponential backoff
    for variant in query_variants:
        variant_results = []
        for attempt in range(_MAX_RETRIES + 1):
            try:
                if attempt > 0:
                    wait = 2 ** (attempt - 1)
                    print(f"  [Web Search] Retry {attempt}/{_MAX_RETRIES} after {wait}s (last error: {last_error})")
                    time.sleep(wait)

                ddgs = DDGS()   # Fresh instance on each attempt
                raw = list(ddgs.text(variant, max_results=max_results * 2))
                total = len(raw)
                for rank, r in enumerate(raw):
                    title   = (r.get("title") or "").strip()
                    snippet = (r.get("body", r.get("snippet", "")) or "").strip()
                    url     = (r.get("href", r.get("link", "")) or "").strip()
                    if title and snippet and url:
                        domain = _extract_domain(url)
                        variant_results.append({
                            "title":       title,
                            "snippet":     snippet,
                            "url":         url,
                            "domain":      domain,
                            "favicon_url": _favicon_url(domain),
                            "confidence":  _result_confidence(rank, total),
                            "date":        r.get("date") or r.get("published"),
                        })

                print(f"  [Web Search OK] {len(variant_results)} raw results for: '{variant[:60]}'")
                break   # Success — exit retry loop for this variant

            except Exception as e:
                last_error = str(e)
                error_lower = last_error.lower()
                is_rate_limit = "ratelimit" in error_lower or "rate limit" in error_lower or "429" in last_error
                if is_rate_limit:
                    print(f"  [Web Search] Rate limited (attempt {attempt+1}/{_MAX_RETRIES + 1})")
                else:
                    print(f"  [Web Search Warning] DuckDuckGo error (attempt {attempt+1}/{_MAX_RETRIES + 1}): {last_error[:120]}")
                    if attempt == _MAX_RETRIES:
                        # Non-rate-limit errors are unlikely to succeed on retry
                        break

        if variant_results:
            ranked_sets.append(_rank_web_results(variant, variant_results))

    if not ranked_sets:
        print(f"  [Web Search] All attempts failed — returning empty results")
        return []

    results = _merge_ranked_results(query, ranked_sets, max_results)

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
        domain  = res.get("domain", "")
        confidence = res.get("confidence", 0)
        published = res.get("date") or res.get("published") or ""
        excerpt  = snippet.replace("\n", " ").strip()
        blocks.append(
            f'<web_source index="{i+1}" title="{title}" domain="{domain}" confidence="{confidence}" published="{published}" url="{url}">\n'
            f'<summary>{excerpt}</summary>\n'
            f'<use_when>Use this source when the query needs current facts, product details, or authoritative confirmation.</use_when>\n'
            f'</web_source>'
        )

    return "\n\n".join(blocks)


def needs_freshness(query: str) -> bool:
    """Detect if query requires fresh/live web intelligence."""
    if not query:
        return False
    q_lower = query.lower()
    return any(m in q_lower for m in ["latest", "recent", "news", "today", "update", "current", "2025", "2026", "price", "stock", "weather", "breaking"])

