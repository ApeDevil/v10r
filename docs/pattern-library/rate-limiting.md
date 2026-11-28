---
title: "Rate limiting"
description: "A sliding-window rate limiter factory backed by Upstash Redis that produces per-purpose limiters (email, IP, comments, grants) and fails closed when Redis is…"
category: "Anti-Abuse"
---

# Rate limiting

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Anti-Abuse · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — throttling correctness affects both abuse defense and legitimate-user access

A sliding-window rate limiter factory backed by Upstash Redis that produces per-purpose limiters (email, IP, comments, grants) and fails closed when Redis is unavailable.

**When to use:** Use whenever an endpoint or action needs abuse-resistant request throttling with predictable fail-closed behavior.

**Needs:** required key-value-store

## Docs

- [docs/blueprint/abuse/rate-limits.md](/docs/blueprint/abuse/rate-limits) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/abuse/rate-limits.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/abuse/rate-limits.md))

## Code

- `src/lib/server/abuse/rate-limit/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/abuse/rate-limit) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/abuse/rate-limit))
- `src/lib/server/http/rate-limit.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/http/rate-limit.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/http/rate-limit.ts))

## Proof

- [`/showcases/abuse/rate-limits`](/showcases/abuse/rate-limits)

---

_Machine-readable record: `rate-limiting` in `pattern-library/registry.json`._
