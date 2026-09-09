---
title: "Testing infrastructure (Vitest, PGlite isolation)"
description: "Two vitest lanes over one config: a fast `unit` lane and a `db` lane whose files restore a PGlite datadir snapshot built once per run, plus the…"
category: "Architecture & Request Pipeline"
---

# Testing infrastructure (Vitest, PGlite isolation)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Architecture & Request Pipeline · **Tier:** light · **Maturity:** proven (verified 2026-09-06 @ 4d097488) · **Risk:** low — structural pattern, no external services

Two vitest lanes over one config: a fast `unit` lane and a `db` lane whose files restore a PGlite datadir snapshot built once per run, plus the source-scanning gate tests that ratchet architectural and naming invariants.

**When to use:** Reach for it when writing tests that need database isolation, when deciding whether a guarantee earns a test at all, or when adding a gate that scans the source tree.

## Docs

- [docs/blueprint/testing/strategy.md](/docs/blueprint/testing/strategy) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/testing/strategy.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/testing/strategy.md))
- [docs/blueprint/testing/ai-testing-infrastructure.md](/docs/blueprint/testing/ai-testing-infrastructure) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/testing/ai-testing-infrastructure.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/testing/ai-testing-infrastructure.md))

## Code

- `src/lib/server/test/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/test) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/test))
- `vitest.config.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/vitest.config.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/vitest.config.ts))

## Tests

- `src/lib/architecture.gate.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/architecture.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/architecture.gate.test.ts))
- `src/lib/naming.gate.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/naming.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/naming.gate.test.ts))

---

_Machine-readable record: `architecture-testing-infra` in `pattern-library/registry.json`._
