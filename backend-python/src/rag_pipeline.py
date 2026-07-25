"""
Full RAG pipeline — document-strict mode with conversation memory.

v3.0 — Upgrades:
  - Conversation memory: uses last N turns for context-aware follow-ups
  - Adaptive answer style: detail / short / classical (user-controlled)
  - Query enrichment: combines question with conversation context for better retrieval
  - Concise default prompts for faster, tighter answers

3-layer guardrail system:
  Layer 1 — Reranker score threshold
  Layer 2 — Chunk coverage check
  Layer 3 — Strict prompt instruction + off-document detection

Pipeline flow:
  1. Enrich query with conversation context (if history present)
  2. Embed query locally (FastEmbed ONNX, cached)
  3. Hybrid search: vector + BM25 + RRF → top 20 candidates
  4. Rerank with cross-encoder → scored top 5
  5. Layer 1 + Layer 2 guardrail check
  6. Build adaptive prompt (with history + answer style)
  7. Call Groq LLM
  8. Layer 3 — detect and block any off-document answer
  9. Return answer + sources
"""
import os
import time
from dotenv import load_dotenv
from src.embedder import get_embedding
from src.hybrid_search import hybrid_search
from src.reranker import rerank

load_dotenv()

# ─── LLM config ──────────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
RERANKER_TOP_K = int(os.getenv("RERANKER_TOP_K", "5"))

# ─── Guardrail thresholds ─────────────────────────────────────────────────────
RELEVANCE_THRESHOLD = float(os.getenv("RELEVANCE_THRESHOLD", "-2.0"))
MIN_RELEVANT_CHUNKS = int(os.getenv("MIN_RELEVANT_CHUNKS", "2"))

# Standard refusal message
REFUSAL_MSG = (
    "I can only answer questions based on the documents that have been uploaded "
    "to this system. This topic is not covered in the current document collection. "
    "Please upload relevant documents and try again."
)

# ─── Answer style configs ─────────────────────────────────────────────────────
# Every style now instructs the LLM to emit well-structured Markdown so the UI
# can render headings, sub-headings, lists, and details cleanly with a typewriter
# streaming effect. The frontend renders the raw markdown token-by-token.
ANSWER_STYLES = {
    "short": {
        "instruction": (
            "Formulate a direct, impactful response in 1 to 3 concise sentences. "
            "Focus exclusively on answering the query directly. "
            "Highlight key medical/technical concepts with **bold text**. "
            "Do NOT use headers, bullet points, or introductory filler."
        ),
        "max_tokens": 256,
    },
    "classical": {
        "instruction": (
            "Structure your output cleanly using production Markdown:\n"
            "- Begin with a single `##` title line summarizing the core subject.\n"
            "- Write a crisp 2-sentence opening summary paragraph.\n"
            "- Group relevant body details using `###` section headers.\n"
            "- Use bullet points (`-`) for key attributes or list components.\n"
            "- Emphasize key terms with **bold** typography."
        ),
        "max_tokens": 768,
    },
    "detailed": {
        "instruction": (
            "Provide an exhaustive, deeply structured analytical response in Markdown:\n"
            "- Begin with a descriptive `##` title heading.\n"
            "- Provide an executive summary paragraph introducing the findings.\n"
            "- Divide the body into thematic `###` sub-headings covering all nuances.\n"
            "- Use Markdown tables (`| Column 1 | Column 2 |`) for comparative data or attributes where applicable.\n"
            "- Use bulleted (`-`) and numbered (`1.`) lists for steps or breakdowns.\n"
            "- Wrap critical terms in **bold**.\n"
            "- End with a dedicated `## Key Takeaways` section listing 3-5 bulleted core takeaways.\n"
            "- Thoroughly detail all relevant context without conversational fluff."
        ),
        "max_tokens": 2500,
    },
}

DEFAULT_STYLE = "classical"
GLOBAL_MAX_TOKENS = 2500


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
    print(f"  [Guardrail L2] {len(passing)}/{len(reranked)} chunks passed threshold (min required: {MIN_RELEVANT_CHUNKS})")

    if len(passing) < MIN_RELEVANT_CHUNKS:
        return True, f"Only {len(passing)} chunk(s) passed relevance threshold (need {MIN_RELEVANT_CHUNKS})"

    return False, ""


# ─── Query enrichment with conversation context ──────────────────────────────

def enrich_query(question: str, history: list[dict] = None) -> str:
    """
    Enrich the search query with conversation context for better retrieval.
    Takes the last assistant answer and combines key terms with the current question.
    """
    if not history:
        return question

    # Get the last assistant message for context
    last_assistant = None
    for msg in reversed(history):
        if msg.get("role") == "assistant":
            last_assistant = msg.get("text", "")
            break

    if not last_assistant or len(last_assistant) < 10:
        return question

    # For short follow-up questions, prepend context from last answer
    if len(question.split()) <= 8:
        # Take first 100 chars of last answer as context
        context_snippet = last_assistant[:150].replace("\n", " ").strip()
        enriched = f"{context_snippet} {question}"
        print(f"  [Memory] Enriched short query: '{question}' → '{enriched[:80]}...'")
        return enriched

    return question


# ─── Prompt builder ───────────────────────────────────────────────────────────

def build_prompt(
    question: str,
    context_chunks: list[dict],
    history: list[dict] = None,
    answer_style: str = None,
) -> str:
    """
    Build a document-grounded prompt utilizing state-of-the-art prompt engineering:
    1. Role Persona Assignment (Research & Medical Intelligence Expert)
    2. Structural XML Containers (<context_documents>, <conversation_history>, <user_query>)
    3. Strict Grounding Mandate & Zero-Hallucination Fallback (<refusal_protocol>)
    4. Executive Markdown Formatting Rules
    5. Adaptive Style Directives
    """
    if answer_style not in ANSWER_STYLES:
        answer_style = DEFAULT_STYLE

    style = ANSWER_STYLES[answer_style]

    # Build XML document context
    context_blocks = []
    for i, chunk in enumerate(context_chunks):
        source_name = chunk.get("source", f"Document {i+1}")
        text_content = chunk.get("text", "").strip()
        context_blocks.append(
            f'<document index="{i+1}" source="{source_name}">\n{text_content}\n</document>'
        )
    context_text = "\n\n".join(context_blocks)

    # Build XML conversation history
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

    return f"""<system_instructions>
You are ResearchAI, an elite Domain Research & Medical Intelligence System.
Your objective is to provide executive-grade, perfectly formatted, highly accurate answers strictly grounded in the provided document context.

<core_directives>
1. GROUNDING MANDATE: Answer using ONLY facts explicitly present in <context_documents>. Do NOT extrapolate, speculate, or introduce external training knowledge.
2. REFUSAL PROTOCOL: If the information required to answer <user_query> cannot be logically derived from <context_documents>, respond with EXACTLY:
   INSUFFICIENT_DOCUMENT_COVERAGE
3. ZERO META-TALK: Never mention "based on the documents", "according to document 1", or "in the text". Present facts directly and authoritatively.
4. SPATIAL & VISUAL ELEGANCE: Use clean GitHub-flavored Markdown. Include proper headers, spacing between blocks, bolding for key terminology, bulleted lists for multi-point facts, and Markdown tables when comparing items.
</core_directives>

<formatting_rules>
- Heading Level 2 (`## Topic Title`) for the main title of your response.
- Heading Level 3 (`### Subsection Title`) for thematic sub-sections.
- Highlight crucial technical/medical terms using **bold text**.
- Use Markdown lists (`-` or `1.`) for structured enumerations.
- Ensure blank lines between headers, paragraphs, and list blocks for visual readability.
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


# ─── LLM call ────────────────────────────────────────────────────────────────

def call_groq(prompt: str, max_tokens: int = 512, max_retries: int = 3) -> str:
    """Call Groq API with retry logic for rate limits."""
    from groq import Groq

    client = Groq(api_key=GROQ_API_KEY)

    for attempt in range(max_retries):
        try:
            chat = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
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
    trigger = "INSUFFICIENT_DOCUMENT_COVERAGE"
    return trigger in text.upper()


# ─── Main pipeline ────────────────────────────────────────────────────────────

def answer(
    question: str,
    top_k: int = None,
    history: list[dict] = None,
    answer_style: str = None,
) -> dict:
    """
    Document-strict RAG pipeline with conversation memory.

    Args:
        question: User's question
        top_k: Number of chunks to pass to LLM (default from env)
        history: Previous conversation turns [{role, text}, ...]
        answer_style: "short" | "detailed" | "classical"
    """
    if top_k is None:
        top_k = RERANKER_TOP_K
    if answer_style not in ANSWER_STYLES:
        answer_style = DEFAULT_STYLE

    style = ANSWER_STYLES[answer_style]
    t_start = time.time()

    # ── Step 1: Enrich query with conversation context ────────────────────────
    search_query = enrich_query(question, history)

    # ── Step 2: Embed query locally (cached) ──────────────────────────────────
    t1 = time.time()
    query_vector = get_embedding(search_query, is_query=True)
    t_embed = time.time() - t1

    # ── Step 3: Hybrid search ─────────────────────────────────────────────────
    t2 = time.time()
    candidates = hybrid_search(query_vector, search_query)
    t_search = time.time() - t2

    if not candidates:
        print("  [Guardrail] No candidates returned from hybrid search")
        return {
            "answer": REFUSAL_MSG,
            "sources": [],
            "refused": True,
            "refuse_reason": "No documents indexed in the system",
            "timing": {
                "embed_ms": round(t_embed * 1000),
                "search_ms": round(t_search * 1000),
                "total_ms": round((time.time() - t_start) * 1000)
            }
        }

    # ── Step 4: Rerank candidates ─────────────────────────────────────────────
    t3 = time.time()
    reranked = rerank(question, candidates, top_k=top_k)
    t_rerank = time.time() - t3

    # ── Step 5: Guardrail — Layer 1 + Layer 2 ────────────────────────────────
    should_refuse, refuse_reason = check_guardrails(reranked)

    if should_refuse:
        print(f"  [Guardrail BLOCKED] Reason: {refuse_reason}")
        return {
            "answer": REFUSAL_MSG,
            "sources": [],
            "refused": True,
            "refuse_reason": refuse_reason,
            "timing": {
                "embed_ms": round(t_embed * 1000),
                "search_ms": round(t_search * 1000),
                "rerank_ms": round(t_rerank * 1000),
                "total_ms": round((time.time() - t_start) * 1000)
            }
        }

    passing_chunks = filter_chunks_by_threshold(reranked)
    print(f"  [Pipeline] Sending {len(passing_chunks)} verified chunks to LLM (style={answer_style})")

    # ── Step 6: Build prompt with memory + style ─────────────────────────────
    if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
        raise Exception("GROQ_API_KEY not set in .env")

    t4 = time.time()
    prompt = build_prompt(question, passing_chunks, history=history, answer_style=answer_style)

    # ── Step 7: Call Groq ─────────────────────────────────────────────────────
    answer_text = call_groq(prompt, max_tokens=style["max_tokens"])
    t_llm = time.time() - t4

    # ── Step 8: Layer 3 — detect off-document answer ──────────────────────────
    if detect_off_document_answer(answer_text):
        print("  [Guardrail L3] LLM flagged insufficient document coverage")
        return {
            "answer": REFUSAL_MSG,
            "sources": [],
            "refused": True,
            "refuse_reason": "LLM determined documents do not cover this question",
            "timing": {
                "embed_ms": round(t_embed * 1000),
                "search_ms": round(t_search * 1000),
                "rerank_ms": round(t_rerank * 1000),
                "llm_ms": round(t_llm * 1000),
                "total_ms": round((time.time() - t_start) * 1000)
            }
        }

    # ── Step 9: Return verified answer ───────────────────────────────────────
    unique_sources = list({c["source"] for c in passing_chunks})
    t_total = time.time() - t_start

    print(f"  [Pipeline] Answer generated. Sources: {unique_sources}")
    print(f"  [Timing] embed={round(t_embed*1000)}ms search={round(t_search*1000)}ms "
          f"rerank={round(t_rerank*1000)}ms llm={round(t_llm*1000)}ms "
          f"total={round(t_total*1000)}ms")

    return {
        "answer": answer_text,
        "sources": unique_sources,
        "refused": False,
        "provider": "groq",
        "model": GROQ_MODEL,
        "answer_style": answer_style,
        "chunks_used": passing_chunks,
        "timing": {
            "embed_ms": round(t_embed * 1000),
            "search_ms": round(t_search * 1000),
            "rerank_ms": round(t_rerank * 1000),
            "llm_ms": round(t_llm * 1000),
            "total_ms": round(t_total * 1000)
        }
    }
