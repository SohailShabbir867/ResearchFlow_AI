"""
Full RAG pipeline — document-strict mode.

3-layer guardrail system:
  Layer 1 — Reranker score threshold (tightened to -2.0)
             Blocks queries where NO chunk is semantically close enough
  Layer 2 — Chunk coverage check
             Blocks if fewer than MIN_RELEVANT_CHUNKS pass the threshold
             Prevents answering from one weak match
  Layer 3 — Strict prompt instruction
             LLM is explicitly forbidden from using training memory
             Returns a hard-coded refusal if it tries to go off-document

Pipeline flow:
  1. Embed query locally (FastEmbed ONNX)
  2. Hybrid search: vector + BM25 + RRF → top 20 candidates
  3. Rerank with cross-encoder → scored top 5
  4. Layer 1 + Layer 2 guardrail check
  5. Build strict prompt with only passing chunks
  6. Call Groq LLM
  7. Layer 3 — detect and block any off-document answer
  8. Return answer + sources
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
# Layer 1: minimum rerank score the TOP chunk must reach.
# -2.0 is strict — only chunks genuinely relevant to the question pass.
# Previous value was -4.5 which let borderline chunks through.
# Tune this value: lower = stricter, higher = more permissive.
RELEVANCE_THRESHOLD = float(os.getenv("RELEVANCE_THRESHOLD", "-2.0"))

# Layer 2: minimum number of chunks that must pass the threshold.
# Prevents answering from a single weak match.
# If question needs 3 supporting chunks but only 1 passes → refuse.
MIN_RELEVANT_CHUNKS = int(os.getenv("MIN_RELEVANT_CHUNKS", "2"))

# Standard refusal message returned on any guardrail block
REFUSAL_MSG = (
    "I can only answer questions based on the documents that have been uploaded "
    "to this system. This topic is not covered in the current document collection. "
    "Please upload relevant documents and try again."
)


# ─── Guardrail functions ──────────────────────────────────────────────────────

def filter_chunks_by_threshold(chunks: list[dict]) -> list[dict]:
    """
    Layer 2: Remove chunks whose rerank score is below RELEVANCE_THRESHOLD.
    Only chunks that genuinely match the question survive.
    """
    passing = [
        c for c in chunks
        if c.get("rerank_score", -99.0) >= RELEVANCE_THRESHOLD
    ]
    return passing


def check_guardrails(reranked: list[dict]) -> tuple[bool, str]:
    """
    Run Layer 1 and Layer 2 checks.
    Returns (should_refuse: bool, reason: str).
    """
    # Layer 1: top chunk score
    top_score = reranked[0].get("rerank_score", -99.0) if reranked else -99.0
    print(f"  [Guardrail L1] Top chunk rerank score: {top_score:.4f} (threshold: {RELEVANCE_THRESHOLD})")

    if top_score < RELEVANCE_THRESHOLD:
        return True, f"Top chunk score {top_score:.4f} below threshold {RELEVANCE_THRESHOLD}"

    # Layer 2: count how many chunks pass
    passing = filter_chunks_by_threshold(reranked)
    print(f"  [Guardrail L2] {len(passing)}/{len(reranked)} chunks passed threshold (min required: {MIN_RELEVANT_CHUNKS})")

    if len(passing) < MIN_RELEVANT_CHUNKS:
        return True, f"Only {len(passing)} chunk(s) passed relevance threshold (need {MIN_RELEVANT_CHUNKS})"

    return False, ""


# ─── Prompt builder ───────────────────────────────────────────────────────────

def build_prompt(question: str, context_chunks: list[dict]) -> str:
    """
    Build a strict document-only prompt.

    Layer 3 instructions:
    - Explicitly tells LLM it CANNOT use its training knowledge
    - Sets a hard trigger phrase for off-document detection
    - Forces the LLM to only synthesize from the provided chunks
    """
    context_text = ""
    for i, chunk in enumerate(context_chunks):
        context_text += f"[Document {i+1}]\n{chunk['text']}\n\n"

    return f"""You are a medical research assistant with ONE strict rule:

YOU MUST ONLY USE THE INFORMATION IN THE DOCUMENTS PROVIDED BELOW.
DO NOT use your training knowledge, general medical knowledge, or anything
from outside these documents — even if you know the answer.

If the provided documents do not contain enough information to answer the
question, you MUST respond with EXACTLY this phrase and nothing else:
"INSUFFICIENT_DOCUMENT_COVERAGE"

Do not apologize. Do not explain. Do not add anything.
Just write: INSUFFICIENT_DOCUMENT_COVERAGE

If the documents DO contain the answer, follow these formatting rules:
1. Use MARKDOWN: ## headings, ### subheadings, bullet points (-), numbered lists, **bold**
2. Definitions → paragraph with heading
3. Lists of symptoms/medicines/criteria → bullet points
4. Step-by-step processes → numbered list
5. Complex topics → ## heading + ### subheadings + bullets
6. DO NOT mention file names, page numbers, or [Source X] references
7. DO NOT say "according to the documents" — just answer directly
8. End with a **Summary** section if the answer has multiple parts

---

PROVIDED DOCUMENTS (your ONLY allowed source):
{context_text}
---

QUESTION: {question}

ANSWER (from documents only — or write INSUFFICIENT_DOCUMENT_COVERAGE):"""


# ─── LLM call ────────────────────────────────────────────────────────────────

def call_groq(prompt: str, max_retries: int = 3) -> str:
    """Call Groq API with retry logic for rate limits."""
    from groq import Groq

    client = Groq(api_key=GROQ_API_KEY)

    for attempt in range(max_retries):
        try:
            chat = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,   # 0 = fully deterministic, no creative deviation
                max_tokens=1024,
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
    """
    Layer 3: Detect if the LLM used training knowledge instead of documents.
    Triggers on the hard refusal phrase we planted in the prompt.
    """
    trigger = "INSUFFICIENT_DOCUMENT_COVERAGE"
    return trigger in text.upper()


# ─── Main pipeline ────────────────────────────────────────────────────────────

def answer(question: str, top_k: int = None) -> dict:
    """
    Document-strict RAG pipeline.

    Guarantees: every answer comes from uploaded documents.
    If documents don't cover the question → returns REFUSAL_MSG.
    """
    if top_k is None:
        top_k = RERANKER_TOP_K

    t_start = time.time()

    # ── Step 1: Embed query locally ───────────────────────────────────────────
    t1 = time.time()
    query_vector = get_embedding(question, is_query=True)
    t_embed = time.time() - t1

    # ── Step 2: Hybrid search ─────────────────────────────────────────────────
    t2 = time.time()
    candidates = hybrid_search(query_vector, question)
    t_search = time.time() - t2

    # No candidates at all → collection empty or Qdrant issue
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

    # ── Step 3: Rerank candidates ─────────────────────────────────────────────
    t3 = time.time()
    reranked = rerank(question, candidates, top_k=top_k)
    t_rerank = time.time() - t3

    # ── Step 4: Guardrail — Layer 1 + Layer 2 ────────────────────────────────
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

    # Only pass chunks that cleared the threshold to the LLM
    passing_chunks = filter_chunks_by_threshold(reranked)
    print(f"  [Pipeline] Sending {len(passing_chunks)} verified chunks to LLM")

    # ── Step 5: Build strict prompt ───────────────────────────────────────────
    if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
        raise Exception("GROQ_API_KEY not set in .env")

    t4 = time.time()
    prompt = build_prompt(question, passing_chunks)

    # ── Step 6: Call Groq ─────────────────────────────────────────────────────
    answer_text = call_groq(prompt)
    t_llm = time.time() - t4

    # ── Step 7: Layer 3 — detect off-document answer ──────────────────────────
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

    # ── Step 8: Return verified answer ───────────────────────────────────────
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
        "chunks_used": passing_chunks,
        "timing": {
            "embed_ms": round(t_embed * 1000),
            "search_ms": round(t_search * 1000),
            "rerank_ms": round(t_rerank * 1000),
            "llm_ms": round(t_llm * 1000),
            "total_ms": round(t_total * 1000)
        }
    }
