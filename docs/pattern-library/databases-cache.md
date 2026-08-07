---
title: "Cache (Upstash Redis, ephemeral patterns)"
description: "In-memory key-value store on Upstash Redis, reached over HTTP REST, used for rate limiting, the circuit breaker, and other ephemeral counters."
category: "Databases & Storage"
---

# Cache (Upstash Redis, ephemeral patterns)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Databases & Storage · **Tier:** light · **Risk:** medium — external managed service (Upstash Redis)

In-memory key-value store on Upstash Redis, reached over HTTP REST, used for rate limiting, the circuit breaker, and other ephemeral counters.

**When to use:** Use when a feature needs fast, short-lived state, such as counters or locks, without Postgres's durability guarantees.

## Docs

- [docs/stack/data/redis.md](/docs/stack/redis) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/data/redis.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/data/redis.md))
- [docs/stack/ops/caching.md](/docs/stack/caching) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/ops/caching.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/ops/caching.md))

## Code

- `src/lib/server/cache/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/cache) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/cache))

## Proof

- [`/showcases/db/cache/connection`](/showcases/db/cache/connection)
- [`/showcases/db/cache/patterns`](/showcases/db/cache/patterns)
- [`/showcases/db/cache/ephemeral`](/showcases/db/cache/ephemeral)

---

_Machine-readable record: `databases-cache` in `mcp/patterns.registry.json`._
