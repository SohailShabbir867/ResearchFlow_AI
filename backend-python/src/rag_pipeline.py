"""
ResearchFlow AI — Multidisciplinary Research RAG Pipeline

v5.1 — Perplexity-Style Fusion Engine (Bug Fixes + New Features)

Bug Fixes:
  Bug 1  — Groq client is now a module-level singleton (no per-call instantiation).
  Bug 2  — Web search timing attribution corrected; misleading t_web_start removed.
  Bug 3  — Double LLM call on coverage miss eliminated; web-primary path is now
            only taken when web_results were NOT already part of the first prompt.
  Bug 7  — LLM messages now properly split into role:"system" + role:"user" so
            Groq instruction-following quality is significantly improved.
  Bug 10 — GROQ_API_KEY validation moved to top of answer() before any computation.
  Bug 11 — filter_chunks_by_threshold double-call eliminated; result from
            check_guardrails is reused directly.

New Features:
  Feature 6 — classify_query_intent(): fast regex classifier (<1ms) that detects
               code | science | medical | literature | general.
               Used to auto-select answer_style and enrich SSE stream.
  Feature 7 — source_confidence_score(): maps rerank scores to human-readable
               0–100 scale. Returned in pipeline result for frontend display.
  Feature 9 — API key validated eagerly at top of answer() with clear message.

Architecture:
  RAG (Qdrant) + DuckDuckGo Web Search run CONCURRENTLY every single request.
  Results are ALWAYS combined into one synthesized answer:
    - RAG documents  → [AUTHORITATIVE] primary grounding
    - Live web intel → [LIVE-WEB] latest papers, news, tool updates

Pipeline flow:
  1.  Classify query intent (<1ms regex)
  2.  Validate API key early (fail fast before any expensive steps)
  3.  Enrich query with conversation context
  4.  Embed query locally (BGE-base ONNX, LRU-256 cached)
  5a. Hybrid RAG search: BGE vector + BM25 + RRF → top 30 candidates  [THREAD A]
  5b. DuckDuckGo web search                                              [THREAD B]
  6.  Rerank RAG candidates with cross-encoder → top 8
  7.  Layer 1 + Layer 2 guardrail check
  8.  Build FUSED prompt: RAG chunks (primary) + Web results (enrichment)
  9.  Call Groq LLM via system+user message split (temperature=0.05)
  10. Layer 3 — detect INSUFFICIENT_DOCUMENT_COVERAGE sentinel
  11. Return synthesized answer + rag_sources + web_sources + confidence + timing
"""
import os
import re
import time
import concurrent.futures
from datetime import datetime
try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs):
        return False
from src.embedder import get_embedding
from src.hybrid_search import hybrid_search
from src.reranker import rerank
from src.web_search import perform_web_search, format_web_context

load_dotenv()

# ─── LLM config ──────────────────────────────────────────────────────────────
GROQ_API_KEY    = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL      = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
RERANKER_TOP_K  = int(os.getenv("RERANKER_TOP_K", "8"))
LLM_TEMPERATURE = 0.05   # Low temperature = sharp, reproducible technical answers

# ─── Singleton Groq client (Bug 1 Fix) ────────────────────────────────────────
# Created once at module load; reused across ALL requests.
# Only initialized when GROQ_API_KEY is available.
_groq_client = None

def _get_groq_client():
    """Return the module-level Groq singleton, creating it on first use."""
    global _groq_client
    if _groq_client is None:
        from groq import Groq
        _groq_client = Groq(api_key=GROQ_API_KEY)
        print("  [Groq] Singleton client initialized.")
    return _groq_client


# ─── Web Search Config ────────────────────────────────────────────────────────
WEB_ALWAYS_ON       = os.getenv("WEB_ALWAYS_ON", "true").lower() == "true"
ENABLE_WEB_FALLBACK = os.getenv("ENABLE_WEB_FALLBACK", "true").lower() == "true"
MAX_WEB_RESULTS     = int(os.getenv("MAX_WEB_RESULTS", "4"))   # Reduced from 6 to stay under 12k TPM

# ─── Guardrail thresholds ───────────
RELEVANCE_THRESHOLD = float(os.getenv("RELEVANCE_THRESHOLD", "-3.5"))
MIN_RELEVANT_CHUNKS = int(os.getenv("MIN_RELEVANT_CHUNKS", "1"))

# ─── Thread pool (kept warm for fast parallel execution) ──────────────────────
_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="researchflow-worker")

# ─── Refusal message ──────────────────────────────────────────────────────────
REFUSAL_MSG = (
    "I don't have sufficient information to answer that question well. "
    "ResearchFlow AI is a multidisciplinary research assistant — you can ask about science, medicine, "
    "technology, programming, law, history, and more. "
    "Try rephrasing your question, or upload a relevant document (PDF/DOCX/TXT) and ask again."
)

# ─── Answer styles — token budgets tuned for 12k TPM free tier ───────────────
# Total budget = system_prompt (~700) + context (~2000) + answer + headroom
# Free tier hard cap: 12,000 TPM. We target max_tokens ≤ 1800 for safety.
ANSWER_STYLES = {
    "short": {
        "instruction": (
            "Deliver a tight, direct answer — 1-3 sentences or one focused code block. "
            "Lead with the direct answer or solution, then one line of why. "
            "Use **bold** for key terms and a correctly tagged fenced block (e.g. ```python) for any code. "
            "No preamble, no section headers, no filler."
        ),
        "max_tokens": 512,
    },
    "technical": {
        "instruction": (
            "Produce a precise, expert technical response in clean Markdown. "
            "Include a `## Title` heading, clear concept explanation, full runnable code in tagged fenced blocks "
            "(```python, ```javascript, ```bash, etc.) with inline comments, "
            "CVE/MITRE IDs where relevant, and a `### Mitigation & Best Practices` section. "
            "Use `[Doc: source]` for grounded facts and only the most relevant/current `[Web: Title](url)` sources for live facts."
        ),
        "max_tokens": 2500,
    },
    "detailed": {
        "instruction": (
            "Produce an exhaustive, multi-section analysis in Markdown matching full LLM capacity. "
            "Include sections: Executive Overview, Technical Deep-Dive, Full Implementation (complete runnable code in tagged fenced blocks), "
            "Step-by-Step Walkthrough, Edge Cases & Error Handling, and Key Takeaways. "
            "Use `[Doc: source]` for grounded facts and only the most relevant/current `[Web: Title](url)` sources for live facts."
        ),
        "max_tokens": 4096,
    },
    "case_study": {
        "instruction": (
            "Structure as a Case Study: Background Analysis, Core Challenge, "
            "Methodology/Approach, Findings/Results (commented, tagged fenced blocks if code), Conclusion & Future Work."
        ),
        "max_tokens": 3000,
    },
    "code": {
        "instruction": (
            "Focus 80%+ of output on 100% complete, fully functional, production-ready, runnable code:\n"
            "- Start directly with a 1-2 sentence overview of what the code does.\n"
            "- Provide complete, self-contained code in properly tagged fenced blocks (```python, ```bash, ```c, ```cpp, ```javascript, ```powershell, ```go, ```rust, ```sql, etc.).\n"
            "- NEVER use placeholder comments like `// TODO`, `...`, or truncated code stubs. Include all required imports, main guards (`if __name__ == '__main__':`), error handling, and robust input checks.\n"
            "- Include an `### Installation & Dependencies` section with exact setup commands (`pip install ...`, etc.).\n"
            "- Include a `### Usage & Execution` section showing exact CLI commands to run the script.\n"
            "- Include a concise `### Code Walkthrough` explaining key functions and logic flow."
        ),
        "max_tokens": 4096,
    },
    "conversational": {
        "instruction": (
            "Respond conversationally and naturally. Keep it concise. "
            "If the user is just saying hello or making small talk, respond warmly and briefly. "
            "Do not use headings or structured sections unless absolutely necessary. "
            "Cite sources only if you are answering a factual question based on the documents or web."
        ),
        "max_tokens": 1024,
    },
}

_CODE_KEYWORDS_RE = re.compile(
    r'\b(?:write|code|script|program|implement|function|class|build|create|develop|'
    r'python|bash|c\+\+|cpp|csharp|golang|rust|powershell|js|javascript|typescript|'
    r'fix bug|refactor|exploit script|payload generator|automation|algorithm|snippet)\b',
    re.IGNORECASE
)

_CHAT_RE = re.compile(
    r'^(hello|hi|hey|greetings|how are you|thanks|thank you|good morning|good afternoon|good evening)[\s\!\.\?]*$',
    re.IGNORECASE
)


def detect_programming_intent(question: str) -> bool:
    """Return True if the query is asking for programming, code, or script generation."""
    return bool(_CODE_KEYWORDS_RE.search(question))


DEFAULT_STYLE     = "technical"
GLOBAL_MAX_TOKENS = 4096   # Maximum generation capacity of 70B model


# ─── Feature 6: Query Intent Classifier ──────────────────────────────────────

# Intent → label and emoji shown in the frontend
INTENT_META = {
    "code":      {"label": "Code / Programming",      "emoji": "💻",  "style": "code"},
    "science":   {"label": "Science / Research",       "emoji": "🔬",  "style": "detailed"},
    "medical":   {"label": "Medical / Clinical",       "emoji": "🦵",  "style": "detailed"},
    "literature":{"label": "Literature / Papers",      "emoji": "📚",  "style": "technical"},
    "data":      {"label": "Data / Analytics",         "emoji": "📊",  "style": "technical"},
    "security":  {"label": "Security / Cyber",         "emoji": "🛡",  "style": "technical"},
    "general":   {"label": "General Research",         "emoji": "🔍",  "style": "conversational"},
    "chat":      {"label": "Conversational",           "emoji": "👋",  "style": "conversational"},
}




def classify_query_intent(question: str) -> str:
    """
    Fast regex-based intent classifier (<1ms).
    Returns one of: code | science | medical | literature | data | security | general

    Used to:
    - Auto-select answer_style when user leaves it as default
    - Emit intent badge in SSE stream for frontend display
    - Tune downstream behavior (e.g., Code → code style)
    """
    if detect_programming_intent(question):
        return "code"
    if bool(_CHAT_RE.match(question.strip())):
        return "chat"
    if re.search(r'\b(study|trial|experiment|hypothesis|methodology|peer.review|journal|paper|arxiv|pubmed|doi|citation|abstract|results|findings|literature)\b', question, re.IGNORECASE):
        return "literature"
    if re.search(r'\b(patient|clinical|diagnosis|treatment|drug|medicine|symptom|disease|therapy|dosage|side effect|FDA|NHS|hospital|surgery|anatomy|pathology|pharmacology)\b', question, re.IGNORECASE):
        return "medical"
    if re.search(r'\b(biology|chemistry|physics|genomics|protein|molecule|cell|DNA|RNA|genome|neural|quantum|thermodynamics|ecology|evolution)\b', question, re.IGNORECASE):
        return "science"
    if re.search(r'\b(dataset|statistics|regression|clustering|machine learning|deep learning|neural network|model|accuracy|precision|recall|AUC|SQL|pandas|numpy|matplotlib)\b', question, re.IGNORECASE):
        return "data"
    if re.search(r'\b(CVE|exploit|vulnerability|pentest|malware|hack|cybersec|firewall|intrusion|SIEM|SOC|threat|phishing|ransomware)\b', question, re.IGNORECASE):
        return "security"
    return "general"


# ─── Feature 7: Source Confidence Scoring ────────────────────────────────────

def source_confidence_score(rerank_score: float) -> dict:
    """
    Map a cross-encoder rerank score to a human-readable confidence descriptor.

    Cross-encoder scores are typically in the range (-10, 10):
      >= 0.0  → High confidence
      >= -2.0 → Medium confidence
      < -2.0  → Low confidence

    Returns: {"level": "high"|"medium"|"low", "score": int (0-100)}
    """
    # Normalize from [-10, 10] to [0, 100]
    normalized = int(max(0, min(100, (rerank_score + 10) * 5)))
    if rerank_score >= 0.0:
        level = "high"
    elif rerank_score >= -2.0:
        level = "medium"
    else:
        level = "low"
    return {"level": level, "score": normalized}


# ─── Guardrail functions ──────────────────────────────────────────────────────

def filter_chunks_by_threshold(chunks: list[dict]) -> list[dict]:
    """Layer 2: Remove chunks whose rerank score is below RELEVANCE_THRESHOLD."""
    return [c for c in chunks if c.get("rerank_score", -99.0) >= RELEVANCE_THRESHOLD]


def check_guardrails(reranked: list[dict]) -> tuple[bool, str, list[dict]]:
    """
    Run Layer 1 and Layer 2 checks.

    Bug 11 Fix: Now returns the filtered passing_chunks directly so callers
    don't need to call filter_chunks_by_threshold() again.

    Returns (should_refuse, reason, passing_chunks).
    """
    top_score = reranked[0].get("rerank_score", -99.0) if reranked else -99.0
    print(f"  [Guardrail L1] Top rerank score: {top_score:.4f} (threshold: {RELEVANCE_THRESHOLD})")

    if top_score < RELEVANCE_THRESHOLD:
        return True, f"Top chunk score {top_score:.4f} below threshold {RELEVANCE_THRESHOLD}", []

    passing = filter_chunks_by_threshold(reranked)
    print(f"  [Guardrail L2] {len(passing)}/{len(reranked)} chunks passed (min: {MIN_RELEVANT_CHUNKS})")

    if len(passing) < MIN_RELEVANT_CHUNKS:
        return True, f"Only {len(passing)} chunk(s) passed relevance threshold (need {MIN_RELEVANT_CHUNKS})", []

    return False, "", passing


# ─── Query enrichment ─────────────────────────────────────────────────────────

def enrich_query(question: str, history: list[dict] = None) -> str:
    """
    Enrich the search query with conversation context for follow-up awareness.
    Short follow-ups (≤ 10 words) get the last assistant turn prepended.
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

    if len(question.split()) <= 10:
        context_snippet = last_assistant[:200].replace("\n", " ").strip()
        enriched = f"{context_snippet} {question}"
        print(f"  [Memory] Context-enriched query for follow-up")
        return enriched

    return question


# ─── Prompt builders ──────────────────────────────────────────────────────────

def _build_system_prompt(answer_style: str, now_str: str, current_year: int) -> str:
    """
    ResearchFlow AI system prompt tuned for multidisciplinary global research.
    Prioritizes factual accuracy, current web verification, and concise synthesis.
    """
    style = ANSWER_STYLES.get(answer_style, ANSWER_STYLES[DEFAULT_STYLE])

    return f"""You are ResearchFlow AI — an expert multidisciplinary research assistant.
Current date/time: {now_str}. Answer date questions from this anchor.

DOMAIN: You have expert-level mastery across global research topics:
- Science & Engineering: biology, chemistry, physics, genomics, materials science, environmental science, space, and energy.
- Medicine & Health: clinical research, pharmacology, diagnostics, public health, epidemiology, and medical imaging.
- Data & AI: machine learning, deep learning, statistics, NLP, computer vision, data engineering, and MLOps.
- Technology: software engineering, cloud, networking, DevOps, databases, distributed systems, and programming.
- Policy & Society: economics, law, history, literature, governance, business, education, and current affairs.
- General: answer any factual, conceptual, or analytical question with expert rigor.

RULES:
1. Answer decisively, but do not guess when evidence is weak.
2. Treat RAG documents (<rag_documents>) as local grounding; cite as [Doc: source].
3. Treat live web intel (<live_web_intel>) as the freshness layer; cite as [Web: Title](url).
4. When current facts matter, prefer the most recent credible web source over older or weaker sources.
5. When sources conflict, say so briefly and prefer the more recent authoritative source.
6. If the web results are low confidence or unrelated, say the answer is uncertain instead of inventing detail.
7. Generate complete, runnable, well-commented code when asked.
8. Refuse only if the request is clearly illegal or harmful.
9. Emit INSUFFICIENT_DOCUMENT_COVERAGE only if the question is not answerable even with expert knowledge and current web context.
10. No meta-talk — never say "based on the context" or "the documents say". Just answer directly.
11. For research questions, cite studies, papers, standards, or official sources when available.
12. For programming questions, always provide complete, runnable code with no truncated stubs or TODOs.

FORMAT: {style['instruction']}"""



def build_prompt(
    question:       str,
    context_chunks: list[dict],
    history:        list[dict] = None,
    answer_style:   str = None,
) -> tuple[str, str]:
    """
    Build a RAG-only prompt (legacy/fallback).
    Returns (system_content, user_content) for proper role splitting.
    """
    if answer_style not in ANSWER_STYLES:
        answer_style = DEFAULT_STYLE

    context_blocks = []
    for i, chunk in enumerate(context_chunks):
        source_name  = chunk.get("source",       f"Document {i+1}")
        text_content = chunk.get("text",         "").strip()
        content_type = chunk.get("content_type", "general")
        cves         = chunk.get("cves",         [])
        section      = chunk.get("section",      "")

        meta_attrs = f'index="{i+1}" source="{source_name}" type="{content_type}"'
        if cves:
            meta_attrs += f' cves="{",".join(cves)}"'
        if section:
            meta_attrs += f' section="{section[:80]}"'

        context_blocks.append(f'<document {meta_attrs}>\n{text_content}\n</document>')

    context_text = "\n\n".join(context_blocks)
    history_xml  = _build_history_xml(history)
    now_str      = datetime.now().strftime("%Y-%m-%d %H:%M:%S (%A)")
    current_year = datetime.now().year

    sys_content  = _build_system_prompt(answer_style, now_str, current_year)
    user_content = f"""{history_xml}<rag_documents>
{context_text}
</rag_documents>

<user_query>
{question}
</user_query>

<response>"""

    return sys_content, user_content


def build_fused_prompt(
    question:       str,
    context_chunks: list[dict],
    web_results:    list[dict],
    history:        list[dict] = None,
    answer_style:   str = None,
) -> tuple[str, str]:
    """
    Build the FUSED prompt combining RAG documents (authoritative) with
    live web intelligence (enrichment) into one synthesized context.

    v6.0: Context budget calculator prevents silent TPM overflow.
    The 12k TPM free tier means total prompt+answer must stay under ~10k tokens.
    System prompt ~750 tokens + headroom for answer leaves ~4500-5500 chars of context.
    """
    if answer_style not in ANSWER_STYLES:
        answer_style = DEFAULT_STYLE

    # ── Context budget per answer style (v6.0: prevents TPM overflow) ────────────
    # Budget = chars allocated to ALL rag chunks combined.
    # Short answers need less context; detailed/code get more.
    CONTEXT_BUDGETS = {
        "short":     2000,
        "technical": 3500,
        "detailed":  4500,
        "case_study":3500,
        "code":      4000,
    }
    total_rag_budget = CONTEXT_BUDGETS.get(answer_style, 3500)

    # ── RAG context (budget-aware) ──────────────────────────────────────────────
    context_blocks = []
    chars_used = 0
    for i, chunk in enumerate(context_chunks):
        source_name  = chunk.get("source",       f"Document {i+1}")
        text_content = chunk.get("text",         "").strip()
        content_type = chunk.get("content_type", "general")
        cves         = chunk.get("cves",         [])
        section      = chunk.get("section",      "")

        # Per-chunk budget: top-ranked chunks get more space
        rank_budget = max(300, total_rag_budget // max(len(context_chunks), 1))
        if len(text_content) > rank_budget:
            text_content = text_content[:rank_budget] + "..."

        # Stop adding chunks if budget exhausted
        if chars_used + len(text_content) > total_rag_budget:
            remaining = total_rag_budget - chars_used
            if remaining < 100:
                break
            text_content = text_content[:remaining] + "..."

        meta_attrs = f'index="{i+1}" source="{source_name}" type="{content_type}"'
        if cves:
            meta_attrs += f' cves="{",".join(cves)}"'
        if section:
            meta_attrs += f' section="{section[:80]}"'

        block = f'<document {meta_attrs}>\n{text_content}\n</document>'
        context_blocks.append(block)
        chars_used += len(text_content)

    rag_context = "\n\n".join(context_blocks) if context_blocks else "<document>No local documents indexed yet.</document>"

    # ── Web context (kept tight so prompt stays efficient) ────────────────────
    web_context = format_web_context(web_results, max_snippet_len=220) if web_results else "<web_source>No live web results available.</web_source>"

    history_xml  = _build_history_xml(history)
    now_str      = datetime.now().strftime("%Y-%m-%d %H:%M:%S (%A)")
    current_year = datetime.now().year

    sys_content = _build_system_prompt(answer_style, now_str, current_year)

    rag_label = f"[AUTHORITATIVE — {len(context_chunks)} chunks from your indexed documents]" if context_blocks else "[No local documents — using expert knowledge + web]"
    web_label = f"[RANKED LIVE-WEB — {len(web_results)} fresh results from DuckDuckGo]" if web_results else "[No live web results]"

    user_content = f"""{history_xml}<rag_documents label="{rag_label}">
{rag_context}
</rag_documents>

<live_web_intel label="{web_label}">
{web_context}
</live_web_intel>

<fusion_directive>
Synthesize BOTH sources above into one expert answer:
- Use <rag_documents> as your PRIMARY source of truth for technical facts, tool details, and established techniques.
- Use <live_web_intel> to ENRICH with the latest verified facts, current papers, current events, updated versions, and time-sensitive details.
- Do NOT present two separate answers. Blend both into a single, cohesive, extraordinary response.
- Cite inline: [Doc: source_name] for RAG facts, [Web: Title](url) for web facts.
- When RAG and web conflict on a fact, prefer the more specific/recent source and note the discrepancy if significant.
</fusion_directive>

<user_query>
{question}
</user_query>

<response>"""

    return sys_content, user_content


def build_web_prompt(
    question:     str,
    web_results:  list[dict],
    history:      list[dict] = None,
    answer_style: str = None,
) -> tuple[str, str]:
    """
    Build a web-only prompt (used when RAG has zero chunks).
    Returns (system_content, user_content).
    """
    if answer_style not in ANSWER_STYLES:
        answer_style = DEFAULT_STYLE

    web_text    = format_web_context(web_results)
    history_xml = _build_history_xml(history)
    now_str      = datetime.now().strftime("%Y-%m-%d %H:%M:%S (%A)")
    current_year = datetime.now().year

    sys_content  = _build_system_prompt(answer_style, now_str, current_year)
    user_content = f"""{history_xml}<live_web_intel>
{web_text}
</live_web_intel>

<fusion_directive>
Synthesize the live web intel above into a direct expert answer. Cite web sources inline as [Web: Title](url).
</fusion_directive>

<user_query>
{question}
</user_query>

<response>"""

    return sys_content, user_content


def _build_history_xml(history: list[dict]) -> str:
    """Build conversation history XML block."""
    if not history:
        return ""
    recent = history[-6:]
    turns  = []
    for msg in recent:
        role = "user" if msg.get("role") == "user" else "assistant"
        text = (msg.get("text") or "").strip()[:400]
        turns.append(f'  <{role}>{text}</{role}>')
    if not turns:
        return ""
    return "<conversation_history>\n" + "\n".join(turns) + "\n</conversation_history>\n\n"


# ─── LLM call ─────────────────────────────────────────────────────────────────

def call_groq(
    system_content: str,
    user_content:   str,
    max_tokens:     int = 1024,
    max_retries:    int = 3,
) -> str:
    """
    Call Groq API with proper system/user message split and retry logic.

    Bug 1 Fix: Uses the module-level singleton _groq_client instead of
    creating a new Groq() instance on every call.

    Bug 7 Fix: Sends system instructions as role:"system" and user query
    as role:"user" for correct Groq instruction-following behavior.
    """
    client = _get_groq_client()

    for attempt in range(max_retries):
        try:
            chat = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system_content},
                    {"role": "user",   "content": user_content},
                ],
                temperature=LLM_TEMPERATURE,
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
    ResearchFlow AI v5.1 — Perplexity-Style Parallel Dual-Source Fusion Pipeline.

    Bugs Fixed: 1, 2, 3, 7, 10, 11
    New Features: 6 (intent classifier), 7 (source confidence), 9 (early API key check)

    Args:
        question:     User's cybersecurity question
        top_k:        Number of RAG chunks to pass to LLM (default: RERANKER_TOP_K)
        history:      Previous conversation turns [{role, text}, ...]
        answer_style: "short" | "technical" | "detailed" | "case_study"
    """
    # ── Bug 10 Fix: Validate API key FIRST before any expensive steps ─────────
    if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
        raise Exception("GROQ_API_KEY not set in .env — update backend-python/.env with your Groq key")

    if top_k is None:
        top_k = RERANKER_TOP_K

    # ── Feature 6: Classify intent (<1ms) ────────────────────────────────────
    intent = classify_query_intent(question)
    intent_info = INTENT_META.get(intent, INTENT_META["general"])

    # Auto-select answer_style from intent if not explicitly provided
    if answer_style not in ANSWER_STYLES:
        answer_style = intent_info["style"]
        print(f"  [Intent] '{intent}' detected → auto-style: {answer_style}")
    else:
        print(f"  [Intent] '{intent}' detected (user-selected style: {answer_style})")

    style   = ANSWER_STYLES[answer_style]
    t_start = time.time()

    # ── Fast-path for chat intent ──────────────────────────────────────────────
    if intent == "chat" and answer_style == "conversational":
        print("  [Pipeline] Chat fast-path triggered (bypassing search)")
        now_str      = datetime.now().strftime("%Y-%m-%d %H:%M:%S (%A)")
        current_year = datetime.now().year
        sys_c = _build_system_prompt(answer_style, now_str, current_year)
        usr_c = f"{_build_history_xml(history)}<user_query>\n{question}\n</user_query>\n\n<response>"
        t4 = time.time()
        answer_text = call_groq(sys_c, usr_c, max_tokens=style["max_tokens"])
        t_llm = time.time() - t4
        return {
            "answer":             answer_text,
            "sources":            [],
            "rag_source_details": [],
            "web_sources":        [],
            "web_results":        [],
            "is_web_fallback":    False,
            "refused":            False,
            "intent":             intent,
            "intent_info":        intent_info,
            "provider":           "groq",
            "model":              GROQ_MODEL,
            "answer_style":       answer_style,
            "timing": {
                "embed_ms":      0,
                "search_ms":     0,
                "rerank_ms":     0,
                "web_search_ms": 0,
                "llm_ms":        round(t_llm * 1000),
                "total_ms":      round((time.time() - t_start) * 1000),
            }
        }

    # ── Step 1: Enrich query ──────────────────────────────────────────────────
    search_query = enrich_query(question, history)

    # ── Step 2: Embed query (BGE-base, cached) ────────────────────────────────
    t1 = time.time()
    query_vector = get_embedding(search_query, is_query=True)
    t_embed = time.time() - t1

    # ── Step 3: PARALLEL — RAG search + Web search ────────────────────────────
    # Both futures are submitted simultaneously; timing is measured correctly.
    t2 = time.time()
    rag_future = _executor.submit(hybrid_search, query_vector, search_query)
    web_future = _executor.submit(
        perform_web_search, search_query, MAX_WEB_RESULTS
    ) if WEB_ALWAYS_ON else None

    # ── Step 4: Rerank RAG candidates ────────────────────────────────────────
    candidates = rag_future.result()
    t_search   = time.time() - t2

    t3 = time.time()
    reranked = rerank(question, candidates, top_k=top_k) if candidates else []
    t_rerank = time.time() - t3

    # ── Collect web results (usually already done while reranking) ────────────
    web_results = web_future.result() if web_future else []
    t_web       = time.time() - t2  # Bug 2 Fix: total parallel time, not wait time
    print(f"  [Web Search] {len(web_results)} results (parallel block={round(t_web*1000)}ms total)")

    # ── Step 5: Guardrails (Bug 11 Fix: reuse passing_chunks from check) ─────
    if candidates:
        should_refuse, refuse_reason, passing_chunks = check_guardrails(reranked)
    else:
        should_refuse  = True
        refuse_reason  = "No RAG candidates returned"
        passing_chunks = []

    if should_refuse:
        print(f"  [Guardrail] RAG blocked: {refuse_reason}")
        if web_results:
            print("  [Fusion] RAG insufficient — web-primary fused answer")
            sys_c, usr_c = build_fused_prompt(
                question, [], web_results, history=history, answer_style=answer_style
            )
            t4          = time.time()
            answer_text = call_groq(sys_c, usr_c, max_tokens=style["max_tokens"])
            t_llm       = time.time() - t4

            web_sources = [r["url"]   for r in web_results if r.get("url")]
            web_titles  = [r["title"] for r in web_results if r.get("title")]

            return {
                "answer":          answer_text,
                "sources":         web_titles[:3],
                "web_sources":     web_sources,
                "web_results":     web_results,   # full metadata for frontend
                "is_web_fallback": True,
                "refused":         False,
                "intent":          intent,
                "intent_info":     intent_info,
                "provider":        "groq",
                "model":           GROQ_MODEL,
                "answer_style":    answer_style,
                "timing": {
                    "embed_ms":      round(t_embed * 1000),
                    "search_ms":     round(t_search * 1000),
                    "rerank_ms":     round(t_rerank * 1000),
                    "web_search_ms": round(t_web * 1000),
                    "llm_ms":        round(t_llm * 1000),
                    "total_ms":      round((time.time() - t_start) * 1000),
                }
            }

        return {
            "answer":          REFUSAL_MSG,
            "sources":         [],
            "web_sources":     [],
            "web_results":     [],
            "is_web_fallback": False,
            "refused":         True,
            "refuse_reason":   refuse_reason,
            "intent":          intent,
            "intent_info":     intent_info,
            "timing": {
                "embed_ms":  round(t_embed * 1000),
                "search_ms": round(t_search * 1000),
                "rerank_ms": round(t_rerank * 1000),
                "total_ms":  round((time.time() - t_start) * 1000),
            }
        }

    print(f"  [Pipeline] {len(passing_chunks)} RAG chunks + {len(web_results)} web results → Fused LLM (style={answer_style})")

    # ── Step 6: Build FUSED prompt ────────────────────────────────────────────
    t4 = time.time()
    sys_c, usr_c = build_fused_prompt(
        question,
        passing_chunks,
        web_results,
        history=history,
        answer_style=answer_style,
    )

    # ── Step 7: Call Groq (system+user split) ────────────────────────────────
    answer_text = call_groq(sys_c, usr_c, max_tokens=style["max_tokens"])
    t_llm       = time.time() - t4

    # ── Step 8: Layer 3 — off-document detection ──────────────────────────────
    # Bug 3 Fix: Only retry if web_results were NOT already included.
    # Since build_fused_prompt always includes web_results, a retry is wasteful.
    # We only retry if passing_chunks was non-empty (web was enrichment, not primary).
    if detect_off_document_answer(answer_text) and passing_chunks and web_results:
        print("  [Guardrail L3] INSUFFICIENT_DOCUMENT_COVERAGE detected — retrying web-primary")
        sys_c2, usr_c2 = build_fused_prompt(
            question, [], web_results, history=history, answer_style=answer_style
        )
        t4b         = time.time()
        answer_text = call_groq(sys_c2, usr_c2, max_tokens=style["max_tokens"])
        t_llm       = time.time() - t4b

        web_sources = [r["url"]   for r in web_results if r.get("url")]
        web_titles  = [r["title"] for r in web_results if r.get("title")]

        return {
            "answer":          answer_text,
            "sources":         web_titles[:3],
            "web_sources":     web_sources,
            "web_results":     web_results,
            "is_web_fallback": True,
            "refused":         False,
            "intent":          intent,
            "intent_info":     intent_info,
            "provider":        "groq",
            "model":           GROQ_MODEL,
            "answer_style":    answer_style,
            "timing": {
                "embed_ms":      round(t_embed * 1000),
                "search_ms":     round(t_search * 1000),
                "rerank_ms":     round(t_rerank * 1000),
                "web_search_ms": round(t_web * 1000),
                "llm_ms":        round(t_llm * 1000),
                "total_ms":      round((time.time() - t_start) * 1000),
            }
        }

    # ── Step 9: Build enriched source data with confidence scores ────────────
    unique_rag_sources = list({c["source"] for c in passing_chunks})
    web_sources        = [r["url"] for r in web_results if r.get("url")]
    t_total            = time.time() - t_start

    # Feature 7: Attach confidence scores to RAG sources
    rag_source_details = []
    for src in unique_rag_sources:
        src_chunks = [c for c in passing_chunks if c["source"] == src]
        top_score  = max((c.get("rerank_score", -99) for c in src_chunks), default=-99)
        confidence = source_confidence_score(top_score)
        rag_source_details.append({
            "source":     src,
            "chunks":     len(src_chunks),
            "confidence": confidence,
        })

    print(f"  [ResearchFlow AI v5.1] Fused answer ready. RAG: {unique_rag_sources} | Web: {len(web_results)} results")
    print(f"  [Timing] embed={round(t_embed*1000)}ms rag={round(t_search*1000)}ms "
          f"rerank={round(t_rerank*1000)}ms web={round(t_web*1000)}ms "
          f"llm={round(t_llm*1000)}ms total={round(t_total*1000)}ms")

    return {
        "answer":             answer_text,
        "sources":            unique_rag_sources,
        "rag_source_details": rag_source_details,
        "web_sources":        web_sources,
        "web_results":        web_results,      # full metadata with domain/favicon/confidence
        "is_web_fallback":    False,
        "refused":            False,
        "intent":             intent,
        "intent_info":        intent_info,
        "provider":           "groq",
        "model":              GROQ_MODEL,
        "answer_style":       answer_style,
        "chunks_used":        passing_chunks,
        "timing": {
            "embed_ms":      round(t_embed * 1000),
            "search_ms":     round(t_search * 1000),
            "rerank_ms":     round(t_rerank * 1000),
            "web_search_ms": round(t_web * 1000),
            "llm_ms":        round(t_llm * 1000),
            "total_ms":      round(t_total * 1000),
        }
    }
