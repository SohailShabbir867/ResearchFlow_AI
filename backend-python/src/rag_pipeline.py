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
ANSWER_STYLES = {
    "short": {
        "instruction": (
            "Answer in 1-3 concise sentences. Be direct and to the point. "
            "No headings, no bullet points unless listing 3+ items. "
            "No introductory phrases like 'Based on the documents'."
        ),
        "max_tokens": 256,
    },
    "detailed": {
        "instruction": (
            "Provide a thorough, well-structured answer using markdown:\n"
            "- Use **bold** for key terms\n"
            "- Use bullet points (-) for lists\n"
            "- Use numbered lists for step-by-step processes\n"
            "- Include all relevant details from the documents\n"
            "- End with a brief **Summary** if the answer has multiple parts\n"
            "Do NOT mention file names or say 'according to the documents'."
        ),
        "max_tokens": 1024,
    },
    "classical": {
        "instruction": (
            "Write a clear, well-organized answer in 3-6 sentences. "
            "Use **bold** for key terms. Use bullet points only for lists of 3+ items. "
            "Be informative but not verbose. No headings needed. "
            "Do NOT mention file names or say 'according to the documents'."
        ),
        "max_tokens": 512,
    },
}

DEFAULT_STYLE = "classical"


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
    Build a document-grounded prompt with conversation memory and adaptive style.

    - history: list of {role, text} from previous conversation turns
    - answer_style: "short" | "detailed" | "classical" (default)
    """
    if answer_style not in ANSWER_STYLES:
        answer_style = DEFAULT_STYLE

    style = ANSWER_STYLES[answer_style]

    # Build context from chunks
    context_text = ""
    for i, chunk in enumerate(context_chunks):
        context_text += f"[Document {i+1}]\n{chunk['text']}\n\n"

    # Build conversation history section
    history_text = ""
    if history:
        # Use last 3 turns (6 messages max) for context
        recent = history[-6:]
        turns = []
        for msg in recent:
            role = "User" if msg.get("role") == "user" else "Assistant"
            text = msg.get("text", "")[:300]  # Truncate long messages
            turns.append(f"{role}: {text}")
        if turns:
            history_text = "CONVERSATION HISTORY (for context only):\n" + "\n".join(turns) + "\n\n---\n\n"

    return f"""You are a knowledgeable research assistant. You answer questions using ONLY the provided documents below.

STRICT RULES:
- Use ONLY the information in the provided documents
- If the documents don't cover the question, respond with EXACTLY: INSUFFICIENT_DOCUMENT_COVERAGE
- Do NOT use your training knowledge or make things up
- Do NOT mention document numbers, file names, or say "according to the documents"
- Just answer naturally as if you know the information

ANSWER STYLE:
{style['instruction']}

---

{history_text}PROVIDED DOCUMENTS:
{context_text}---

QUESTION: {question}

ANSWER:"""


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
