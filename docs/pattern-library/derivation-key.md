---
title: "Derivation key (freshness by input fingerprint)"
description: "A derived output stores derivationKey(transform@version, inputs) beside itself and is current exactly while a recomputed key matches — catching the code…"
category: "Derivation & Provenance"
---

# Derivation key (freshness by input fingerprint)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Derivation & Provenance · **Tier:** deep · **Maturity:** proven (verified 2026-10-10 @ 91f61a76-dirty) · **Risk:** medium — an undeclared input silently serves stale output; the fingerprint test is the guard

A derived output stores derivationKey(transform@version, inputs) beside itself and is current exactly while a recomputed key matches — catching the code changes a content hash cannot see, and skipping re-derivation when nothing moved.

**When to use:** Use for any stored output derived from inputs through code that evolves: chunks and embeddings, rendered projections, extracted metadata, anything expensive to recompute or read while stale.

**Requires:** postgres

## Avoid when

- A full rebuild is cheap and nothing reads a stale output in between — regenerate from scratch instead
- An input cannot be named or hashed (wall-clock, network state) — fix the transform to be input-closed before keying it

## Alternatives

- **Content hash of the source only** — prefer when the transform never changes, or a stale output is harmless until the next content edit
- **Hash the transform's source code instead of a version constant** — prefer when recomputation is cheap enough that comment edits re-deriving everything costs nothing

## Docs

- [docs/blueprint/integrity/derivation.md#derivation-key](/docs/blueprint/integrity/derivation) — Transform + inputs, where it runs, and the fingerprint test that keeps the version honest ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/integrity/derivation.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/integrity/derivation.md))

## Code

- `src/lib/server/db/content-hash.ts` — derivationKey() beside contentHash() — the one hash ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/content-hash.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/content-hash.ts))
- `src/lib/server/retrieval/plan.ts` — CHUNKER_VERSION + chunkingInput(): the chunker's half of every corpus key ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/retrieval/plan.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/retrieval/plan.ts))
- `scripts/db/ingest-docs.ts` — Docs corpus: skip per file on key match; no --force flag ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/db/ingest-docs.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/db/ingest-docs.ts))
- `src/lib/server/retrieval/ingest/index.ts` — planIngest/ingestIfChanged: content, title, chunker, embedding model and context model as inputs ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/retrieval/ingest/index.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/retrieval/ingest/index.ts))
- `src/lib/server/ai/deskbot-retrieval.ts` — Desk sync keeps unchanged embeddings and re-stamps the copy current ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/deskbot-retrieval.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/deskbot-retrieval.ts))
- `src/lib/desk/formula.ts` — The graph case: per-pass memoised resolver, cycles reported as #CIRC! ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/desk/formula.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/desk/formula.ts))

## Tests

- `src/lib/server/db/content-hash.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/content-hash.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/content-hash.test.ts))
- `src/lib/server/retrieval/plan.test.ts` — Pins the chunker's output fingerprint next to CHUNKER_VERSION ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/retrieval/plan.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/retrieval/plan.test.ts))
- `src/lib/server/ai/deskbot-retrieval.test.ts` — Key match keeps the copy and re-stamps it ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/deskbot-retrieval.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/deskbot-retrieval.test.ts))

## Invariants

- Every input that changes the output is listed or covered by the transform version — an undeclared input is the one way the key lies.
- The key is written in the same insert as the output it describes.
- A missing key means stale, never fresh.
- Each shared input is built by exactly one function, so two producers cannot key the same derivation differently.
- Only a successfully derived output's key counts — a failed derivation that stored its key must not satisfy the next comparison.

## Emulation notes

- Pin the transform's OUTPUT on a fixture next to its version constant; a behaviour change then fails a test and forces the bump-or-not decision instead of relying on memory.
- Prefer a version constant over hashing the transform's source when re-derivation is expensive (embeddings against a daily quota): a comment edit must not re-embed a corpus.
- Make the bulk re-derive resumable by construction: process per item and write each key with its output, so a run cut short leaves the rest keyed stale and the next run continues.
- When a skip leaves an output untouched, re-stamp its index time if readers compare it with the source's edit time — otherwise the verified-current copy reports itself stale.

---

_Machine-readable record: `derivation-key` in `pattern-library/registry.json`._
