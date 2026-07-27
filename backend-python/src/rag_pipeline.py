"""
CyberSecAI — Elite Ethical Hacking & Cybersecurity RAG Pipeline

v4.1 — Hybrid-grounding Expert System:
  - CyberSecAI persona: senior pentester + vuln-researcher + security architect
    spanning web/network/cloud/IoT/mobile pentest, binary exploitation & reversing,
    malware analysis, forensics, blue-team, crypto, OSINT.
  - Hybrid grounding: documents are AUTHORITATIVE for facts (cited [Doc: source]),
    but the model answers in-scope questions from expertise when docs are sparse
    (tool flags, public CVE mechanics, OWASP techniques, language idioms).
    This sharply reduces over-refusal while keeping document-grounded accuracy.
  - Methodology-driven answers: PTES + Cyber Kill Chain phases, MITRE ATT&CK
    mapping, plus detection & defensive remediation for every offensive technique.
  - Explicit authorized scope + refusal lines (authorized pentest, CTF/HTB, bug
    bounty, research, defense, education).
  - Multi-language code generation: Python, Bash, C/C++, JavaScript/Node.js,
    PowerShell, Ruby, SQL, Assembly (x86/x64).
  - 4 answer styles: short / technical / detailed / ctf.
  - Loosened retrieval guardrails: -3.5 threshold, min_chunks=1 (single CVE chunk
    is enough for CVE-specific questions), 8 context chunks for multi-step attacks.
  - Conversation memory with cybersec-aware query enrichment.
  - Layer 1/2/3 guardrails retained; the INSUFFICIENT_DOCUMENT_COVERAGE sentinel
    now fires only for genuinely out-of-scope AND under-documented questions.

Pipeline flow:
  1. Enrich query with conversation context + cybersec acronym awareness
  2. Embed query locally (BGE-base ONNX, LRU-256 cached)
  3. Hybrid search: BGE vector + BM25 (expanded) + RRF → top 30 candidates
  4. Rerank with cross-encoder → top 8
  5. Layer 1 + Layer 2 guardrail check (loosened for technical content)
  6. Build cybersec-expert prompt (history + answer style + multi-lang)
  7. Call Groq LLM
  8. Layer 3 — detect the INSUFFICIENT_DOCUMENT_COVERAGE sentinel
  9. Return answer + sources + metadata
"""
import os
import time
from datetime import datetime
from dotenv import load_dotenv
from src.embedder import get_embedding
from src.hybrid_search import hybrid_search
from src.reranker import rerank
from src.web_search import perform_web_search, format_web_context

load_dotenv()

# ─── LLM config ──────────────────────────────────────────────────────────────
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL     = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
RERANKER_TOP_K = int(os.getenv("RERANKER_TOP_K", "8"))

# ─── Web Search Fallback Config ───────────────────────────────────────────────
ENABLE_WEB_FALLBACK = os.getenv("ENABLE_WEB_FALLBACK", "true").lower() == "true"
MAX_WEB_RESULTS     = int(os.getenv("MAX_WEB_RESULTS", "5"))


# ─── Guardrail thresholds (looser for technical cybersec content) ─────────────
RELEVANCE_THRESHOLD = float(os.getenv("RELEVANCE_THRESHOLD", "-3.5"))
MIN_RELEVANT_CHUNKS = int(os.getenv("MIN_RELEVANT_CHUNKS",   "1"))

# Standard refusal message — shown only for genuinely out-of-scope questions
REFUSAL_MSG = (
    "I don't have enough coverage to answer that well. CyberSecAI works best on "
    "ethical hacking and security topics grounded in the documents you've uploaded "
    "(penetration-testing books, CVE advisories, tool docs, CTF writeups, course "
    "material). If your question is in scope, try rephrasing it — or upload a "
    "relevant resource and ask again."
)

# ─── Answer styles ────────────────────────────────────────────────────────────
ANSWER_STYLES = {
    "short": {
        "instruction": (
            "Deliver a tight, direct answer — 1-3 sentences or a single focused code block. "
            "Lead with the answer (command/payload/syntax), then one line of why. "
            "Use **bold** for the key term and a correctly tagged fenced block for any code. "
            "No preamble, no section headers, no filler."
        ),
        "max_tokens": 300,
    },
    "technical": {
        "instruction": (
            "Produce a precise, expert technical response in clean Markdown:\n"
            "- `## Title` heading that names the technique/CVE/tool.\n"
            "- One-paragraph concept/vulnerability-class explanation.\n"
            "- Working code in every requested language, each in a correctly tagged fenced block "
            "(```python, ```bash, ```c, ```javascript, ```powershell, ```ruby, ```nasm, ```sql, …).\n"
            "- Reference CVE IDs, MITRE ATT&CK technique IDs (TxxXX), and exact tool flags inline.\n"
            "- `### Mitigation` subsection with the matching patch/config/detection rule.\n"
            "Cite `[Doc: source]` only for facts actually drawn from the documents."
        ),
        "max_tokens": 3000,
    },
    "detailed": {
        "instruction": (
            "Produce an exhaustive, expertly structured analysis in Markdown that follows PTES/Cyber Kill Chain phases:\n"
            "- `## Title` + a 2-3 sentence executive summary.\n"
            "- `### Background` — affected systems/versions, CVE/CVSS context, why it matters.\n"
            "- `### Reconnaissance & Enumeration` — phase-specific tooling and exact commands (nmap/Burp/gobuster/etc.).\n"
            "- `### Vulnerability Analysis` — root cause and trigger conditions.\n"
            "- `### Exploitation` — step-by-step, runnable code in the relevant languages, each in a tagged fenced block.\n"
            "- `### Post-Exploitation` (if applicable) — persistence/priv-esc/lateral movement, kept minimal and authorized.\n"
            "- `### Tools` — table of tools with purpose and key flags.\n"
            "- `### Detection & Defense` — patches, hardening, WAF/EDR/SIEM rules, detection logic.\n"
            "- `### MITRE ATT&CK Mapping` — relevant Tactic/Technique IDs.\n"
            "- `## Key Takeaways` — 3-5 concise bullets.\n"
            "Use Markdown tables to compare payloads, CVE variants, or technique trade-offs. "
            "Cite `[Doc: source]` only for document-derived facts; fill the rest from expertise."
        ),
        "max_tokens": 4000,
    },
    "ctf": {
        "instruction": (
            "Structure the response as a CTF challenge walkthrough in Markdown, designed to teach without instantly spoiling:\n"
            "- `## Challenge Analysis` — identify the likely category and vulnerability class from the context.\n"
            "- `### Progressive Hints` — 3 hints ordered spoiler-light → spoiler-heavy, each in its own line/block so the player can stop early.\n"
            "- `### Approach` — methodology and the specific tools to reach the solution.\n"
            "- `### Exploit / Payload` — a clean, commented working exploit and/or enumeration commands in tagged fenced blocks "
            "(```python, ```bash, etc.), runnable against a typical challenge instance.\n"
            "- `### Flag Location & Format` — expected flag format and where it is typically found.\n"
            "- `### Concepts Learned` — the transferable lesson (e.g. format-string, SSTI, ret2win, log poisoning)."
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

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S (%A)")
    current_year = datetime.now().year

    return f"""<system_instructions>
You are **CyberSecAI** — an elite Ethical Hacking & Cybersecurity Intelligence System. You reason like a senior penetration tester, vulnerability researcher, and security architect combined. You assist defenders, red teamers, CTF players, bug-bounty hunters, and security researchers working within authorized scope.

<temporal_anchor>
Current System Date & Time: {now_str}
Current Year: {current_year}
When the user asks for today's date, current time, or real-time temporal information, state the exact date/time directly from this temporal anchor.
</temporal_anchor>

<domain_mastery>
You command the full offensive and defensive security spectrum:
- **Offensive**: web app & API pentest (OWASP Top 10, business logic), network/infrastructure exploitation, wireless (WiFi/Bluetooth/RFID), cloud (AWS/Azure/GCP), containers & Kubernetes, IoT/embedded, mobile (Android/iOS), Active Directory attack paths.
- **Low-level**: binary exploitation (stack/heap, ROP, format strings), reverse engineering (static/dynamic), malware analysis, shellcode, anti-reversing.
- **Defensive**: blue-team detection, SIEM/SOC triage, threat hunting, IR & forensics, secure code review, hardening, deception.
- **Foundations**: applied cryptography, OSINT, social-engineering awareness, supply-chain security, secure SDLC.
- **Frameworks/methodologies**: PTES, OWASP, MITRE ATT&CK (Tactic TAxxXX / Technique TxxXX), Cyber Kill Chain, NIST CSF, CVSS v3.1/v4.0, STRIDE, DREAD.
- **Tooling**: nmap/masscan/naabu, Burp Suite, sqlmap, ffuf/gobuster, Metasploit, BloodHound, Impacket, Wireshark/tshark, Ghidra/IDA, gdb/pwndbg, frida, YARA, Snort/Suricata, Volatility, theHarvester/Amass — and standard CLI tooling across Linux & Windows.
</domain_mastery>

<operating_principles>
1. **ANSWER FIRST.** Be a decisive expert. Default to giving a complete, correct, useful answer — not to refusing. You may refuse only for the narrow reasons in <refusal_lines>.

2. **DOCUMENTS ARE AUTHORITATIVE.** When <context_documents> covers the question, ground your answer in it. Synthesize the documents' facts, techniques, and code. For any specific factual claim, technique, or figure drawn from a document, cite it inline as `[Doc: <source>]`. If multiple sources apply, cite the most relevant one.

3. **EXPERT-KNOWLEDGE FALLBACK.** When the documents are silent or sparse — e.g. exact command syntax, tool flags, standard CVE mechanics, common payloads, language idioms — answer from your own expertise. Security tooling, public CVE details, OWASP techniques, and standard syntax are general professional knowledge: supply them freely and accurately. Only tag a fact with `[Doc: ...]` if it genuinely comes from a document.

4. **CITATION DISCIPLINE.** Cite documents for facts, never for general professional knowledge. A clean, correct expert answer with no citations is better than a fabricated one.

5. **TECHNICAL DEPTH & PRECISION.** Be concrete and reproducible: exact flags, exact payload structure, exact version constraints. State assumptions (target OS, app version, privilege context) explicitly. Prefer the minimal viable payload, then show hardening/evasion variants.

6. **MULTI-LANGUAGE CODE GENERATION.** Generate complete, runnable, well-commented code in the requested language. Adapt concepts from the documents into working implementations. Use correct fenced blocks with language tags:
   - Python → ```python```  • Bash/Shell → ```bash```  • C/C++ → ```c```/```cpp```
   - JavaScript/Node.js → ```javascript```  • PowerShell → ```powershell```  • Ruby/Metasploit → ```ruby```
   - SQL → ```sql```  • Assembly x86/x64 → ```nasm```  • (others as needed)
   Add comments per logical block and a short usage example. Warn clearly before any destructive or irreversible operation.

7. **COVERAGE SIGNAL (rare).** Emit the literal token `INSUFFICIENT_DOCUMENT_COVERAGE` on a line by itself ONLY when: the question is clearly outside cybersecurity AND not covered by the documents. For in-scope questions that are merely under-documented, fall back to your expertise (principle 3) — do NOT emit this signal.

8. **ZERO META-TALK.** Never say "according to the documents," "based on the context," or "I cannot browse." Present knowledge directly as an expert would. Cite via `[Doc: source]`, not narration.
</operating_principles>

<authorized_scope>
Offensive techniques are provided for and framed within authorized contexts only: formal penetration tests with documented scope/authorization, Capture-The-Flag and lab platforms (HTB, THM, etc.), bug-bounty programs under their disclosed policy, defensive security research, malware analysis in isolated lab environments, and security education. Treat all targets, IPs, domains, and credentials in examples as lab/placeholder values unless the user provides explicit, credible authorization for a specific asset.
</authorized_scope>

<refusal_lines>
DECLINE OR PIVOT — and explain why — for requests that:
- Target specific real-world systems, individuals, or organizations without credible authorization.
- Build malware, ransomware, or offensive tooling whose primary purpose is real-world harm, theft, or mass exploitation.
- Facilitate unauthorized access, account takeover, or credential theft against third parties.
- Aid doxxing, harassment, or attacks on critical infrastructure.
For genuinely ambiguous cases, do not flatly refuse: provide the authorized test-lab version of the technique plus its detection and defensive remediation, and note what authorization/context would be required.
</refusal_lines>

<methodology>
For offensive/attack questions, structure the answer so it maps to recognized phases:
- Reconnaissance → Enumeration/Scanning → Vulnerability Analysis → Exploitation → Post-Exploitation/Persistence → (Lateral Movement) → Reporting.
- Tag each technique with its MITRE ATT&CK Tactic/Technique when applicable (e.g. T1190 Exploit Public-Facing Application).
- Where relevant, mirror PTES for engagement steps and the Cyber Kill Chain for the adversary perspective.
Always pair offensive content with the matching detection signature and defensive mitigation (patch, config, WAF/EDR rule, detection logic) so the answer is useful to both red and blue teams.
</methodology>

<formatting_rules>
- Lead with a `## Title` (H2); use `### Section` (H3) and `#### Sub` sparingly for structure.
- **Bold** for critical terms, CVE IDs, MITRE IDs, tool names; `inline code` for flags, file paths, IPs, hashes, registry keys, function names.
- Wrap ALL code in fenced blocks with the correct language tag; keep examples version-aware and runnable.
- Use Markdown tables to compare payloads, CVEs, technique variants, or tool trade-offs.
- Use blockquotes (`>`) for callouts: warnings, scope reminders, or defensive notes.
- Keep prose tight and skimmable; let structure and code carry depth.
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


def build_web_prompt(
    question:     str,
    web_results:  list[dict],
    history:      list[dict] = None,
    answer_style: str = None,
) -> str:
    """
    Build a prompt augmented with live Web Search results.
    Used as fallback when local document coverage is insufficient.
    """
    if answer_style not in ANSWER_STYLES:
        answer_style = DEFAULT_STYLE

    style = ANSWER_STYLES[answer_style]
    web_text = format_web_context(web_results)

    history_xml = ""
    if history:
        recent = history[-6:]
        turns = []
        for msg in recent:
            role = "user" if msg.get("role") == "user" else "assistant"
            text = (msg.get("text") or "").strip()[:400]
            turns.append(f'  <{role}>{text}</{role}>')
        if turns:
            history_xml = "<conversation_history>\n" + "\n".join(turns) + "\n</conversation_history>\n\n"

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S (%A)")
    current_year = datetime.now().year

    return f"""<system_instructions>
You are **CyberSecAI** — an elite Ethical Hacking & Cybersecurity Intelligence System.
Your local document collection did not contain sufficient coverage for this question, so live web search results have been retrieved to answer the query accurately.

<temporal_anchor>
Current Date and Time: {now_str}
Current Year: {current_year}
Use this temporal anchor directly when asked for today's date, current time, or real-time status.
</temporal_anchor>

<core_directives>
1. DIRECT SYNTHESIS: Synthesize technical facts, code examples, software versions, dates, and times directly from <web_search_results> and <temporal_anchor>.
   - When asked for date/time or specific facts, STATE THE EXACT ANSWER IMMEDIATELY.
   - NEVER output meta-talk or fluff like "Websites like timeanddate.com provide information..." — give the exact answer directly!
2. CITATION RULE: For key technical facts or external web findings, cite the source URL inline as `[Source Title](url)`.
3. MULTI-LANGUAGE CODE GENERATION: If requested for code or payloads, provide complete, working code blocks with proper language tags (```python, ```bash, ```c, ```javascript, ```powershell, ```ruby, ```nasm, ```sql).
4. ZERO META-TALK: Present knowledge cleanly and directly.
</core_directives>

<formatting_rules>
- Lead with a `## Title` (H2).
- Use `### Section` (H3) for logical sections.
- Use **bold** for key technical terms, CVE IDs, tool names.
- Wrap ALL code in correctly tagged fenced blocks.
</formatting_rules>

<target_depth_style>
{style['instruction']}
</target_depth_style>
</system_instructions>

{history_xml}<web_search_results>
{web_text}
</web_search_results>

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


# ─── Web Search Fallback Helper ─────────────────────────────────────────────

def _execute_web_fallback(
    question:     str,
    search_query: str,
    history:      list[dict],
    answer_style: str,
    style:        dict,
    t_start:      float,
    t_embed:      float,
    t_search:     float,
    t_rerank:     float = 0.0,
) -> dict:
    """Execute live web search fallback when local documents are missing or insufficient."""
    if not ENABLE_WEB_FALLBACK:
        return None

    print(f"  [Fallback Triggered] Executing live web search for: '{question[:50]}...'")
    t_web_start = time.time()
    web_results = perform_web_search(search_query, max_results=MAX_WEB_RESULTS)
    t_web = time.time() - t_web_start

    if not web_results:
        print("  [Fallback Web Search] No web results returned.")
        return None

    web_prompt = build_web_prompt(question, web_results, history=history, answer_style=answer_style)
    t_llm_start = time.time()
    answer_text = call_groq(web_prompt, max_tokens=style["max_tokens"])
    t_llm = time.time() - t_llm_start

    web_sources = [r["url"] for r in web_results if r.get("url")]
    web_titles  = [r["title"] for r in web_results if r.get("title")]

    return {
        "answer":          answer_text,
        "sources":         web_titles[:3],
        "web_sources":     web_sources,
        "is_web_fallback": True,
        "refused":         False,
        "provider":        "groq",
        "model":           GROQ_MODEL,
        "answer_style":    answer_style,
        "timing":          {
            "embed_ms":      round(t_embed * 1000),
            "search_ms":     round(t_search * 1000),
            "rerank_ms":     round(t_rerank * 1000),
            "web_search_ms": round(t_web * 1000),
            "llm_ms":        round(t_llm * 1000),
            "total_ms":      round((time.time() - t_start) * 1000),
        }
    }


# ─── Main pipeline ────────────────────────────────────────────────────────────

def answer(
    question:     str,
    top_k:        int = None,
    history:      list[dict] = None,
    answer_style: str = None,
) -> dict:
    """
    CyberSecAI document-strict RAG pipeline with live Web Search fallback.

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
        web_fb = _execute_web_fallback(question, search_query, history, answer_style, style, t_start, t_embed, t_search)
        if web_fb:
            return web_fb

        return {
            "answer":          REFUSAL_MSG,
            "sources":         [],
            "web_sources":     [],
            "is_web_fallback": False,
            "refused":         True,
            "refuse_reason":   "No documents indexed in the system",
            "timing":          {
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
        web_fb = _execute_web_fallback(question, search_query, history, answer_style, style, t_start, t_embed, t_search, t_rerank)
        if web_fb:
            return web_fb

        return {
            "answer":          REFUSAL_MSG,
            "sources":         [],
            "web_sources":     [],
            "is_web_fallback": False,
            "refused":         True,
            "refuse_reason":   refuse_reason,
            "timing":          {
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
        web_fb = _execute_web_fallback(question, search_query, history, answer_style, style, t_start, t_embed, t_search, t_rerank)
        if web_fb:
            return web_fb

        return {
            "answer":          REFUSAL_MSG,
            "sources":         [],
            "web_sources":     [],
            "is_web_fallback": False,
            "refused":         True,
            "refuse_reason":   "LLM determined documents do not cover this question",
            "timing":          {
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
        "answer":          answer_text,
        "sources":         unique_sources,
        "web_sources":     [],
        "is_web_fallback": False,
        "refused":         False,
        "provider":        "groq",
        "model":           GROQ_MODEL,
        "answer_style":    answer_style,
        "chunks_used":     passing_chunks,
        "timing":          {
            "embed_ms":  round(t_embed * 1000),
            "search_ms": round(t_search * 1000),
            "rerank_ms": round(t_rerank * 1000),
            "llm_ms":    round(t_llm * 1000),
            "total_ms":  round(t_total * 1000),
        }
    }

