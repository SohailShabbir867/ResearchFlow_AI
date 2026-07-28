"""
CyberSecAI — Live Web Search Engine
v5.1 — Bug Fixes + Perplexity Metadata

Bug 6 Fix: Added threading.Lock around all _web_cache reads/writes.
  The OrderedDict was accessed concurrently from ThreadPoolExecutor workers,
  causing potential dict corruption under high load.

New: Enriched result metadata
  - domain: extracted from URL for display
  - favicon_url: constructed Google favicon CDN URL for frontend display
  - confidence: estimated relevance (0–100) based on result position

Uses DuckDuckGo Search (DDGS) to retrieve live web intelligence that is
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
_CVE_CACHE_TTL = 1800       # 30 min for CVE / vuln queries (fresher results)

# ─── Security-focused site boosters ──────────────────────────────────────────
_VULN_SITES = (
    "site:nvd.nist.gov OR site:exploit-db.com OR site:github.com "
    "OR site:hackerone.com OR site:cvedetails.com OR site:packetstormsecurity.com"
)
_TOOL_SITES = (
    "site:github.com OR site:kali.org OR site:man7.org OR site:gtfobins.github.io "
    "OR site:lolbas-project.github.io OR site:book.hacktricks.xyz"
)
_CTF_SITES = (
    "site:ctftime.org OR site:github.com OR site:medium.com OR site:writeups.ropemporium.com"
)


def _cache_key(query: str) -> str:
    return hashlib.md5(query.strip().lower().encode("utf-8")).hexdigest()


def _is_cve_query(q: str) -> bool:
    return bool(re.search(r"CVE-\d{4}-\d+", q, re.IGNORECASE))


def _is_tool_query(q: str) -> bool:
    tools = [
        "nmap", "burp", "metasploit", "sqlmap", "ffuf", "gobuster", "hashcat",
        "hydra", "ncrack", "nikto", "wfuzz", "dirb", "dirbuster", "john",
        "bloodhound", "impacket", "mimikatz", "crackmapexec", "evil-winrm",
        "netcat", "nc", "socat", "pwncat", "ghidra", "ida", "gdb", "pwndbg",
        "radare2", "binwalk", "frida", "objection", "apktool", "jadx",
        "wireshark", "tshark", "responder", "bettercap", "aircrack", "reaver",
        "shodan", "censys", "amass", "subfinder", "nuclei", "nessus", "openvas",
    ]
    q_lower = q.lower()
    return any(t in q_lower for t in tools)


def _is_ctf_query(q: str) -> bool:
    ctf_markers = [
        "ctf", "hackthebox", "htb", "tryhackme", "thm", "picoctf",
        "pwn", "ret2win", "rop chain", "format string", "heap exploit",
        "writeup", "challenge", "flag{", "ctf{",
    ]
    q_lower = q.lower()
    return any(m in q_lower for m in ctf_markers)


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


def build_cybersec_web_query(question: str) -> str:
    """
    Transform a raw user question into a high-signal cybersecurity web query.

    Strategy:
      - CVE questions  → NVD + ExploitDB + CVEDetails site filters
      - Tool questions → GitHub + Kali + GTFOBins + HackTricks site filters
      - CTF questions  → CTFtime + GitHub writeups + ROP-specific sites
      - General pentesting → broad security site boosters
      - For very short questions (< 5 words) the original is returned as-is to
        avoid over-constraining search

    Returns a refined query string ready for DuckDuckGo.
    """
    q = question.strip()
    words = q.split()

    # Very short/conversational → don't inject site filters, just pass through
    if len(words) <= 4:
        return q

    # Extract CVE IDs and build a targeted query
    cve_match = re.findall(r"CVE-\d{4}-\d+", q, re.IGNORECASE)
    if cve_match:
        cve_str = " OR ".join(cve_match)
        return f"{cve_str} exploit PoC technical details {_VULN_SITES}"

    # Tool-specific → GitHub + docs
    if _is_tool_query(q):
        return f"{q} tutorial flags examples usage {_TOOL_SITES}"

    # CTF-specific
    if _is_ctf_query(q):
        return f"{q} writeup solution approach {_CTF_SITES}"

    # General ethical hacking / pentesting / security
    security_keywords = [
        "exploit", "payload", "bypass", "injection", "xss", "sqli", "rce",
        "lfi", "rfi", "ssrf", "ssti", "xxe", "deserialization", "buffer overflow",
        "privilege escalation", "privesc", "lateral movement", "persistence",
        "c2", "command and control", "shellcode", "reversing", "malware",
        "forensics", "osint", "reconnaissance", "enumeration", "pentest",
        "vulnerability", "cve", "zero-day", "0day", "poc", "proof of concept",
        "mitm", "arp spoofing", "wifi hacking", "wpa2", "kerberoasting",
        "pass the hash", "active directory", "bloodhound", "mimikatz",
    ]
    q_lower = q.lower()
    is_security = any(kw in q_lower for kw in security_keywords)

    if is_security:
        return f"{q} {_VULN_SITES}"

    # Fallback → just add GitHub for code examples
    return f"{q} site:github.com OR site:stackoverflow.com"


def perform_web_search(query: str, max_results: int = 6) -> list[dict]:
    """
    Perform a live web search using DuckDuckGo.

    Bug 6 Fix: All cache reads and writes are now protected by _cache_lock to
    ensure thread safety when called from concurrent ThreadPoolExecutor workers.

    Args:
        query:       Raw search query (will be transformed by build_cybersec_web_query)
        max_results: Maximum number of results (default 6 for richer coverage)

    Returns:
        List of dicts: [{
            "title": str, "snippet": str, "url": str,
            "domain": str, "favicon_url": str, "confidence": int
        }, ...]
    """
    refined_query = build_cybersec_web_query(query)
    if not refined_query:
        return []

    # TTL depends on query type
    ttl = _CVE_CACHE_TTL if _is_cve_query(query) else _CACHE_TTL

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
    try:
        ddgs = DDGS()
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
    except Exception as e:
        print(f"  [Web Search Warning] DuckDuckGo failed: {e}")
        return []

    # Thread-safe cache write
    with _cache_lock:
        _web_cache[key] = {"timestamp": now, "results": results}
        if len(_web_cache) > _CACHE_MAX:
            _web_cache.popitem(last=False)

    return results


def format_web_context(web_results: list[dict]) -> str:
    """Format web search results into clean XML blocks for LLM prompting."""
    if not web_results:
        return ""

    blocks = []
    for i, res in enumerate(web_results):
        title   = res.get("title", "Web Source")
        snippet = res.get("snippet", "").strip()
        url     = res.get("url", "")
        blocks.append(
            f'<web_source index="{i+1}" title="{title}" url="{url}">\n{snippet}\n</web_source>'
        )

    return "\n\n".join(blocks)
