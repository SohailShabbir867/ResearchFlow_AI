# Scaling Roadmap — Working Prompt

> **How to use this document:** Copy the prompt block under each phase into your AI agent (ZCode, Claude, Cursor, etc.) or hand it to a developer. Each phase is self-contained, ordered by leverage, and includes the exact files to touch, the acceptance criteria, and the "definition of done."

---

## Project Context (paste at the top of every agent session)

```
You are working on "medresearch-ai", a medical research RAG application.

Stack:
- Frontend: React 18 + Redux Toolkit + Vite + Tailwind (frontend/)
- Backend (BFF): Node.js + Express + MongoDB/Mongoose (backend-node/src/)
- Backend (RAG): Python FastAPI + FastEmbed (ONNX) + Qdrant + Groq LLM (backend-python/src/)

Request flow:
  React → Node /api/research/chats/:id/stream (SSE proxy)
       → Python /stream (embed → hybrid search → rerank → Groq stream → guardrails)
       → tokens streamed back through Node to the browser

Key files:
- backend-python/src/rag_pipeline.py   — answer(), build_prompt(), call_groq()
- backend-python/src/api.py            — FastAPI endpoints, /stream SSE generator
- backend-python/src/hybrid_search.py  — vector + BM25 + RRF
- backend-python/src/reranker.py       — cross-encoder rerank
- backend-python/src/embedder.py       — FastEmbed ONNX, has in-process cache
- backend-python/src/vector_store.py   — Qdrant client
- backend-node/src/routes/research.js  — SSE proxy + Mongo persistence
- backend-node/src/models/             — Mongoose models (Chat, QueryLog, User)
- frontend/src/pages/Research.jsx      — main chat UI, streams SSE

Note: The RAG backend can switch LLM providers via the `LLM_PROVIDER` env var
(`groq` or `gemini`). Configure keys in `backend-python/.env` (see
`backend-python/.env.example`) and never commit real API keys to git.

Constraints:
- Do NOT break the existing streaming UX or the 3-layer guardrails.
- Match existing code style (the repo uses inline CSS vars + Tailwind utilities).
- Every change must keep light/dark mode working.
- Run the frontend build (npm run build) and python -c "ast.parse" before declaring done.
```

---

## PHASE 1 — Quick Wins (highest leverage, lowest effort)

### 1.1 Pool the Groq & Qdrant clients (BUG FIX — do this first)

```
TASK: Eliminate per-request client instantiation in the Python backend.

PROBLEM: backend-python/src/api.py creates `Groq(api_key=...)` inside the
stream generator on EVERY request (see stream_query). Same risk for the
Qdrant client in vector_store.py. This adds latency, leaks connections,
and breaks connection reuse / keep-alive.

REQUIREMENTS:
1. Instantiate ONE Groq client at module load (api.py top-level), reuse it.
2. Ensure the Qdrant client in vector_store.py is a singleton (lazy-init module
   global with a get_qdrant_client() accessor), not created per call.
3. Add a shared httpx.Client with keep-alive for any direct HTTP calls.
4. Do not change the function signatures of answer() / stream_query().

ACCEPTANCE:
- `grep -rn "Groq(api_key" backend-python/src` returns exactly ONE match.
- A streaming query still works end-to-end (tokens arrive, sources attached).
- `python -c "import ast; ast.parse(open('src/api.py').read())"` passes.

DO NOT: move secrets into code. Keep using os.getenv("GROQ_API_KEY").
```

### 1.2 Semantic query cache (the single biggest win)

```
TASK: Cache the expensive retrieval stage so repeated/near-identical questions
skip embed → hybrid search → rerank.

PROBLEM: Every query re-runs ONNX embedding + BM25 + vector search + cross-encoder
rerank on ~20 candidates. Medical questions have huge overlap; this is wasted work.

DESIGN:
- Add a Redis-backed cache (fall back to in-memory dict + TTL if Redis unavailable).
- Cache key = hash(normalized_question + answer_style + chat_history_hash).
  Normalize = lowercase, strip, collapse whitespace.
- Cache VALUE = { reranked_chunks, sources, refuse_reason, refused }.
- TTL: 1 hour default, configurable via QUERY_CACHE_TTL env var.
- Cache ONLY the retrieval/guardrail result (steps 2-5 of answer()).
  Still call the LLM fresh so answers vary with conversation context.
- Optional exact-match fast path: if the EXACT same question+history was asked,
  return the cached final answer too (saves the Groq call). Gate behind
  EXACT_ANSWER_CACHE env var (default off).

WHERE: backend-python/src/rag_pipeline.py — wrap the retrieval block in answer().
       Add new file backend-python/src/cache.py with a Cache class.

ACCEPTANCE:
- Second identical query logs "[Cache] HIT" and skips embed/search/rerank.
- Timing dict shows embed_ms=0, search_ms=0, rerank_ms=0 on cache hits.
- Cache misses behave exactly as before (no regressions).
- Works with REDIS_URL unset (in-memory fallback) so local dev still runs.

DO NOT: cache refused answers incorrectly — cache refusals too so they're fast.
```

### 1.3 MongoDB indexes + TTL (prevents future slowdowns)

```
TASK: Add the indexes the admin dashboards will need before they get slow.

REQUIREMENTS (backend-node/src/models/ or a migration script):
1. Chat: compound index { userId: 1, updatedAt: -1 } — speeds chat list.
2. QueryLog: { userId: 1, createdAt: -1 } and { createdAt: 1 } (TTL-ready).
3. QueryLog: TTL index on createdAt, expireAfterSeconds = 90 days
   (configurable via QUERY_LOG_TTL_DAYS env). Use a separate migration script
   backend-node/src/scripts/addIndexes.js so it's runnable idempotently.
4. User: index on email (unique) if not already present.

ACCEPTANCE:
- Running the script twice does not error (idempotent).
- db.chat.getIndexes() shows the new compound index.

DO NOT: drop existing indexes. Only ADD.
```

---

## PHASE 2 — Throughput & Background Work

### 2.1 Multiple Python RAG workers

```
TASK: Run the FastAPI RAG service with multiple workers for horizontal scale.

REQUIREMENTS:
1. Confirm the app is stateless enough to run multi-worker (no module-level
   mutable request state). Audit api.py + rag_pipeline.py.
2. Switch the start command from `uvicorn src.api:app` to
   `gunicorn -k uvicorn.workers.UvicornWorker -w <N> src.api:app`
   where N comes from WORKERS env (default 2 * CPU count, capped at 8).
3. Update docker-compose.yml and any start scripts. Document the WORKERS env var
   in backend-python/.env.example.
4. Verify the in-memory embedding cache still helps (note: per-worker, not shared
    — that's fine, Redis from Phase 1.2 is the shared layer).

ACCEPTANCE:
- `docker-compose up` starts N workers; logs show multiple boot lines.
- A load test (e.g. 20 concurrent /stream requests) shows requests spread across
  workers (check logs for different PIDs).

DO NOT: enable workers > 1 if the ONNX models don't load thread-safely — verify
FastEmbed is called sequentially per worker or is confirmed thread-safe first.
```

### 2.2 Async document ingestion queue

```
TASK: Move PDF/TXT/DOCX parsing + embedding + indexing OFF the request thread.

PROBLEM: backend-python/src/api.py /upload does parse→chunk→embed→Qdrant
synchronously. One large PDF blocks the whole API for everyone.

DESIGN:
- Add a lightweight job queue. Use RQ (Redis Queue) since Python already needs
  Redis after Phase 1.2 — keep the stack tight.
- New endpoint POST /upload returns immediately with { job_id, status: "queued" }.
- New endpoint GET /upload/jobs/:job_id returns progress { status, chunks_done,
  chunks_total, error? }.
- Worker process: backend-python/src/worker.py (rq worker).
- Frontend (frontend/src/pages/Documents.jsx or Research.jsx upload box): poll
  the job endpoint every 1.5s and show "Indexing chunk 14/120…" progress bar.

ACCEPTANCE:
- Uploading a 50-page PDF returns < 500ms from the HTTP call.
- Progress UI updates as chunks index.
- A failed job is retryable and surfaces the error to the UI.

DO NOT: lose the existing guardrail/formatting logic. The worker reuses the same
chunker + embedder + vector_store modules.
```

### 2.3 Rate limiting + plan enforcement

```
TASK: Enforce per-user and per-plan rate limits at the Node gateway.

REQUIREMENTS (backend-node/src/middleware/):
1. express-rate-limit (or custom token bucket) middleware on /api/research/*.
2. Limits from user plan:
   - Free: 20 queries/hour, 100/day
   - Pro: 200 queries/hour, unlimited/day
   (Values configurable via env.)
3. Return HTTP 429 with { error, retryAfter } and a clear message the frontend
   renders (add a Toast in frontend/src/components/ui/Toast.jsx usage).
4. The existing User.queryCount field should be incremented (already is) AND
   checked against the plan limit before processing.

ACCEPTANCE:
- A free user hitting the 21st query in an hour gets a polite 429 + toast.
- Pro users are not affected at normal usage.

DO NOT: rate limit auth or static routes.
```

---

## PHASE 3 — Data Isolation & Resilience

### 3.1 Multi-tenant Qdrant isolation

```
TASK: Isolate document chunks per tenant/workspace so one org can't retrieve
another's data, and so collections stay queryable at scale.

DESIGN:
- Decide: payload-filtering vs per-tenant collection.
  RECOMMENDED: payload field tenant_id on every point + a named vector index,
  filtered at query time. Switch to per-tenant collections only if a single
  tenant exceeds ~1M chunks.
- Add tenant_id (derive from user.workspaceId or userId for solo users) to every
  chunk at ingest time (vector_store.upsert + chunker).
- Enforce the tenant filter in EVERY hybrid_search / vector query call. Make it
  impossible to query without a filter (require the arg).
- Add a payload index in Qdrant on tenant_id and source.

ACCEPTANCE:
- User A cannot retrieve User B's chunks (write a test with two tenants).
- Deleting a document only removes that tenant's points.

DO NOT: ship without the filter enforced — a missing filter = data leak.
```

### 3.2 LLM provider abstraction + fallback

```
TASK: Stop being 100% coupled to Groq. Add a fallback so a Groq outage doesn't
take the app down.

DESIGN:
- New file backend-python/src/llm_provider.py with a unified interface:
    def stream(prompt, max_tokens, style) -> Iterator[str]
- Implementations: GroqProvider, OpenAIProvider, TogetherProvider.
  Each reads its own API key from env; only configured ones are active.
- Provider order from env LLM_PROVIDERS (default "groq").
- On 429 or 5xx from the primary, automatically fail over to the next.
- Keep streaming semantics identical (yield token strings).
- call_groq() and the /stream generator both go through this layer.

ACCEPTANCE:
- With GROQ_API_KEY invalid + OPENAI_API_KEY set, a query still streams an answer.
- Logs show "[LLM] groq failed (429), failing over to openai".

DO NOT: change the SSE wire format the frontend consumes.
```

### 3.3 Observability with OpenTelemetry

```
TASK: Make query performance visible so you can find bottlenecks before users do.

REQUIREMENTS:
1. Add opentelemetry-sdk to backend-python; auto-instrument FastAPI + httpx.
2. Create a span per RAG stage: embed, hybrid_search, rerank, llm, guardrail.
   Use the timing data already computed in rag_pipeline.py as a starting point.
3. Export to console by default; OTLP exporter endpoint via OTEL_EXPORTER_OTLP_ENDPOINT.
4. Add three RED metrics counters (requests, errors, duration) on /stream.
5. Surface a /metrics endpoint (Prometheus format) so Grafana can scrape.

ACCEPTANCE:
- A single query produces a trace with 5 child spans and correct durations.
- /metrics returns the three counters incrementing per request.

DO NOT: let tracing add > 5% overhead — sample at 100% only in dev, 10% in prod.
```

---

## PHASE 4 — Infrastructure & Quality

### 4.1 Container orchestration (move off single-host Compose)

```
TASK: Define production deployment artifacts for horizontal scaling.

REQUIREMENTS:
1. Keep docker-compose.yml for local dev.
2. Add deployment templates: choose ONE target —
   a) Kubernetes: k8s/ dir with Deployments (node, python, worker), Services,
      HPA on CPU for python, Secrets for API keys, managed Mongo/Qdrant via
      ExternalName services.
   b) PaaS (Render/Railway/Fly): render.yaml or fly.toml with one service per
      component and autoscaling enabled.
3. State the scaling characteristics of each service in README.md
   (node = stateless scale-any; python = stateless scale-any; worker = scale by
    queue depth; mongo/qdrant = managed).

ACCEPTANCE:
- A reviewer can deploy by following README.md without asking questions.
- python service HPA/PaaS autoscale triggers under load.

DO NOT: bake secrets into images. Use env injection / secrets manager.
```

### 4.2 Eval harness (regression safety net)

```
TASK: Before the prompt/model changes again, lock in quality with an eval set.

DESIGN:
- backend-python/eval/golden_set.jsonl — 20-30 (question, expected_keywords[],
  must_not_contain[]) triples curated from real queries.
- backend-python/eval/run_eval.py: runs each question through the pipeline
  (non-streaming /query), checks keyword presence + guardrail correctness,
  prints a pass/fail report with scores.
- Wire into CI (GitHub Action) so prompt/embedding/model changes are gated.

ACCEPTANCE:
- `python eval/run_eval.py` prints a scorecard and exits non-zero on regression.
- At least 80% of golden cases pass on the current prompt.

DO NOT: make the eval set require live Groq if a GROQ_API_KEY isn't present —
skip and warn, don't fail CI on missing credentials.
```

---

## Suggested Execution Order

```
Week 1:    1.1 Pool clients  →  1.2 Semantic cache  →  1.3 Mongo indexes
Week 2-3:  2.1 Multi-worker Python  →  2.3 Rate limiting
Week 3-4:  2.2 Async upload queue
Month 2:   3.1 Multi-tenant Qdrant  →  3.2 LLM fallback  →  3.3 Observability
Month 3:   4.1 K8s/PaaS deployment  →  4.2 Eval harness
```

**Rule of thumb:** never run Phase 3 or 4 work without having done Phase 1.
Phase 1 is where 80% of the latency/cost wins live for the least effort.

---

## Quick-Start Prompt (copy-paste to begin)

```
Read SCALING_ROADMAP.md in the repo root. Start with Phase 1.1 (Pool the Groq
& Qdrant clients). Follow the requirements, acceptance criteria, and "DO NOT"
constraints exactly. When done, run `npm run build` in frontend/ and
`python -c "import ast; ast.parse(open('backend-python/src/api.py').read())"`
to verify, then summarize what changed and move on to Phase 1.2.
```
