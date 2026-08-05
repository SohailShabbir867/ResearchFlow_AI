import json
import asyncio
import re
from datetime import datetime
from pydantic import BaseModel
import src.rag_pipeline as rag
from src.embedder import get_embedding
from src.hybrid_search import hybrid_search
from src.reranker import rerank
from src.web_search import perform_web_search

# ─── Deep Research Agentic Loop ───────────────────────────────────────────────

class SubQueries(BaseModel):
    queries: list[str]


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


def _merge_unique_chunks(chunks: list[dict]) -> list[dict]:
    """Keep the best chunk per (source, id) pair and sort by rerank score."""
    merged = {}
    for chunk in chunks:
        key = (chunk.get("source"), chunk.get("id"))
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

async def perform_deep_research(request, history, style_name, intent, intent_info, language, client, yield_event, cache_key, events_to_cache, query_cache):
    """
    Executes the Deep Autonomous Research agentic loop.
    1. Decompose query into 3-4 sub-queries using LLM + structured output.
    2. Concurrently run web search & RAG for each sub-query.
    3. Aggregate all results.
    4. Synthesize final answer.
    """
    
    # ── Step 1: Decompose Query ───────────────────────────────────────────────
    await yield_event(f"data: {json.dumps({'status_text': '🧠 Decomposing query for deep analysis...'})}\n\n")

    DECOMPOSITION_TIMEOUT = 20
    RELATED_QUESTIONS_TIMEOUT = 15
    SYNTHESIS_START_TIMEOUT = 30
    STREAM_CHUNK_TIMEOUT = 30

    # Start fetching related questions concurrently
    async def fetch_related_questions():
        try:
            sys_r = "You are an AI research assistant. Based on the user's complex query, suggest exactly 3 short, relevant follow-up questions they could ask to learn more. Output ONLY a JSON object with a single key 'questions' containing an array of 3 strings."
            if language == "ur":
                sys_r += " The user's query is in Urdu, so the follow-up questions MUST be in Urdu."
            resp = await asyncio.wait_for(client.chat.completions.create(
                model=rag.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": sys_r},
                    {"role": "user", "content": request.question},
                ],
                temperature=0.3,
                max_tokens=200,
                response_format={"type": "json_object"}
            ), timeout=RELATED_QUESTIONS_TIMEOUT)
            parsed = json.loads(resp.choices[0].message.content)
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
    
    # Fallback to simple queries if decomposition fails
    sub_queries = [request.question, f"Recent developments in {request.question}"]
    
    try:
        decomposition_response = await asyncio.wait_for(client.chat.completions.create(
            model=rag.GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.question},
            ],
            temperature=0.1,
            max_tokens=200,
            response_format={"type": "json_object"}
        ), timeout=DECOMPOSITION_TIMEOUT)
        
        raw_json = decomposition_response.choices[0].message.content
        parsed = json.loads(raw_json)
        if "queries" in parsed and isinstance(parsed["queries"], list):
            sub_queries = parsed["queries"][:3]
    except Exception as e:
        print(f"  [Deep Research] Query decomposition failed: {e}")
        # Proceed with fallback

    sub_queries = _dedupe_subqueries(sub_queries, request.question, limit=3)

    await yield_event(f"data: {json.dumps({'status_text': f'🔬 Investigating {len(sub_queries)} analytical angles...'})}\n\n")

    # ── Step 2: Parallel RAG & Web Search for Sub-Queries ─────────────────────
    loop = asyncio.get_event_loop()
    
    all_passing_chunks = []
    all_web_results = []
    
    async def investigate_subquery(sq, idx):
        await asyncio.sleep(idx * 0.1) # stagger slightly to avoid instantaneous rate limits
        await yield_event(f"data: {json.dumps({'status_text': f'🔍 Investigating: {sq}'})}\n\n")
        
        # RAG
        try:
            q_vec = await loop.run_in_executor(rag._executor, get_embedding, sq, True)
            cands = await loop.run_in_executor(rag._executor, hybrid_search, q_vec, sq)
            if cands:
                reranked = await loop.run_in_executor(rag._executor, rerank, sq, cands, 4) # keep the best few per subquery
                should_refuse, _, passing = rag.check_guardrails(reranked)
                if not should_refuse:
                    all_passing_chunks.extend(passing[:4])
        except Exception as e:
            print(f"  [Deep Research] RAG error for '{sq}': {e}")
            
        # Web
        if rag.WEB_ALWAYS_ON:
            try:
                web = await loop.run_in_executor(rag._executor, perform_web_search, sq, 3)
                all_web_results.extend(web)
            except Exception as e:
                print(f"  [Deep Research] Web error for '{sq}': {e}")

    # Run investigations concurrently
    await asyncio.gather(*(investigate_subquery(sq, i) for i, sq in enumerate(sub_queries)))

    await yield_event(f"data: {json.dumps({'status_text': '⚡ Synthesizing deep research report...'})}\n\n")

    # Deduplicate chunks and web results
    unique_chunks = _merge_unique_chunks(all_passing_chunks)
    unique_web = _merge_unique_web_results(all_web_results)

    # Keep the prompt compact and focused on the strongest evidence.
    unique_chunks = unique_chunks[:12]
    unique_web = unique_web[:8]
            
    # ── Step 3: Synthesis ─────────────────────────────────────────────────────
    # Use standard fused prompt but with a HUGE context window
    sys_c, usr_c = rag.build_fused_prompt(
        request.question,
        unique_chunks,
        unique_web,
        history=history,
        answer_style=style_name,
    )
    
    # Enforce detailed styling for deep research
    if "executive summary" not in sys_c.lower():
        sys_c += "\n\nCRITICAL DIRECTIVE: This is a DEEP RESEARCH REPORT. You MUST structure the response with an Executive Summary, a detailed analysis of findings, and a final conclusion. Use extensive markdown formatting."

    if language == "ur":
        sys_c += "\n\nCRITICAL DIRECTIVE: The user is speaking Urdu. You MUST reply completely in native Urdu language (using Urdu script), ensuring high-quality formatting and correct terminology."

    effective_max_tokens = min(
        rag.ANSWER_STYLES.get(style_name, {}).get("max_tokens", 4000),
        4000 # allow massive output for deep research
    )

    try:
        groq_stream = await asyncio.wait_for(client.chat.completions.create(
            model=rag.GROQ_MODEL,
            messages=[
                {"role": "system", "content": sys_c},
                {"role": "user",   "content": usr_c},
            ],
            temperature=rag.LLM_TEMPERATURE,
            max_tokens=effective_max_tokens,
            stream=True,
        ), timeout=SYNTHESIS_START_TIMEOUT)

        token_count = 0
        while True:
            try:
                chunk = await asyncio.wait_for(groq_stream.__anext__(), timeout=STREAM_CHUNK_TIMEOUT)
            except StopAsyncIteration:
                break
            except asyncio.TimeoutError:
                print("  [Deep Research] Stream stalled; falling back to single-shot synthesis")
                break

            token = chunk.choices[0].delta.content or ""
            if token:
                token_count += 1
                await yield_event(f"data: {json.dumps({'token': token})}\n\n")
                if token_count % 20 == 0:
                    await asyncio.sleep(0)

        if token_count == 0:
            print("  [Deep Research] No streamed tokens received; using fallback completion")
            fallback_answer = await asyncio.to_thread(rag.call_groq, sys_c, usr_c, effective_max_tokens)
            if fallback_answer:
                await yield_event(f"data: {json.dumps({'token': fallback_answer})}\n\n")

    except Exception as e:
        print(f"  [Deep Research] Synthesis error: {e}")
        try:
            fallback_answer = await asyncio.to_thread(rag.call_groq, sys_c, usr_c, effective_max_tokens)
            if fallback_answer:
                await yield_event(f"data: {json.dumps({'token': fallback_answer})}\n\n")
        except Exception as fallback_err:
            await yield_event(f"data: {json.dumps({'error': f'Deep Research Synthesis failed: {str(fallback_err)}'})}\n\n")
            return

    # ── Step 4: Final Metadata ────────────────────────────────────────────────
    rag_sources = list({c["source"] for c in unique_chunks})
    web_sources = [r["url"] for r in unique_web if r.get("url")]
    web_titles  = [r["title"] for r in unique_web if r.get("title")]
    
    rag_source_details = []
    for src in rag_sources:
        src_chunks = [c for c in unique_chunks if c["source"] == src]
        top_score  = max((c.get("rerank_score", -99) for c in src_chunks), default=-99)
        rag_source_details.append({
            "source":     src,
            "chunks":     len(src_chunks),
            "confidence": rag.source_confidence_score(top_score),
        })

    related_questions = await related_task
    await yield_event(f"data: {json.dumps({'done': True, 'sources': rag_sources + web_titles, 'web_sources': web_sources, 'web_results': unique_web, 'rag_source_details': rag_source_details, 'is_web_fallback': False, 'refused': False, 'intent': intent, 'intent_info': intent_info, 'language': language, 'related_questions': related_questions})}\n\n")
    
    # Save to cache
    query_cache.put(cache_key, events_to_cache)
