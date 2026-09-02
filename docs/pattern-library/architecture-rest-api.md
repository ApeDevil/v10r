---
title: "REST API patterns (pagination, envelopes, rate limits)"
description: "Defines the file-based +server.ts convention for REST endpoints, covering Valibot validation, error() status codes, pagination, and response envelopes."
category: "Architecture & Request Pipeline"
---

# REST API patterns (pagination, envelopes, rate limits)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Architecture & Request Pipeline · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

Defines the file-based +server.ts convention for REST endpoints, covering Valibot validation, error() status codes, pagination, and response envelopes.

**When to use:** Reach for it when building a new REST or SSE endpoint under src/routes/api/.

## Docs

- [docs/blueprint/api.md](/docs/blueprint/api) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/api.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/api.md))
- [docs/stack/capabilities/api.md](/docs/stack/api) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/capabilities/api.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/capabilities/api.md))

## Code

- `src/routes/api/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/routes/api) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/routes/api))
- `src/lib/server/http/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/http) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/http))

## Tests

- `src/lib/api.gate.test.ts` — Client fetches to /api must ride apiFetch (CSRF header) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/api.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/api.gate.test.ts))
- `src/lib/server/http/body.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/http/body.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/http/body.test.ts))
- `src/lib/server/http/rate-limit.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/http/rate-limit.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/http/rate-limit.test.ts))

---

_Machine-readable record: `architecture-rest-api` in `pattern-library/registry.json`._
