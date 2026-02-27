# AI Showcase: Implementation Record

> Status: **Implemented**
> Branch: `1001-next-big-step`

This records what was built for the AI showcase: provider integration, chat, streaming, and a three-tier RAG pipeline.

---

## What Was Built

An AI showcase covering provider configuration, streaming chat, and a full retrieval-augmented generation (RAG) pipeline with real-time trace visualization.

### Route Structure

```
/showcases/ai/
├── connection/             → Provider health check, latency, env var checklist
├── chat/                   → Multi-turn streaming chat with conversation persistence
├── streaming/              → Raw stream demo with TTFT/tokens-per-second metrics
└── retrieval/
    ├── ingest/             → Document upload, chunking stats, document list
    ├── chat/               → RAG-augmented chat with pipeline trace drawer
    ├── contextual/         → Contextual retrieval (Tier 1) explanation
    ├── parent-child/       → Parent-child retrieval (Tier 2) explanation
    └── graph/              → Graph-expanded retrieval (Tier 3) explanation
```

All routes require authentication. All retrieval routes show an info alert when no AI provider is configured.

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `ai` | `^4.x` | Vercel AI SDK core (`streamText`, `generateText`, `embed`, `embedMany`, `createDataStreamResponse`) |
| `@ai-sdk/groq` | `^1.x` | Groq provider (Llama 3.3 70B) |
| `@ai-sdk/openai` | `^1.x` | OpenAI provider (GPT-4o-mini) |
| `@ai-sdk/google` | `^1.x` | Google provider (Gemini 2.0 Flash) + embeddings |
| `@ai-sdk/svelte` | `^1.x` | `Chat` class for client-side streaming |

---

## AI Layer

```
src/lib/server/ai/
├── index.ts          # Module-level singleton: chatModel, aiConfigured, activeProviderInfo
├── config.ts         # Rate limit constants, SYSTEM_PROMPT
├── providers.ts      # ProviderEntry, buildProviderRegistry(), resolveActiveProvider()
├── errors.ts         # AIError, classifyAIError(), aiErrorToStatus()
├── types.ts          # AIConnectionInfo, AIProviderStatus
├── validation.ts     # ChatRequestSchema, StreamingRequestSchema (Valibot)
└── showcase/
    └── queries.ts    # verifyAIConnection(), getProviderStatuses()
```

### Provider Resolution

Provider priority: `AI_PROVIDER` env var → first configured provider found.

```typescript
// Env vars checked at runtime ($env/dynamic/private)
GROQ_API_KEY         → Groq, llama-3.3-70b-versatile
OPENAI_API_KEY       → OpenAI, gpt-4o-mini
GOOGLE_GENERATIVE_AI_API_KEY → Google Gemini, gemini-2.0-flash
AI_PROVIDER          → optional override (e.g. "groq", "openai", "google")
```

All three providers can be configured simultaneously. The active one handles requests; others serve as automatic fallbacks for transient errors (`unavailable`, `timeout`, `rate_limit`, `unknown`).

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ai/chat` | POST | Streaming chat, conversation persistence, optional RAG |
| `/api/ai/streaming` | POST | Raw stream endpoint (no conversation persistence) |
| `/api/ai/conversations` | GET | List user conversations |
| `/api/ai/conversations/[id]` | GET/DELETE | Get or delete a conversation |

Both chat and streaming endpoints apply per-user rate limiting via Upstash Redis.

---

## Showcase Pages

### Connection (`/showcases/ai/connection`)

- Calls `verifyAIConnection()` on load — a lightweight `generateText` call with `maxTokens: 5`
- Displays latency, active model, and status of all configured providers
- `retest` form action re-runs the check
- Requires auth (redirects to `/auth/login` if not signed in)

### Chat (`/showcases/ai/chat`)

- Uses `@ai-sdk/svelte`'s `Chat` class pointing at `/api/ai/chat`
- Client-side auto-scroll on new messages using `requestAnimationFrame`
- Inline error messages mapped from HTTP status codes (429, 401, 503)
- Typing indicator with bounce animation while streaming
- Conversations are created automatically on first message; messages are persisted to Postgres

### Streaming (`/showcases/ai/streaming`)

- Picks a preset prompt and POSTs to `/api/ai/streaming`
- Manually parses the AI SDK data stream format (`0:` prefix lines)
- Tracks and displays: **TTFT** (time to first token), tokens/second, total chunks, elapsed time
- Blinking cursor while stream is active

---

## RAG Pipeline

### Ingestion (`/showcases/ai/retrieval/ingest`)

The ingestion pipeline runs on document submit:

```
text input
  → chunkDocument()       — hierarchical chunking (section + paragraph levels)
  → addContextPrefixes()  — LLM generates a 1-sentence context prefix per child chunk
  → generateEmbeddings()  — batch embed child chunks via Google text-embedding-004 (1536 dims)
  → INSERT rag.chunk      — stored in Postgres with pgvector embedding column
  → extractEntitiesFromSections() — LLM extracts entities + relationships from parent chunks
  → storeEntitiesAndRelationships() — written to Neo4j
```

Chunking is hierarchical: **parent chunks** (section-level, ~512 tokens) contain **child chunks** (paragraph-level, ~128 tokens with 20-token overlap). Parents store no embeddings — they are context containers only. Children carry the embeddings and are embedded with their context prefix prepended.

Entity extraction during ingestion uses the active chat model (`generateText`). It produces structured JSON: entities (name, type, description) and relationships (source, target, type, weight). If Neo4j is unavailable, ingestion continues — graph storage is explicitly non-critical.

### Retrieval (`/showcases/ai/retrieval/chat`)

Single entry point: `retrieve(query, options, onEvent?)`.

Three tiers, selectable per-request:

| Tier | Strategy | How it works |
|------|----------|--------------|
| 1 (Contextual) | Hybrid vector + BM25 → RRF | pgvector cosine search + `ts_rank_cd` full-text search, fused via reciprocal rank fusion |
| 2 (Parent-child) | Small-to-big | Searches child paragraph chunks for precision, returns their parent section chunks for context |
| 3 (Graph) | Seed + graph expand | Seeds from top-3 vector hits, expands via Neo4j entity traversal (max 2 hops), decays graph-discovered scores by 0.7× |

Multi-tier results are fused again with RRF across tier groups before being assembled into the LLM system prompt.

The RAG chat page uses `createDataStreamResponse` to emit **pipeline events** as message annotations alongside the token stream. A "Trace" chip opens a bottom drawer (`RagPipeline` component) showing per-step timing and the chunks retrieved at each tier.

### Database Schema

Two schemas in Postgres:

**`rag` schema:**

| Table | Purpose |
|-------|---------|
| `rag.document` | Ingested documents (soft-deletable, user-scoped, status lifecycle) |
| `rag.chunk` | Hierarchical text segments with pgvector `embedding` column (1536 dims), `tsvector` search_vector (via migration), parent-child references |
| `rag.embedding_model` | Embedding model registry |
| `rag.collection` | Document collections (not yet wired to showcase UI) |

**`ai` schema:**

| Table | Purpose |
|-------|---------|
| `ai.conversation` | Chat conversations (user-scoped) |
| `ai.message` | Persisted messages (role: user/assistant/system) |

The `chunk` table carries an HNSW vector index (added via migration, not Drizzle schema) and a GIN index on `search_vector` for BM25.

### Retrieval API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/retrieval/ingest` | POST | Run the ingestion pipeline |
| `/api/retrieval/documents` | GET | List user's documents |
| `/api/retrieval/documents/[id]` | DELETE | Soft-delete a document |
| `/api/retrieval/search` | POST | Direct retrieval search (bypasses chat) |

---

## Error Handling

**AI errors** — `classifyAIError()` maps provider errors to `AIErrorKind`:

| Kind | HTTP status | Triggers fallback? |
|------|-------------|--------------------|
| `authentication` | 502 | No |
| `rate_limit` | 429 | Yes |
| `model` | 502 | No |
| `context_length` | 400 | No |
| `timeout` | 504 | Yes |
| `unavailable` | 503 | Yes |
| `unknown` | 500 | Yes |

**Retrieval errors** — `RetrievalError` with kind: `embedding`, `storage`, `graph`, `ingestion`, `not_found`, `limit_exceeded`, `timeout`.

---

## Design Decisions

**`$env/dynamic/private` for provider API keys** — keys are checked at runtime, not build time. The provider registry is built once at module load; `chatModel` is a module-level singleton.

**Embedding model is always Google** — embedding is hardcoded to `text-embedding-004` via `GOOGLE_GENERATIVE_AI_API_KEY`, regardless of which chat provider is active. The chat provider and embedding provider are intentionally separate concerns.

**Context prefix approach** — follows Anthropic's recommended pattern: generate a 1-sentence context sentence per chunk during ingestion and prepend it before embedding. Fallback is `From "{title}":` if the LLM call fails.

**Pipeline events via message annotations** — the retrieval chat page uses `createDataStreamResponse` + `dataStream.writeMessageAnnotation()` to stream structured pipeline events (step timing, chunks found) alongside the text. The client reads `lastMsg.annotations` to update the trace UI in real time.

**Graph hops hard-capped at 2** — `expandViaGraph` enforces `Math.min(maxHops, 2)` regardless of what the caller requests. Beyond 2 hops the graph explodes in size with diminishing relevance.

---

## ⚠️ Gotchas

### HNSW index and `search_vector` are not in Drizzle schema

The pgvector HNSW index and the `tsvector` column (`search_vector`) on `rag.chunk` must be created via raw SQL migration — Drizzle does not support HNSW index creation or computed `tsvector` columns in its schema DSL (as of drizzle-kit 0.31). Pushing the schema alone is not enough.

Required SQL (run after `drizzle-kit push`):

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Add HNSW index
CREATE INDEX IF NOT EXISTS chunk_embedding_hnsw_idx
  ON rag.chunk USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Add tsvector column and GIN index
ALTER TABLE rag.chunk ADD COLUMN IF NOT EXISTS
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX IF NOT EXISTS chunk_search_vector_idx
  ON rag.chunk USING gin (search_vector);
```

### Entity extraction is prompt-injection-sensitive

The extraction prompt includes document text verbatim. Entity names are validated against an allowlist of types and filtered for injection-like patterns (`ignore`, `system:`, `instruction`, `prompt`). Names over 100 chars are truncated.

### Contextual prefix generation is sequential, not parallel

`addContextPrefixes()` processes chunks sequentially to stay within provider rate limits. For large documents this is the dominant cost during ingestion. The cap `MAX_CHUNKS_PER_DOCUMENT` limits how many child chunks receive LLM-generated prefixes.

### Graph retrieval degrades gracefully

`searchGraph()` wraps the Neo4j `expandViaGraph` call in a try/catch. If Neo4j is unavailable, tier 3 returns only the seed chunks from the vector search — the query still completes.

---

## References

- Stack docs: `docs/stack/ai/ai-sdk.md`, `docs/stack/data/postgres.md`, `docs/stack/data/neo4j.md`
- Memory: `memory/retrieval-architecture.md`
- Showcase live: `/showcases/ai`
