# RAG Pipeline

Retrieval-Augmented Generation patterns for the Velociraptor project. The project uses a three-tier recursive retrieval system with PostgreSQL (pgvector) + Neo4j (Aura).

## Pipeline Architecture

```
Query → Embed → Search (multi-tier parallel) → Fuse (RRF) → Rank → Assemble Context → LLM
```

Each stage is independently testable and tunable. The existing implementation lives in `src/lib/server/retrieval/`.

## Hybrid Search (Vector + Keyword + Graph)

Pure vector search misses exact matches (function names, error codes, version numbers). Pure keyword search misses semantic relationships. Production standard is hybrid:

### Tier 1: Contextual Vector Search

```typescript
// src/lib/server/retrieval/tiers/contextual.ts
// pgvector cosine similarity search with contextual embeddings
const chunks = await searchContextual(query, queryEmbedding, maxChunks, userId);
```

### Tier 2: Parent-Child Retrieval

```typescript
// src/lib/server/retrieval/tiers/parent-child.ts
// Fine-grained chunks for retrieval precision, parent sections for context
const chunks = await searchParentChild(queryEmbedding, maxChunks, userId);
```

### Tier 3: Graph-Enhanced Retrieval

```typescript
// src/lib/server/retrieval/tiers/graph.ts
// Vector seeds → entity extraction → Neo4j graph traversal → content fetch
const chunks = await searchGraph(queryEmbedding, maxChunks, graphDepth, userId);
```

### Adding BM25 Keyword Search (Gap)

The current implementation is missing keyword/BM25 search. PostgreSQL supports this natively via `tsvector`:

```sql
-- Add to existing document_embeddings table
ALTER TABLE document_embeddings ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX idx_search_vector ON document_embeddings USING GIN (search_vector);

-- Query
SELECT id, title, content,
  ts_rank(search_vector, plainto_tsquery('english', $1)) AS bm25_score
FROM document_embeddings
WHERE search_vector @@ plainto_tsquery('english', $1)
ORDER BY bm25_score DESC LIMIT 30;
```

This would become a new tier or augment Tier 1 as a hybrid within a single tier.

## Reciprocal Rank Fusion (RRF)

Merges results from multiple retrieval sources without needing score normalization:

```typescript
// src/lib/server/retrieval/rank.ts
// RRF formula: score = Σ 1 / (k + rank_i + 1)
// k = 60 (community standard, project uses RRF_K = 60)
```

RRF is pure in-memory O(n) computation. Tiers run in parallel (`Promise.all`), results are fused after all return.

## Chunking Strategy

### Current Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `SECTION_CHUNK_TARGET` | 1000 tokens | Parent chunks for context provision |
| `PARAGRAPH_CHUNK_TARGET` | 300 tokens | Child chunks for precision retrieval |
| `CHUNK_OVERLAP` | 50 tokens | Cross-boundary context continuity |
| `MAX_CHUNKS_PER_DOCUMENT` | Configured | Caps ingestion cost per document |

### Best Practices (2025 Benchmarks)

- **Adaptive chunking aligned to logical boundaries** outperforms fixed-size (87% vs 13% accuracy in clinical NLP study)
- **Hierarchical chunking** (parent/child) outperforms flat chunking for mixed-length queries
- **Never split mid-sentence** — add sentence-boundary detection within paragraphs
- **512-1024 tokens with 10-20% overlap** is the recommended starting range
- **Assembled context for the LLM should stay under 8K tokens total** — not per-chunk

## Graph RAG Specifics

### Neo4j Configuration

- **Graph depth**: Capped at `MAX_GRAPH_HOPS = 2` (practical production limit — deeper traversals timeout on Aura)
- **Entity linking confidence**: 0.7 threshold (production range: 0.75-0.85)
- **Score decay**: Graph results get 0.7× score relative to seed score
- **Graceful degradation**: If Neo4j is unavailable, return empty (don't crash retrieval)

### DRIFT Search Pattern (Microsoft, 2025)

Combines global community summaries with local entity traversal:

1. Community detection groups related entities
2. Community summaries provide macro-context for broad questions
3. Local entity traversal provides specific relationships
4. Both are fused for comprehensive answers

The project's community detection in `communities.ts` aligns with this approach.

### Aura Tier Limitations

| Tier | Rate Limit | Suspension | Production Suitability |
|------|-----------|------------|----------------------|
| Free | 25 req/min | Pauses after inactivity | Testing only |
| Professional | Higher | No suspension | Required for production |

## Re-ranking (Current Gap)

The project does not currently re-rank after RRF fusion. Adding a re-ranker improves retrieval quality:

- **Impact**: +18% recall, +12% answer relevancy (2025 benchmarks)
- **Latency**: 100-600ms additional
- **Integration point**: Between `fuseAndRank()` and `formatContextForPrompt()` in `retrieval/index.ts`

### Options

| Reranker | Latency | Quality | Cost |
|----------|---------|---------|------|
| Cohere Rerank 3.5 | ~200ms | High | API pricing |
| Voyage Rerank 2.5 | ~200ms | High | API pricing |
| FlashRank (open-source) | ~50ms | Medium | Free (self-hosted) |
| Haiku-class LLM | ~300ms | Medium | Token pricing |

For this project's Groq-based pipeline, a Haiku-class LLM reranker may be the most cost-effective option (already have provider infrastructure).

## Context Assembly

```typescript
// src/lib/server/retrieval/index.ts
export function formatContextForPrompt(result: RetrievalResult): string {
  if (result.chunks.length === 0) return '';
  return result.chunks
    .map((c, i) => `[${i + 1}] ${c.documentTitle}\n${c.content}`)
    .join('\n\n---\n\n');
}
```

Context is injected into the system prompt wrapped in `<retrieval-context>` tags:

```typescript
systemPrompt += `\n\n<retrieval-context>\n${contextBlock}\n</retrieval-context>\n\nUse the above context to inform your response. Cite sources when relevant.`;
```

## Evaluation (RAGAS Framework)

Component-level evaluation without reference answers:

| Metric | What It Measures | When to Use |
|--------|-----------------|-------------|
| **Faithfulness** | Statements in response backed by retrieved chunks | Primary hallucination metric — run continuously |
| **Answer Relevancy** | Response actually answers the question | Run continuously |
| **Context Precision** | Retrieved chunks are relevant (precision) | Run on sample |
| **Context Recall** | All necessary chunks retrieved (needs ground truth) | Periodic evaluation |

For production: instrument faithfulness and answer relevancy continuously. Context metrics on a sample during development/tuning.

## Pipeline Events for UI

The retrieval pipeline emits events for real-time UI feedback:

```typescript
// Pipeline step events
{ type: 'pipeline:step', step: 'embed', status: 'active' }
{ type: 'pipeline:step', step: 'tier-1', status: 'done', durationMs: 45 }
{ type: 'pipeline:step', step: 'rank', status: 'done', detail: { method: 'rrf', inputChunks: 12, outputChunks: 5 } }

// Chunk detail events
{ type: 'pipeline:chunks', tierChunks: { ... }, rankedChunks: [...], contextChunks: [...] }
```

These are emitted via `dataStream.writeMessageAnnotation()` when using `createDataStreamResponse`.
