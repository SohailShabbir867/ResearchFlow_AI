import json
import asyncio
import re
from collections.abc import AsyncIterator, Callable

from src.embedder import get_embedding
from src.hybrid_search import hybrid_search
from src.reranker import rerank
from src.web_search import perform_web_search
import src.rag_pipeline as rag


def clean_and_parse_json(text: str) -> dict:
    """Robustly parse JSON output from LLMs, stripping markdown codeblocks or extra text."""
    if not text or not isinstance(text, str):
        raise ValueError("Empty or invalid LLM text response")

    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        raise


def _dedupe_subqueries(sub_queries: list[str], question: str, limit: int = 3) -> list[str]:
    """Normalize, deduplicate, and cap sub-queries for better coverage and speed."""
    seen = set()
    cleaned = []
    question_norm = re.sub(r"\s+", " ", question.strip().lower())

    for raw in sub_queries:
        sq = re.sub(r"\s+", " ", str(raw or "")).strip()
        if not sq:
            continue
        key = sq.lower()
        if key == question_norm or key in seen:
            continue
        seen.add(key)
        cleaned.append(sq)
        if len(cleaned) >= limit:
            break

    if not cleaned:
        return [question.strip()]

    if len(cleaned) == 1 and cleaned[0].lower() != question_norm:
        cleaned.insert(0, question.strip())

    return cleaned[:limit]


def _chunk_identity(chunk: dict) -> tuple:
    """Stable identity for deduping RAG chunks across sub-queries."""
    chunk_id = chunk.get("id")
    if chunk_id is not None:
        return (chunk.get("source"), chunk_id)
    return (chunk.get("source"), chunk.get("chunk_index"))


def _merge_unique_chunks(chunks: list[dict]) -> list[dict]:
    """Keep the best chunk per document identity and sort by rerank score."""
    merged = {}
    for chunk in chunks:
        key = _chunk_identity(chunk)
        score = chunk.get("rerank_score", -99)
        current = merged.get(key)
        if current is None or score > current.get("rerank_score", -99):
            merged[key] = chunk
    return sorted(merged.values(), key=lambda c: c.get("rerank_score", -99), reverse=True)


def _merge_unique_web_results(results: list[dict]) -> list[dict]:
    """Deduplicate web results by URL and keep the highest-confidence entry."""
    merged = {}
    for result in results:
        url = result.get("url")
        if not url:
            continue
        current = merged.get(url)
        confidence = result.get("confidence", 0)
        if current is None or confidence > current.get("confidence", 0):
            merged[url] = result
    return sorted(merged.values(), key=lambda r: r.get("confidence", 0), reverse=True)


async def perform_deep_research(
    request,
    history,
    style_name,
    intent,
    intent_info,
    language,
    model_name,
    stream_llm_tokens_fn: Callable[..., AsyncIterator[str]],
) -> AsyncIterator[str]:
    """
    Executes the Deep Autonomous Research agentic loop and yields SSE frames.
    """
    yield f"data: {json.dumps({'status_text': '🧠 Decomposing query for deep analysis...'})}\n\n"

    DECOMPOSITION_TIMEOUT = 20
    RELATED_QUESTIONS_TIMEOUT = 15

    async def fetch_related_questions():
        try:
            sys_r = (
                "You are an AI research assistant. Based on the user's complex query, suggest exactly "
                "3 short, relevant follow-up questions they could ask to learn more. Output ONLY a JSON "
                "object with a single key 'questions' containing an array of 3 strings."
            )
            if language == "ur":
                sys_r += " The user's query is in Urdu, so the follow-up questions MUST be in Urdu."

            raw_text = ""
            async for token in stream_llm_tokens_fn(
                model_name=model_name,
                sys_content=sys_r,
                user_content=request.question,
                max_tokens=200,
                language=language,
            ):
                raw_text += token

            parsed = clean_and_parse_json(raw_text)
            return parsed.get("questions", [])[:3]
        except Exception as e:
            print(f"  [Deep Research] Related Questions Error: {e}")
            return []

    related_task = asyncio.create_task(fetch_related_questions())

    system_prompt = (
        "You are an expert global research assistant. Break down the user's complex query into "
        "3 distinct, highly targeted sub-queries that maximize retrieval from authoritative sources, "
        "recent web results, and topic-specific documents. Prefer concrete angles over vague paraphrases. "
        "Output JSON with a 'queries' array of strings."
    )

    sub_queries = [request.question, f"Recent developments in {request.question}"]

    try:
        async def _decompose() -> str:
            raw_decomp_json = ""
            async for token in stream_llm_tokens_fn(
                model_name=model_name,
                sys_content=system_prompt,
                user_content=request.question,
                max_tokens=200,
                language="en",
            ):
                raw_decomp_json += token
            return raw_decomp_json

        parsed = clean_and_parse_json(await asyncio.wait_for(_decompose(), timeout=DECOMPOSITION_TIMEOUT))
        if "queries" in parsed and isinstance(parsed["queries"], list):
            sub_queries = parsed["queries"][:3]
    except Exception as e:
        print(f"  [Deep Research] Query decomposition failed: {e}")

    sub_queries = _dedupe_subqueries(sub_queries, request.question, limit=3)

    yield f"data: {json.dumps({'status_text': f'🔬 Investigating {len(sub_queries)} analytical angles...'})}\n\n"

    loop = asyncio.get_running_loop()

    async def investigate_subquery(sq: str, idx: int) -> tuple[list[dict], list[dict]]:
        await asyncio.sleep(idx * 0.1)
        passing_chunks: list[dict] = []
        web_results: list[dict] = []

        try:
            q_vec = await loop.run_in_executor(rag._executor, get_embedding, sq, True)
            cands = await loop.run_in_executor(rag._executor, hybrid_search, q_vec, sq)
            if cands:
                reranked = await loop.run_in_executor(rag._executor, rerank, sq, cands, 4)
                should_refuse, _, passing = rag.check_guardrails(reranked)
                if not should_refuse:
                    passing_chunks = passing[:4]
        except Exception as e:
            print(f"  [Deep Research] RAG error for '{sq}': {e}")

        if rag.WEB_ALWAYS_ON or rag.ENABLE_WEB_FALLBACK:
            try:
                web_results = await loop.run_in_executor(rag._executor, perform_web_search, sq, 3)
            except Exception as e:
                print(f"  [Deep Research] Web error for '{sq}': {e}")

        return passing_chunks, web_results

    yield f"data: {json.dumps({'status_text': f'🔍 Investigating {len(sub_queries)} sub-queries in parallel...'})}\n\n"
    gathered = await asyncio.gather(
        *(investigate_subquery(sq, i) for i, sq in enumerate(sub_queries)),
        return_exceptions=True,
    )

    all_passing_chunks: list[dict] = []
    all_web_results: list[dict] = []
    for item in gathered:
        if isinstance(item, Exception):
            print(f"  [Deep Research] Sub-query investigation failed: {item}")
            continue
        chunks, web = item
        all_passing_chunks.extend(chunks)
        all_web_results.extend(web)

    yield f"data: {json.dumps({'status_text': '⚡ Synthesizing deep research report...'})}\n\n"

    unique_chunks = _merge_unique_chunks(all_passing_chunks)[:12]
    unique_web = _merge_unique_web_results(all_web_results)[:8]

    sys_c, usr_c = rag.build_fused_prompt(
        request.question,
        unique_chunks,
        unique_web,
        history=history,
        answer_style=style_name,
    )

    if "executive summary" not in sys_c.lower():
        sys_c += (
            "\n\nCRITICAL DIRECTIVE: This is a DEEP RESEARCH REPORT. You MUST structure the response "
            "with an Executive Summary, a detailed analysis of findings, and a final conclusion. "
            "Use extensive markdown formatting."
        )

    if language == "ur":
        sys_c += (
            "\n\nCRITICAL DIRECTIVE: The user is speaking Urdu. You MUST reply completely in native "
            "Urdu language (using Urdu script), ensuring high-quality formatting and correct terminology."
        )

    effective_max_tokens = min(
        rag.ANSWER_STYLES.get(style_name, {}).get("max_tokens", 4000),
        4000,
    )

    try:
        token_count = 0
        async for token in stream_llm_tokens_fn(
            model_name=model_name,
            sys_content=sys_c,
            user_content=usr_c,
            max_tokens=effective_max_tokens,
            language=language,
        ):
            if token:
                token_count += 1
                yield f"data: {json.dumps({'token': token})}\n\n"
                if token_count % 20 == 0:
                    await asyncio.sleep(0)

        if token_count == 0:
            yield f"data: {json.dumps({'token': 'No response generated from the selected model.'})}\n\n"

    except Exception as e:
        print(f"  [Deep Research] Synthesis error: {e}")
        related_task.cancel()
        yield f"data: {json.dumps({'error': f'Deep Research Synthesis failed: {str(e)}'})}\n\n"
        return

    rag_sources = list({c["source"] for c in unique_chunks if c.get("source")})
    web_sources = [r["url"] for r in unique_web if r.get("url")]
    web_titles = [r["title"] for r in unique_web if r.get("title")]

    rag_source_details = []
    for src in rag_sources:
        src_chunks = [c for c in unique_chunks if c.get("source") == src]
        top_score = max((c.get("rerank_score", -99) for c in src_chunks), default=-99)
        rag_source_details.append({
            "source": src,
            "chunks": len(src_chunks),
            "confidence": rag.source_confidence_score(top_score),
        })

    try:
        related_questions = await asyncio.wait_for(related_task, timeout=RELATED_QUESTIONS_TIMEOUT)
    except Exception:
        related_task.cancel()
        related_questions = []

    done_payload = {
        "done": True,
        "sources": rag_sources + web_titles,
        "web_sources": web_sources,
        "web_results": unique_web,
        "rag_source_details": rag_source_details,
        "is_web_fallback": False,
        "refused": False,
        "intent": intent,
        "intent_info": intent_info,
        "language": language,
        "related_questions": related_questions,
        "model": model_name,
    }
    yield f"data: {json.dumps(done_payload)}\n\n"
