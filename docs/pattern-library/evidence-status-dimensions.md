---
title: "Evidence status dimensions (verdict, coverage, confidence, freshness kept apart)"
description: "\"How sure are we?\" is several questions — what the evidence suggests, how far we looked, who produced it and how confident they were, whether the reference…"
category: "Truth & Evidence"
---

# Evidence status dimensions (verdict, coverage, confidence, freshness kept apart)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Truth & Evidence · **Tier:** deep · **Maturity:** proven (verified 2026-10-10 @ 91f61a76-dirty) · **Risk:** low — a modelling discipline; the cost is more fields where one number was tempting

"How sure are we?" is several questions — what the evidence suggests, how far we looked, who produced it and how confident they were, whether the reference still resolves, and when it goes stale — each stored in its own field, never merged into one score.

**When to use:** Use when a system reports findings a person will act on: aggregated external lookups, AI-proposed values, citations, verification grades, performance verdicts.

## Avoid when

- The value is internal and nobody reads it as evidence — a cache-hit flag needs no confidence model
- One boolean is honestly the whole story, with no partial coverage and no producer whose confidence differs from acceptance

## Alternatives

- **A single composite score** — prefer when ranking candidates internally where no one acts on the number itself — never as a stored or displayed status

## Docs

- [docs/blueprint/integrity/truth.md#evidence-status-dimensions](/docs/blueprint/integrity/truth) — The dimensions, the v10r field for each, and the naming rule ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/integrity/truth.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/integrity/truth.md))

## Code

- `src/lib/name-check/report.ts` — NameConflictSignal vs NameCoverageStatus — signal and coverage as separate fields, no verdict ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/name-check/report.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/name-check/report.ts))
- `src/lib/schemas/image-metadata.ts` — fieldProvenance (who wrote it) kept apart from the model's confidence tier ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/schemas/image-metadata.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/schemas/image-metadata.ts))
- `src/lib/types/turn-trace.ts` — TurnItemState: available → considered → included → executed → cited; inclusion never claims influence ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/types/turn-trace.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/types/turn-trace.ts))
- `src/lib/server/ai/catalog-citations.ts` — exists / drifted / none for cited routes ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/catalog-citations.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/catalog-citations.ts))
- `pattern-library/schema.ts` — PatternMaturity: a grade only as fine as a machine can check ([GitHub](https://github.com/ApeDevil/v10r/blob/main/pattern-library/schema.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/pattern-library/schema.ts))
- `src/lib/server/perf/budgets.ts` — Targets (reported) vs ratchets (gated) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/perf/budgets.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/perf/budgets.ts))

## Tests

- `src/lib/server/name-check/signal.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/signal.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/signal.test.ts))
- `src/lib/schemas/image-metadata.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/schemas/image-metadata.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/schemas/image-metadata.test.ts))
- `src/lib/server/ai/catalog-citations.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/catalog-citations.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/catalog-citations.test.ts))
- `src/lib/server/perf/budgets.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/perf/budgets.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/perf/budgets.test.ts))
- `src/lib/server/patterns/registry.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/patterns/registry.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/patterns/registry.test.ts))

## Proof

- [`/showcases/name-check`](/showcases/name-check) — Signal, reasons and per-source coverage rendered side by side

## Invariants

- Distinct dimensions get distinct fields; a score merging confidence, coverage, provenance and freshness is never stored.
- A grade is only as fine as a machine can verify — self-declared rungs rot.
- Names describe the evidence, not a conclusion: signal, coverage, drifted — never safe, verified or valid.
- Self-reported confidence never stands in for acceptance; the model's tier and the human's approval are separate facts.
- Missing coverage is a recorded value, not an absence — an unanswered source is counted as unanswered.

## Emulation notes

- Start from the question a reader will ask next ("did all sources answer?", "did a human check this?") and give each its own field; the merged score is what is left when nobody asked.
- Name the type before the UI: once a field is called `verdict` or `safe`, the interface will present it as a conclusion no matter what the docs say.
- Keep the grade coarse enough that `validate` can check it. v10r's maturity has three rungs because a fourth ("browser-verified") had no machine-checkable proof.

---

_Machine-readable record: `evidence-status-dimensions` in `pattern-library/registry.json`._
