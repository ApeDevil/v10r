---
name: v10r-integrity
description: "v10r reference patterns for Integrity in SvelteKit + TypeScript apps (Truth & Evidence; Derivation & Provenance; Durable Execution). Use when designing, building or reviewing: anchor validation, single source of truth, coverage reporting, incremental recomputation, generated artifact check, attribution, durable execution, autosave, license metadata — before writing it from scratch, read the matching pattern's contraindications, invariants and emulation notes. 9 patterns, 8 with full emulation cards."
license: MIT
metadata:
  source: "v10r pattern-library registry"
  registry-digest: "59949b2ccad0ca92"
  generated: "true"
---

# v10r Integrity patterns

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

## When to use

Use this agent skill when a task in a SvelteKit + TypeScript project touches Truth & Evidence, Derivation & Provenance, Durable Execution and a proven reference implementation would beat inventing one. v10r is a pattern library for *emulation*, not cloning: adapt the shape and keep the invariants; do not copy files wholesale.

To choose among patterns across groups, or to order several, use the `v10r-architecture-selection` agent skill first.

## Method

1. Find the candidate in the index below. Bold, linked rows are deep cards; the rest are index rows.
2. Fitness first: read its *Avoid when* and *Alternatives*. If the target matches a contraindication, or a simpler alternative fits, stop here — the smallest thing that works wins.
3. Check *Requires* against the target project's infrastructure, and *Depends on* for prerequisites to build first.
4. Deep card: open `references/<id>.md`. Every *Invariant* MUST still hold after you adapt it; the *Emulation notes* say what to change for a new project. Read the linked docs and code on GitHub when you need the real implementation.
5. Index row (no reference file): its docs page is `https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/<id>.md` — pointers to docs, code and proof, but no recorded invariants, so treat it as orientation, not a contract.
6. When the v10r Pattern MCP is connected (`https://www.v10r.dev/api/mcp/public`, or the local stdio server), `get_pattern {ids, sections}` returns the live card and `get_file_excerpt` the cited code; prefer it over these generated copies.

Maturity is evidence, not opinion: **proven** = a linked test or showcase, verified at a recorded date; **implemented** = the code exists but no proof surface is linked; **planned** = design only. Treat implemented and planned rows as unverified.

## Pattern index

### Truth & Evidence

- Resource anchor integrity (`resource-anchor-integrity`, proven) — Every #fragment a registry doc ref names must be a heading the page renders, checked through the…
- **[Source-of-truth gate](references/source-of-truth-gate.md)** (proven · needs v10r's implementation uses relational-db, llm-provider) — Every fact has exactly one owner; every other copy is typed, imported, generated with a --check, or bound by a drift test with a non-empty…
  - Use whenever a fact must exist in more than one place — a client mirror of a server enum, a public page that states what a job enforces, a…
  - Avoid when: The value is read in exactly one place — the owner and the reader are the same line, and a gate around it is ceremony
- **[Evidence status dimensions](references/evidence-status-dimensions.md)** (proven) — "How sure are we?" is several questions — what the evidence suggests, how far we looked, who produced it and how confident they were…
  - Use when a system reports findings a person will act on: aggregated external lookups, AI-proposed values, citations, verification grades…
  - Avoid when: The value is internal and nobody reads it as evidence — a cache-hit flag needs no confidence model
- **[Asset rights manifest](references/asset-rights-manifest.md)** (proven) — Every third-party file the app ships carries one AssetRights record (author, SPDX license, source) owned by the module that uses it…
  - Use when the app ships third-party media — models, photos, fonts, sounds — whose licenses require attribution or restrict use.
  - Avoid when: Every asset is first-party — there is no author to credit and no license to record

### Derivation & Provenance

- **[Derivation key](references/derivation-key.md)** (proven · needs conditional relational-db · v10r's implementation uses llm-provider) — A derived output stores derivationKey(transform@version, inputs) beside itself and is current exactly while a recomputed key matches …
  - Use for any stored output derived from inputs through code that evolves: chunks and embeddings, rendered projections, extracted metadata…
  - Avoid when: A full rebuild is cheap and nothing reads a stale output in between — regenerate from scratch instead
- **[Reproducible artifact build](references/reproducible-artifact-build.md)** (proven) — Committed generated artifacts are proven current by the gate: regenerate-and-diff (missing and orphan outputs included) when the generator…
  - Use for any generated output committed to the repo or shipped as a file: generated docs and indexes, snapshots, compiled binaries…
  - Avoid when: The output is rebuilt on every deploy and never committed — the deploy itself is the regeneration
- **[Provenance record](references/provenance-record.md)** (proven · needs required relational-db · v10r's implementation uses vector-search) — Where a value came from is recorded with the W3C PROV-DM core only: the entity pinned to a revision or content hash, the activity with its…
  - Use when a reader must tell who or what produced a value — AI-drafted vs human-edited fields, published revisions, derived corpora…
  - Avoid when: The data has one author and no derivation — a user's own settings row is its own provenance

### Durable Execution

- **[Durable step execution](references/durable-step-execution.md)** (proven · needs required relational-db) — Multi-step work that can be killed halfway survives without a workflow engine: a conditional status machine, one claim, a database-clock…
  - Use for short, few-step work that outlives a request or can be interrupted — outbox delivery, replaying an approved AI plan, driving an…
  - Avoid when: The work is one statement — a single transaction is already all-or-nothing
- **[Versioned document session](references/versioned-document-session.md)** (proven · needs required relational-db) — A browser-edited document stays server-authoritative: debounced serialised saves carrying their base version, compare-and-swap rejection…
  - Use for documents a user edits over time while the server, another tab or an AI write can change them — sheets, notes, settings pages with…
  - Avoid when: The input is append-only (a message, a form submission) — one request with an idempotency key suffices
