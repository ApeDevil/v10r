---
title: "Retrieval ingest/search endpoints (one ingest door, /api/retrieval/*)"
description: "The RAG corpus is fed and queried through /api/retrieval/* HTTP endpoints plus a unified ingest door: the app runtime and the Bun docs-ingest script share the…"
category: "AI"
---

# Retrieval ingest/search endpoints (one ingest door, /api/retrieval/*)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** AI · **Tier:** deep · **Risk:** medium — writes to the corpus store; provider quotas apply

The RAG corpus is fed and queried through /api/retrieval/* HTTP endpoints plus a unified ingest door: the app runtime and the Bun docs-ingest script share the same pure planChunks() core.

**When to use:** Use when the corpus must be maintainable from more than one runtime (app UI and scripts) without forking chunking logic.

## Docs

- [docs/blueprint/ai/knowledge-base.md](/docs/blueprint/ai/knowledge-base) — The ingest door pattern ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/knowledge-base.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/knowledge-base.md))
- [docs/blueprint/ai/nrag-observability.md](/docs/blueprint/ai/nrag-observability) — Observability over the pipeline ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/nrag-observability.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/nrag-observability.md))

## Code

- `src/routes/api/retrieval/ingest/+server.ts` — Ingest endpoint (namespace is /api/retrieval/*, not /api/rag/*) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/retrieval/ingest/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/retrieval/ingest/+server.ts))
- `src/routes/api/retrieval/search/+server.ts` — Search endpoint ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/retrieval/search/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/retrieval/search/+server.ts))
- `src/lib/server/rawrag/ingest/index.ts` — Runtime ingest module ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/rawrag/ingest/index.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/rawrag/ingest/index.ts))
- `scripts/db/ingest-docs.ts` — Bun script sharing the same planChunks() door ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/db/ingest-docs.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/db/ingest-docs.ts))

## Tests

- `src/lib/server/rawrag/chunk.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/rawrag/chunk.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/rawrag/chunk.test.ts))
- `src/lib/server/rawrag/embed.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/rawrag/embed.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/rawrag/embed.test.ts))

## Proof

- [`Retrieval now lives as the #nrag section of the surface pages; the ingest/explorer showcases were retired /showcases/ai/chatbot`](/showcases/ai/chatbot)

## Invariants

- One ingest door: the standalone script reuses the app's pure planChunks() so both runtimes share one chunking implementation.
- Section-parent chunks are stored with embedding = NULL so tier-1 retrieval never surfaces them.
- Re-ingest is resume-safe and idempotent.

## Emulation notes

- Keep the chunker pure (no I/O) — that is what makes the door shareable across runtimes.
- Mind embedding-provider daily quotas when re-ingesting a whole corpus.

## Depends on

- [Layered RAG (llmwiki pointer layer over a rawrag kernel)](/docs/pattern-library/layered-rag)

---

_Machine-readable record: `retrieval-endpoints` in `mcp/patterns.registry.json`._
