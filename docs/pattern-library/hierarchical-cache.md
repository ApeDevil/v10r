---
title: "Hierarchical cache (local → shared → origin, with key scope enforced)"
description: "A read walks outward from process memory to Redis to the origin. The policy declares namespace, TTL, stale window and scope, and `cacheKey` refuses both scope…"
category: "Data Velocity"
---

# Hierarchical cache (local → shared → origin, with key scope enforced)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Data Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** medium — a mis-scoped key is a data leak, which is why the key builder refuses rather than warns

A read walks outward from process memory to Redis to the origin. The policy declares namespace, TTL, stale window and scope, and `cacheKey` refuses both scope mistakes — a per-user key with no owner, and a shared key handed one.

**When to use:** Use when reads substantially outnumber writes, the result is expensive and reused, and bounded staleness is acceptable. Not because a cache exists.

## Docs

- [docs/blueprint/velocity/data.md#hierarchical-cache](/docs/blueprint/velocity/data) — The tiers, and key identity as a security boundary ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/data.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/data.md))

## Code

- `src/lib/server/cache/tiered.ts` — Policy, key discipline, both tiers, TTL jitter ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/cache/tiered.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/cache/tiered.ts))
- `src/lib/server/cache/client.ts` — The nullable Upstash client every consumer must handle ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/cache/client.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/cache/client.ts))

## Tests

- `src/lib/server/cache/tiered.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/cache/tiered.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/cache/tiered.test.ts))

## Proof

- [`/showcases/velocity/data`](/showcases/velocity/data)

## Invariants

- Every cache entry has a declared owner and scope; `cacheKey` throws on a per-user policy with no owner AND on a shared policy handed one — the second is the more dangerous, because it parks a personal value where everyone reads.
- A cache key encodes every input that changes the answer. A key that does not is a data leak, not a performance bug.
- Freshness lives on the policy (`ttl`, `staleFor`), never argued at the call site; `staleFor` defaults to 0 because serving stale is a decision about correctness.
- The local tier is bounded and evicts oldest-used first.
- With no Redis configured every shared read is a miss and every write a no-op — a miss is always correct, only slower.

## Emulation notes

- Store the freshness horizon INSIDE the envelope rather than relying on Redis TTL: Redis expiry is a floor that reclaims memory, and the envelope has to survive a read from the local tier where no Redis TTL exists.
- Jitter the per-key TTL. Keys written together otherwise expire together, and synchronised expiry is how a cache becomes a stampede.
- Default per-user policies to skipping the local tier: the tier is correct there, but a warm serverless instance accumulates one entry per user it happened to serve.

---

_Machine-readable record: `hierarchical-cache` in `pattern-library/registry.json`._
