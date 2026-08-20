---
title: "Testing infrastructure (Vitest, PGlite isolation)"
description: "Describes the Vitest + PGlite testing harness that runs entirely inside the dev container, giving each test an isolated in-process Postgres instance via…"
category: "Architecture & Request Pipeline"
---

# Testing infrastructure (Vitest, PGlite isolation)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Architecture & Request Pipeline · **Tier:** light · **Maturity:** implemented · **Risk:** low — structural pattern, no external services

Describes the Vitest + PGlite testing harness that runs entirely inside the dev container, giving each test an isolated in-process Postgres instance via drizzle-kit's pushSchema.

**When to use:** Reach for it when writing or running tests that need database isolation or want to understand the container execution model.

## Docs

- [docs/blueprint/testing/ai-testing-infrastructure.md](/docs/blueprint/testing/ai-testing-infrastructure) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/testing/ai-testing-infrastructure.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/testing/ai-testing-infrastructure.md))

## Code

- `src/lib/server/test/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/test) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/test))
- `vitest.config.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/vitest.config.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/vitest.config.ts))

---

_Machine-readable record: `architecture-testing-infra` in `mcp/patterns.registry.json`._
