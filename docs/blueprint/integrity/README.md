# Integrity

The architecture for keeping what a system *says* consistent with what is *true*. That covers
which copy of a fact is authoritative, where a derived output came from, whether it is still
fresh, and whether interrupted work left the world in a known state. It is organised so an
agent can adopt the smallest set its project actually needs.

> A system is trustworthy when every claim it makes can be traced to an owner, an input, or a
> receipt — and when the trace fails loudly instead of quietly.

There is no `integrity/` code directory, for the same reason there is no `velocity/` one: a
domain named after a quality attribute turns into a bucket. Each pattern's code lives in the
module that owns the responsibility, and the registry records point to it.

## Files

| File | Topics |
|------|--------|
| **[truth.md](./truth.md)** | • Source-of-truth gate: one owner per fact, every other copy derived or bound by a drift test, a non-empty control, allowances that only shrink, fail closed when the owner cannot be read<br>• Evidence status dimensions: verdict, evidence, method and confidence, coverage, and freshness kept as separate fields; grades a machine can check; names that never imply a verdict<br>• Asset rights manifest: one `AssetRights` record per shipped third-party file, owned by the module that uses it, derived into `/credits` and the lightbox, gated against the files under `static/` — presence and shape, never legal sufficiency |
| **[derivation.md](./derivation.md)** | • Derivation key: an output is fresh only while `derivationKey(transform@version, inputs)` matches; the chunker fingerprint test that keeps the version honest<br>• Reproducible artifact build: regenerate-and-diff when the gate can run the generator, manifest plus digest recheck when it cannot, bit-for-bit vs input-addressed<br>• Provenance record: entity, activity, agent (PROV-DM core) and the erasure decision per trail |
| **[execution.md](./execution.md)** | • Durable step execution: conditional status machine, one claim, a database-clock lease with a reaper, a fence, per-step receipts — compared across the outbox, approved plans and branch resets, deviations named<br>• Versioned document session: save queue, compare-and-swap, explicit conflict state, per-writer drafts, fetch-then-replace reload, and why not a CRDT |

## When not to use this family

These patterns pay off when one fact has several readers, when outputs are derived from
inputs that change, or when work outlives one request. A single-page app with one table and
no background work needs none of them. Each record's `avoid_when` names its own threshold.

## Related

- [foundation/self-expressive-project.md](../../foundation/self-expressive-project.md) — the principle (one source of truth, gates over prose) that the truth patterns make executable
- [velocity/](../velocity/) — the sibling family; resilience and deadlines decide *whether* work runs, integrity decides what is recorded when it does
- [ai/](../ai/) — the deskbot approval gate, whose step receipts apply the execution patterns to AI-proposed changes
