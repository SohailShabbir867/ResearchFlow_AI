import os
import ollama
from dotenv import load_dotenv
from src.embedder import get_embedding
from src.vector_store import search

load_dotenv()

LLM_MODEL = os.getenv("LLM_MODEL", "llama3")


def build_prompt(question: str, context_chunks: list[dict]) -> str:
    """Build the prompt by injecting retrieved chunks as context."""
    context_text = ""
    for i, chunk in enumerate(context_chunks):
        context_text += f"[Source {i+1}: {chunk['source']}]\n{chunk['text']}\n\n"

    prompt = f"""You are a medical research assistant. 
Answer the question below using ONLY the provided context.
If the answer is not in the context, say "I don't have enough information."

Context:
{context_text}

Question: {question}

Answer:"""
    return prompt


def answer(question: str, top_k: int = 5) -> dict:
    """
    Full RAG pipeline:
    1. Embed the question
    2. Search Qdrant for relevant chunks
    3. Build prompt with context
    4. Send to Ollama LLM
    5. Return answer + sources
    """

    # Step 1: Embed the question
    query_vector = get_embedding(question)

    # Step 2: Retrieve top matching chunks
    chunks = search(query_vector, top_k=top_k)

    if not chunks:
        return {
            "answer": "No relevant documents found. Please index some documents first.",
            "sources": []
        }

    # Step 3: Build prompt
    prompt = build_prompt(question, chunks)

    # Step 4: Ask Ollama LLM
    response = ollama.chat(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}]
    )

    answer_text = response["message"]["content"]

    # Step 5: Return answer + unique sources
    unique_sources = list({c["source"] for c in chunks})

    return {
        "answer": answer_text,
        "sources": unique_sources,
        "chunks_used": chunks
    }
