---
title: "Runtime layers & request flow (7-layer view)"
description: "Documents v10r's seven-layer abstraction hierarchy, from tech stack down to code, anchored by the hooks.server.ts composition root and the hexagonal domain…"
category: "Architecture & Request Pipeline"
---

# Runtime layers & request flow (7-layer view)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Architecture & Request Pipeline · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

Documents v10r's seven-layer abstraction hierarchy, from tech stack down to code, anchored by the hooks.server.ts composition root and the hexagonal domain core.

**When to use:** Reach for it when orienting a new contributor or agent to how a request moves through the system and which layer a given file belongs to.

## Docs

- [docs/system-abstraction.md](/docs/system-abstraction) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/system-abstraction.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/system-abstraction.md))

## Code

- `src/hooks.server.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/hooks.server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/hooks.server.ts))

## Tests

- `src/lib/server/security/handle-chain.gate.test.ts` — Pins the middleware order the layer model describes ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/security/handle-chain.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/security/handle-chain.gate.test.ts))

---

_Machine-readable record: `architecture-runtime-layers` in `pattern-library/registry.json`._
