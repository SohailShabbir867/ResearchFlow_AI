"""
CyberSecAI — Elite Ethical Hacking & Cybersecurity RAG Pipeline

v4.0 — Full Cybersec Expert System:
  - CyberSecAI persona: ethical hacking, penetration testing, vulnerability research
  - Multi-language code generation: Python, Bash, C/C++, JavaScript/Node.js,
    PowerShell, Ruby, SQL, Assembly (x86/x64)
  - 4 answer styles: short / technical / detailed / ctf
  - Loosened guardrails: -3.5 threshold (cybersec jargon scores lower on rerankers)
  - min_chunks=1: single CVE chunk is enough to answer CVE-specific questions
  - 8 context chunks (up from 5) for complex multi-step attack explanations
  - Conversation memory with cybersec-aware query enrichment
  - Query expansion via hybrid_search module

Pipeline flow:
  1. Enrich query with conversation context + cybersec acronym awareness
  2. Embed query locally (BGE-base ONNX, LRU-256 cached)
  3. Hybrid search: BGE vector + BM25 (expanded) + RRF → top 30 candidates
  4. Rerank with cross-encoder → top 8
  5. Layer 1 + Layer 2 guardrail check (loosened for technical content)
  6. Build cybersec-expert prompt (history + answer style + multi-lang)
  7. Call Groq LLM
  8. Layer 3 — detect and block off-document hallucination
  9. Return answer + sources + metadata
"""
import os
import time
from dotenv import load_dotenv
from src.embedder import get_embedding
from src.hybrid_search import hybrid_search
from src.reranker import rerank

load_dotenv()

# ─── LLM config ──────────────────────────────────────────────────────────────
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL     = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
RERANKER_TOP_K = int(os.getenv("RERANKER_TOP_K", "8"))

# ─── Guardrail thresholds (looser for technical cybersec content) ─────────────
RELEVANCE_THRESHOLD = float(os.getenv("RELEVANCE_THRESHOLD", "-3.5"))
MIN_RELEVANT_CHUNKS = int(os.getenv("MIN_RELEVANT_CHUNKS",   "1"))

# Standard refusal message
REFUSAL_MSG = (
    "CyberSecAI can only answer questions based on the cybersecurity documents "
    "that have been uploaded to this system. This topic is not covered in the "
    "current document collection. Please upload relevant resources (books, "
    "CVE reports, tool documentation, CTF writeups) and try again."
)

# ─── Answer styles ────────────────────────────────────────────────────────────
ANSWER_STYLES = {
    "short": {
        "instruction": (
            "Deliver a concise, direct answer in 1-3 sentences or a short code block. "
            "For commands or payloads, output them immediately in a code block. "
            "Use **bold** for key terms. No introductory filler."
        ),
        "max_tokens": 300,
    },
    "technical": {
        "instruction": (
            "Provide a deeply technical response structured in clean Markdown:\n"
            "- Open with a `## Title` heading.\n"
            "- Explain the technical concept, vulnerability class, or attack vector.\n"
            "- Show working code examples in ALL relevant languages requested. "
            "Always use properly fenced code blocks:\n"
            "  ```python\\n# Python exploit / tool code\\n```\n"
            "  ```bash\\n# Bash/Shell commands\\n```\n"
            "  ```c\\n// C/C++ exploit or shellcode\\n```\n"
            "  ```javascript\\n// JavaScript/Node.js payload\\n```\n"
            "  ```powershell\\n# PowerShell post-exploitation\\n```\n"
            "  ```ruby\\n# Ruby / Metasploit module\\n```\n"
            "  ```nasm\\n; x86/x64 Assembly shellcode\\n```\n"
            "  ```sql\\n-- SQL injection payload\\n```\n"
            "- Reference relevant CVEs, MITRE ATT&CK techniques (TxxXX), or tool flags.\n"
            "- Use `### Subsection` headers to organize: Background, Mechanism, Code, Mitigations."
        ),
        "max_tokens": 3000,
    },
    "detailed": {
        "instruction": (
            "Provide an exhaustive, deeply structured analytical response in Markdown:\n"
            "- Start with a descriptive `## Title` heading.\n"
            "- Executive summary paragraph explaining the attack/concept.\n"
            "- `### Background` — history, affected systems, CVE references.\n"
            "- `### How It Works` — step-by-step technical breakdown.\n"
            "- `### Exploitation` — code in Python, Bash, C/C++, PowerShell, and Assembly as appropriate:\n"
            "  Use properly fenced ``` blocks with language tags.\n"
            "- `### Tools` — relevant tools (Nmap, Metasploit, Burp, SQLmap, etc.) with flags/commands.\n"
            "- `### Defense & Mitigation` — patches, configurations, detection signatures.\n"
            "- `### MITRE ATT&CK` — relevant Tactic/Technique IDs if applicable.\n"
            "- `## Key Takeaways` — 3-5 bulleted key points.\n"
            "Use Markdown tables for comparing payloads, CVEs, or attack variants."
        ),
        "max_tokens": 4000,
    },
    "ctf": {
        "instruction": (
            "Structure your response as a CTF challenge guide in Markdown:\n"
            "- `## Challenge Analysis` — identify the vulnerability type from context.\n"
            "- `### Hints` — 3 progressive hints (spoiler-light → spoiler-heavy).\n"
            "- `### Approach` — methodology and tools to use.\n"
            "- `### Exploit / Payload` — working payload or script:\n"
            "  ```python\\n# CTF exploit script\\n```\n"
            "  ```bash\\n# Enumeration / exploitation commands\\n```\n"
            "- `### Flag Format` — expected format and where to find it.\n"
            "- `### Concepts` — what this challenge teaches (binary exploitation, web, forensics, crypto, etc.)."
        ),
        "max_tokens": 2500,
    },
}

DEFAULT_STYLE    = "technical"
GLOBAL_MAX_TOKENS = 4000


# ─── Guardrail functions ──────────────────────────────────────────────────────

def filter_chunks_by_threshold(chunks: list[dict]) -> list[dict]:
    """Layer 2: Remove chunks whose rerank score is below RELEVANCE_THRESHOLD."""
    return [
        c for c in chunks
        if c.get("rerank_score", -99.0) >= RELEVANCE_THRESHOLD
    ]


def check_guardrails(reranked: list[dict]) -> tuple[bool, str]:
    """
    Run Layer 1 and Layer 2 checks.
    Returns (should_refuse: bool, reason: str).
    """
    top_score = reranked[0].get("rerank_score", -99.0) if reranked else -99.0
    print(f"  [Guardrail L1] Top chunk rerank score: {top_score:.4f} (threshold: {RELEVANCE_THRESHOLD})")

    if top_score < RELEVANCE_THRESHOLD:
        return True, f"Top chunk score {top_score:.4f} below threshold {RELEVANCE_THRESHOLD}"

    passing = filter_chunks_by_threshold(reranked)
    print(f"  [Guardrail L2] {len(passing)}/{len(reranked)} chunks passed threshold (min: {MIN_RELEVANT_CHUNKS})")

    if len(passing) < MIN_RELEVANT_CHUNKS:
        return True, f"Only {len(passing)} chunk(s) passed relevance threshold (need {MIN_RELEVANT_CHUNKS})"

    return False, ""


# ─── Query enrichment ─────────────────────────────────────────────────────────

def enrich_query(question: str, history: list[dict] = None) -> str:
    """
    Enrich the search query with:
    1. Conversation context (last assistant turn for follow-up awareness)
    2. Cybersec acronym expansion is handled by hybrid_search module

    Short follow-up questions are prefixed with the last assistant context
    so the retrieval system understands what "it" or "that" refers to.
    """
    if not history:
        return question

    last_assistant = None
    for msg in reversed(history):
        if msg.get("role") == "assistant":
            last_assistant = msg.get("text", "")
            break

    if not last_assistant or len(last_assistant) < 10:
        return question

    # For short follow-ups, inject context from last answer
    if len(question.split()) <= 10:
        context_snippet = last_assistant[:200].replace("\n", " ").strip()
        enriched = f"{context_snippet} {question}"
        print(f"  [Memory] Enriched query: '{question[:60]}' → context prepended")
        return enriched

    return question


# ─── Prompt builder ───────────────────────────────────────────────────────────

def build_prompt(
    question:       str,
    context_chunks: list[dict],
    history:        list[dict] = None,
    answer_style:   str = None,
) -> str:
    """
    Build a cybersecurity-expert, document-grounded prompt.

    Uses structured XML containers to clearly delineate:
      - System persona and directives (CyberSecAI expert)
      - Context documents from the RAG pipeline
      - Conversation history (memory)
      - User query
      - Response style instruction
    """
    if answer_style not in ANSWER_STYLES:
        answer_style = DEFAULT_STYLE

    style = ANSWER_STYLES[answer_style]

    # Build XML document context with rich metadata
    context_blocks = []
    for i, chunk in enumerate(context_chunks):
        source_name   = chunk.get("source",       f"Document {i+1}")
        text_content  = chunk.get("text",         "").strip()
        content_type  = chunk.get("content_type", "general")
        cves          = chunk.get("cves",         [])
        section       = chunk.get("section",      "")

        meta_attrs = f'index="{i+1}" source="{source_name}" type="{content_type}"'
        if cves:
            meta_attrs += f' cves="{",".join(cves)}"'
        if section:
            meta_attrs += f' section="{section[:80]}"'

        context_blocks.append(
            f'<document {meta_attrs}>\n{text_content}\n</document>'
        )
    context_text = "\n\n".join(context_blocks)

    # Build conversation history XML
    history_xml = ""
    if history:
        recent = history[-6:]
        turns  = []
        for msg in recent:
            role = "user" if msg.get("role") == "user" else "assistant"
            text = (msg.get("text") or "").strip()[:400]
            turns.append(f'  <{role}>{text}</{role}>')
        if turns:
            history_xml = "<conversation_history>\n" + "\n".join(turns) + "\n</conversation_history>\n\n"

    return f"""<system_instructions>
You are CyberSecAI — an elite Ethical Hacking & Cybersecurity Intelligence System trained on authoritative security resources including penetration testing books, CVE databases, CTF writeups, and tool documentation.

<core_directives>
1. GROUNDING MANDATE: All answers must be grounded in <context_documents>. Extract and synthesize technical facts, attack techniques, tool usage, and code examples directly from the provided context.

2. MULTI-LANGUAGE CODE GENERATION: When asked for code, scripts, tools, exploits, or payloads, generate NEW, complete, production-quality code in the requested language. Adapt concepts from the documents into working implementations. Support ALL of these languages with proper fenced code blocks:
   - Python    → ```python ... ```
   - Bash/Shell → ```bash ... ```
   - C/C++     → ```c ... ``` or ```cpp ... ```
   - JavaScript/Node.js → ```javascript ... ```
   - PowerShell → ```powershell ... ```
   - Ruby/Metasploit → ```ruby ... ```
   - SQL       → ```sql ... ```
   - Assembly (x86/x64) → ```nasm ... ```
   Always add comments explaining what each section does. Include example usage.

3. CYBERSECURITY DEPTH: Reference CVEs, MITRE ATT&CK techniques (TxxXX/TAxxXX), tool flags (nmap -sV -sC, msfconsole, etc.), and specific payload constructions when relevant.

4. REFUSAL PROTOCOL: If the concept CANNOT be derived from <context_documents>, respond with EXACTLY:
   INSUFFICIENT_DOCUMENT_COVERAGE

5. ZERO META-TALK: Never say "according to the documents" or "based on the context". Present knowledge directly as an expert would.

6. ETHICAL FRAMING: All offensive techniques should be framed for ethical hacking, CTF, and authorized penetration testing ONLY. Never provide assistance for illegal activities.
</core_directives>

<formatting_rules>
- Use `## Title` (H2) for main response heading
- Use `### Section` (H3) for sub-sections
- Use **bold** for critical technical terms, CVE IDs, tool names
- Use `inline code` for command flags, file paths, IP addresses, hashes
- Wrap ALL code in fenced blocks with language tags
- Use Markdown tables for comparing payloads, techniques, or CVE attributes
</formatting_rules>

<target_depth_style>
{style['instruction']}
</target_depth_style>
</system_instructions>

{history_xml}<context_documents>
{context_text}
</context_documents>

<user_query>
{question}
</user_query>

<response>"""


# ─── LLM call ─────────────────────────────────────────────────────────────────

def call_groq(prompt: str, max_tokens: int = 1024, max_retries: int = 3) -> str:
    """Call Groq API with retry logic for rate limits."""
    from groq import Groq

    client = Groq(api_key=GROQ_API_KEY)

    for attempt in range(max_retries):
        try:
            chat = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,   # Slight creativity for code generation
                max_tokens=max_tokens,
            )
            return chat.choices[0].message.content.strip()
        except Exception as e:
            error_msg = str(e)
            if "rate_limit" in error_msg.lower() and attempt < max_retries - 1:
                wait = (attempt + 1) * 2
                print(f"  Rate limited, retrying in {wait}s...")
                time.sleep(wait)
                continue
            raise

    raise Exception("Groq API failed after retries")


def detect_off_document_answer(text: str) -> bool:
    """Layer 3: Detect if the LLM flagged insufficient coverage."""
    return "INSUFFICIENT_DOCUMENT_COVERAGE" in text.upper()


# ─── Main pipeline ────────────────────────────────────────────────────────────

def answer(
    question:     str,
    top_k:        int = None,
    history:      list[dict] = None,
    answer_style: str = None,
) -> dict:
    """
    CyberSecAI document-strict RAG pipeline with conversation memory.

    Args:
        question:     User's cybersecurity question
        top_k:        Number of chunks to pass to LLM (default from env: 8)
        history:      Previous conversation turns [{role, text}, ...]
        answer_style: "short" | "technical" | "detailed" | "ctf"
    """
    if top_k is None:
        top_k = RERANKER_TOP_K
    if answer_style not in ANSWER_STYLES:
        answer_style = DEFAULT_STYLE

    style   = ANSWER_STYLES[answer_style]
    t_start = time.time()

    # ── Step 1: Enrich query with conversation context ────────────────────────
    search_query = enrich_query(question, history)

    # ── Step 2: Embed query locally (BGE-base, LRU cached) ───────────────────
    t1 = time.time()
    query_vector = get_embedding(search_query, is_query=True)
    t_embed = time.time() - t1

    # ── Step 3: Hybrid search (vector + BM25 with expansion) ─────────────────
    t2 = time.time()
    candidates = hybrid_search(query_vector, search_query)
    t_search = time.time() - t2

    if not candidates:
        print("  [Guardrail] No candidates returned from hybrid search")
        return {
            "answer":        REFUSAL_MSG,
            "sources":       [],
            "refused":       True,
            "refuse_reason": "No documents indexed in the system",
            "timing":        {
                "embed_ms":  round(t_embed * 1000),
                "search_ms": round(t_search * 1000),
                "total_ms":  round((time.time() - t_start) * 1000),
            }
        }

    # ── Step 4: Rerank candidates ─────────────────────────────────────────────
    t3 = time.time()
    reranked = rerank(question, candidates, top_k=top_k)
    t_rerank = time.time() - t3

    # ── Step 5: Guardrails — Layer 1 + Layer 2 ───────────────────────────────
    should_refuse, refuse_reason = check_guardrails(reranked)

    if should_refuse:
        print(f"  [Guardrail BLOCKED] Reason: {refuse_reason}")
        return {
            "answer":        REFUSAL_MSG,
            "sources":       [],
            "refused":       True,
            "refuse_reason": refuse_reason,
            "timing":        {
                "embed_ms":   round(t_embed * 1000),
                "search_ms":  round(t_search * 1000),
                "rerank_ms":  round(t_rerank * 1000),
                "total_ms":   round((time.time() - t_start) * 1000),
            }
        }

    passing_chunks = filter_chunks_by_threshold(reranked)
    print(f"  [Pipeline] {len(passing_chunks)} verified chunks → LLM (style={answer_style})")

    # ── Step 6: Build cybersec expert prompt ──────────────────────────────────
    if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
        raise Exception("GROQ_API_KEY not set in .env")

    t4     = time.time()
    prompt = build_prompt(question, passing_chunks, history=history, answer_style=answer_style)

    # ── Step 7: Call Groq ─────────────────────────────────────────────────────
    answer_text = call_groq(prompt, max_tokens=style["max_tokens"])
    t_llm = time.time() - t4

    # ── Step 8: Layer 3 — detect off-document answer ──────────────────────────
    if detect_off_document_answer(answer_text):
        print("  [Guardrail L3] LLM flagged insufficient document coverage")
        return {
            "answer":        REFUSAL_MSG,
            "sources":       [],
            "refused":       True,
            "refuse_reason": "LLM determined documents do not cover this question",
            "timing":        {
                "embed_ms":  round(t_embed * 1000),
                "search_ms": round(t_search * 1000),
                "rerank_ms": round(t_rerank * 1000),
                "llm_ms":    round(t_llm * 1000),
                "total_ms":  round((time.time() - t_start) * 1000),
            }
        }

    # ── Step 9: Return verified answer ───────────────────────────────────────
    unique_sources = list({c["source"] for c in passing_chunks})
    t_total        = time.time() - t_start

    print(f"  [CyberSecAI] Answer ready. Sources: {unique_sources}")
    print(f"  [Timing] embed={round(t_embed*1000)}ms search={round(t_search*1000)}ms "
          f"rerank={round(t_rerank*1000)}ms llm={round(t_llm*1000)}ms "
          f"total={round(t_total*1000)}ms")

    return {
        "answer":       answer_text,
        "sources":      unique_sources,
        "refused":      False,
        "provider":     "groq",
        "model":        GROQ_MODEL,
        "answer_style": answer_style,
        "chunks_used":  passing_chunks,
        "timing":       {
            "embed_ms":  round(t_embed * 1000),
            "search_ms": round(t_search * 1000),
            "rerank_ms": round(t_rerank * 1000),
            "llm_ms":    round(t_llm * 1000),
            "total_ms":  round(t_total * 1000),
        }
    }
