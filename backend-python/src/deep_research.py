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

    # Start fetching related questions concurrently
    async def fetch_related_questions():
        try:
            sys_r = "You are an AI research assistant. Based on the user's complex query, suggest exactly 3 short, relevant follow-up questions they could ask to learn more. Output ONLY a JSON object with a single key 'questions' containing an array of 3 strings."
            if language == "ur":
                sys_r += " The user's query is in Urdu, so the follow-up questions MUST be in Urdu."
            resp = await client.chat.completions.create(
                model=rag.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": sys_r},
                    {"role": "user", "content": request.question},
                ],
                temperature=0.3,
                max_tokens=200,
                response_format={"type": "json_object"}
            )
            parsed = json.loads(resp.choices[0].message.content)
            return parsed.get("questions", [])[:3]
        except Exception as e:
            print(f"  [Deep Research] Related Questions Error: {e}")
            return []

    related_task = asyncio.create_task(fetch_related_questions())
    
    system_prompt = (
        "You are an expert research assistant. Break down the user's complex query into "
        "3 distinct, highly targeted search sub-queries to maximize information retrieval "
        "across both scientific databases and the live web. Output JSON with a 'queries' array of strings."
    )
    
    # Fallback to simple queries if decomposition fails
    sub_queries = [request.question, f"Recent developments in {request.question}"]
    
    try:
        decomposition_response = await client.chat.completions.create(
            model=rag.GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.question},
            ],
            temperature=0.1,
            max_tokens=200,
            response_format={"type": "json_object"}
        )
        
        raw_json = decomposition_response.choices[0].message.content
        parsed = json.loads(raw_json)
        if "queries" in parsed and isinstance(parsed["queries"], list):
            sub_queries = parsed["queries"][:3]
    except Exception as e:
        print(f"  [Deep Research] Query decomposition failed: {e}")
        # Proceed with fallback

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
                reranked = await loop.run_in_executor(rag._executor, rerank, sq, cands, 5) # top 5 per subquery
                should_refuse, _, passing = rag.check_guardrails(reranked)
                if not should_refuse:
                    all_passing_chunks.extend(passing)
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
    unique_chunks_dict = {c["id"]: c for c in all_passing_chunks}
    unique_chunks = list(unique_chunks_dict.values())
    
    unique_web_urls = set()
    unique_web = []
    for w in all_web_results:
        if w.get("url") not in unique_web_urls:
            unique_web_urls.add(w.get("url"))
            unique_web.append(w)
            
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
        groq_stream = await client.chat.completions.create(
            model=rag.GROQ_MODEL,
            messages=[
                {"role": "system", "content": sys_c},
                {"role": "user",   "content": usr_c},
            ],
            temperature=rag.LLM_TEMPERATURE,
            max_tokens=effective_max_tokens,
            stream=True,
        )

        token_count = 0
        async for chunk in groq_stream:
            token = chunk.choices[0].delta.content or ""
            if token:
                token_count += 1
                await yield_event(f"data: {json.dumps({'token': token})}\n\n")
                if token_count % 20 == 0:
                    await asyncio.sleep(0)

    except Exception as e:
        await yield_event(f"data: {json.dumps({'error': f'Deep Research Synthesis failed: {str(e)}'})}\n\n")
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
