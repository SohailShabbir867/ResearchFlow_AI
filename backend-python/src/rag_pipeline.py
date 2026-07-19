import os
import requests
from dotenv import load_dotenv
from src.embedder import get_embedding
from src.vector_store import search

load_dotenv()

# ─── LLM Provider Configuration ────────────────────────────────────────────
# Set GROQ_API_KEY in .env to use Groq (fast, free external API)
# Leave it empty to fall back to Ollama on VPS
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = os.getenv("GROQ_MODEL", "llama3-8b-8192")

# Ollama fallback (VPS)
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
LLM_MODEL  = os.getenv("LLM_MODEL", "phi3:mini")


def build_prompt(question: str, context_chunks: list[dict]) -> str:
    """Build a short, focused prompt for fast inference."""
    context_text = ""
    for i, chunk in enumerate(context_chunks):
        text = chunk['text']   # Do not truncate chunks to preserve sentence integrity
        context_text += f"[Source {i+1}: {chunk['source']}]\n{text}\n\n"

    return f"""You are a research assistant. Answer briefly using ONLY the context below.
If the answer is not in the context, say 'I don't have enough information.'

Context:
{context_text}
Question: {question}
Answer (2-3 sentences max):"""


def call_groq(prompt: str) -> str:
    """Call Groq API — fast, free, cloud-based LLM."""
    from groq import Groq
    client = Groq(api_key=GROQ_API_KEY)
    chat = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=512,
    )
    return chat.choices[0].message.content


def call_ollama(prompt: str) -> str:
    """Call Ollama on VPS — slower CPU-only fallback."""
    url = f"{OLLAMA_URL}/api/chat"
    payload = {
        "model": LLM_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False
    }
    response = requests.post(url, json=payload, timeout=300)
    response.raise_for_status()
    return response.json()["message"]["content"]


def answer(question: str, top_k: int = 5) -> dict:
    """
    Full RAG pipeline:
    1. Embed the question using nomic-embed-text on VPS
    2. Search Qdrant for relevant chunks
    3. Build prompt with retrieved context
    4. Call Groq API (if key set) or Ollama (fallback)
    5. Return answer + sources
    """

    # Step 1: Embed question
    query_vector = get_embedding(question)

    # Step 2: Retrieve top matching chunks from Qdrant
    chunks = search(query_vector, top_k=top_k)

    if not chunks:
        return {
            "answer": "No relevant documents found. Please index some documents first.",
            "sources": []
        }

    # Step 3: Build prompt
    prompt = build_prompt(question, chunks)

    # Step 4: Call the LLM
    provider = "groq" if GROQ_API_KEY else "ollama"
    try:
        if provider == "groq":
            answer_text = call_groq(prompt)
        else:
            answer_text = call_ollama(prompt)
    except requests.exceptions.Timeout:
        raise requests.exceptions.Timeout("Ollama timed out — model may still be loading.")
    except Exception as e:
        raise Exception(f"LLM call failed ({provider}): {str(e)}")

    # Step 5: Return answer + unique sources
    unique_sources = list({c["source"] for c in chunks})

    return {
        "answer": answer_text,
        "sources": unique_sources,
        "provider": provider,
        "chunks_used": chunks
    }
