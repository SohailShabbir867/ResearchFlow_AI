"""
Full RAG pipeline with hybrid search + reranking + Groq LLM.

Pipeline flow:
1. Embed query locally (FastEmbed ONNX — instant, no network)
2. Hybrid search: vector + BM25 with RRF fusion → top 20 candidates
3. Rerank with cross-encoder → top 5 most relevant
4. Guardrail check: If the top reranker score is too low, return fallback response
5. Build prompt with reranked context
6. Call Groq API (llama-3.3-70b-versatile) for generation
7. Return answer + sources + metadata
"""
import os
import time
from dotenv import load_dotenv
from src.embedder import get_embedding
from src.hybrid_search import hybrid_search
from src.reranker import rerank

load_dotenv()

# ─── LLM Configuration ─────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
RERANKER_TOP_K = int(os.getenv("RERANKER_TOP_K", "5"))

# Relevance score threshold for the cross-encoder reranker
# If the top candidate score is below this, we classify it as irrelevant.
RELEVANCE_THRESHOLD = -4.5


def build_prompt(question: str, context_chunks: list[dict]) -> str:
    """Build a structured prompt that produces clean, well-formatted answers."""
    context_text = ""
    for i, chunk in enumerate(context_chunks):
        context_text += f"[Document {i+1}]\n{chunk['text']}\n\n"

    return f"""You are an expert medical research assistant. Your job is to give clear, accurate, and well-structured answers based on the provided documents.

STRICT FORMATTING RULES — follow these every time:
1. Use MARKDOWN formatting: headings (##, ###), bullet points (-), numbered lists (1. 2. 3.), bold (**text**), and paragraphs.
2. Choose the format that best suits the content:
   - For definitions or explanations → use a paragraph with a heading
   - For lists of symptoms, causes, medicines, or criteria → use bullet points (-)
   - For step-by-step processes or stages → use a numbered list
   - For complex topics → use ## heading with ### subheadings and bullets under each
3. DO NOT include any source citations, file names, page numbers, or references like "[Source 1]" or "(p.1)" anywhere in your answer. The answer must read as clean, professional text.
4. DO NOT say "according to the context" or "based on the provided documents". Just answer directly.
5. If the answer is not in the documents, or if the question is irrelevant to the provided documents, you MUST say exactly: "Sorry, I am not trained for that purpose." and absolutely nothing else.
6. Always end with a concise **Summary** section if the answer has multiple parts.

---

Context Documents:
{context_text}
---

Question: {question}

Answer (use proper markdown headings, bullet points, and structure):"""


def call_groq(prompt: str, max_retries: int = 3) -> str:
    """Call Groq API with retry logic for rate limits."""
    from groq import Groq

    client = Groq(api_key=GROQ_API_KEY)

    for attempt in range(max_retries):
        try:
            chat = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,  # Lower temperature for more deterministic/factual output
                max_tokens=1024,
            )
            return chat.choices[0].message.content
        except Exception as e:
            error_msg = str(e)
            if "rate_limit" in error_msg.lower() and attempt < max_retries - 1:
                wait = (attempt + 1) * 2
                print(f"  Rate limited, retrying in {wait}s...")
                time.sleep(wait)
                continue
            raise

    raise Exception("Groq API failed after retries")


def answer(question: str, top_k: int = None) -> dict:
    """
    Full upgraded RAG pipeline:
    1. Embed query locally (FastEmbed ONNX)
    2. Hybrid search (vector + BM25 + RRF)
    3. Rerank with cross-encoder
    4. Guardrail irrelevant queries
    5. Generate answer via Groq
    """
    if top_k is None:
        top_k = RERANKER_TOP_K

    t_start = time.time()

    # Step 1: Embed query locally
    t1 = time.time()
    query_vector = get_embedding(question, is_query=True)
    t_embed = time.time() - t1

    # Step 2: Hybrid search
    t2 = time.time()
    candidates = hybrid_search(query_vector, question)
    t_search = time.time() - t2

    if not candidates:
        return {
            "answer": "Sorry, I am not trained for that purpose.",
            "sources": [],
            "timing": {
                "embed_ms": round(t_embed * 1000),
                "search_ms": round(t_search * 1000),
                "total_ms": round((time.time() - t_start) * 1000)
            }
        }

    # Step 3: Rerank candidates with cross-encoder
    t3 = time.time()
    reranked = rerank(question, candidates, top_k=top_k)
    t_rerank = time.time() - t3

    # Step 4: Guardrail check for irrelevance
    # Check if the top match's rerank score is below relevance threshold
    top_score = reranked[0].get("rerank_score", -99.0) if reranked else -99.0
    print(f"  Top candidate rerank score: {top_score}")

    if top_score < RELEVANCE_THRESHOLD:
        print(f"  Query classified as irrelevant (score {top_score} < {RELEVANCE_THRESHOLD})")
        return {
            "answer": "Sorry, I am not trained for that purpose.",
            "sources": [],
            "timing": {
                "embed_ms": round(t_embed * 1000),
                "search_ms": round(t_search * 1000),
                "rerank_ms": round(t_rerank * 1000),
                "total_ms": round((time.time() - t_start) * 1000)
            }
        }

    # Step 5: Build prompt and call Groq
    t4 = time.time()
    prompt = build_prompt(question, reranked)

    if not GROQ_API_KEY:
        raise Exception("GROQ_API_KEY not set in .env — required for LLM generation")

    answer_text = call_groq(prompt)
    t_llm = time.time() - t4

    # If LLM decides the documents can't answer it despite a border-line rerank score
    if "not trained for that purpose" in answer_text.lower():
        answer_text = "Sorry, I am not trained for that purpose."
        unique_sources = []
    else:
        unique_sources = list({c["source"] for c in reranked})

    t_total = time.time() - t_start

    return {
        "answer": answer_text,
        "sources": unique_sources,
        "provider": "groq",
        "model": GROQ_MODEL,
        "chunks_used": reranked,
        "timing": {
            "embed_ms": round(t_embed * 1000),
            "search_ms": round(t_search * 1000),
            "rerank_ms": round(t_rerank * 1000),
            "llm_ms": round(t_llm * 1000),
            "total_ms": round(t_total * 1000)
        }
    }
