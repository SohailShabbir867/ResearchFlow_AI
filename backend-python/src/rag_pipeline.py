"""
Full RAG pipeline with hybrid search + reranking + Groq LLM.

Pipeline flow:
1. Embed query locally (FastEmbed ONNX — instant, no network)
2. Hybrid search: vector + BM25 with RRF fusion → top 20 candidates
3. Rerank with cross-encoder → top 5 most relevant
4. Build prompt with reranked context
5. Call Groq API (llama-3.3-70b-versatile) for generation
6. Return answer + sources + metadata
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


def build_prompt(question: str, context_chunks: list[dict]) -> str:
    """Build a detailed prompt with reranked context for the 70b model."""
    context_text = ""
    for i, chunk in enumerate(context_chunks):
        source = chunk.get('source', 'unknown')
        pages = chunk.get('pages', [])
        page_info = f" (p.{','.join(map(str, pages))})" if pages else ""
        context_text += f"[Source {i+1}: {source}{page_info}]\n{chunk['text']}\n\n"

    return f"""You are an expert research assistant with access to a document knowledge base.
Answer the question thoroughly using ONLY the context provided below.
If the context contains relevant information, provide a detailed, well-structured answer.
If the answer is not in the context, say "I don't have enough information in the indexed documents."
Always cite which source document(s) your answer comes from.

Context:
{context_text}
Question: {question}

Answer:"""


def call_groq(prompt: str, max_retries: int = 3) -> str:
    """Call Groq API with retry logic for rate limits."""
    from groq import Groq

    client = Groq(api_key=GROQ_API_KEY)

    for attempt in range(max_retries):
        try:
            chat = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=1024,  # 70b model can generate longer, richer answers
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
    4. Generate answer via Groq
    """
    if top_k is None:
        top_k = RERANKER_TOP_K

    t_start = time.time()

    # Step 1: Embed query locally (instant — no network call)
    t1 = time.time()
    query_vector = get_embedding(question, is_query=True)
    t_embed = time.time() - t1

    # Step 2: Hybrid search — vector + BM25 + RRF fusion
    t2 = time.time()
    candidates = hybrid_search(query_vector, question)
    t_search = time.time() - t2

    if not candidates:
        return {
            "answer": "No relevant documents found. Please index some documents first.",
            "sources": [],
            "timing": {}
        }

    # Step 3: Rerank candidates with cross-encoder
    t3 = time.time()
    reranked = rerank(question, candidates, top_k=top_k)
    t_rerank = time.time() - t3

    # Step 4: Build prompt and call Groq
    t4 = time.time()
    prompt = build_prompt(question, reranked)

    if not GROQ_API_KEY:
        raise Exception("GROQ_API_KEY not set in .env — required for LLM generation")

    answer_text = call_groq(prompt)
    t_llm = time.time() - t4

    t_total = time.time() - t_start

    # Step 5: Return answer + metadata
    unique_sources = list({c["source"] for c in reranked})

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
