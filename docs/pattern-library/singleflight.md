---
title: "Singleflight / stampede protection (nobody waits on a lock)"
description: "Concurrent callers for one key share one execution, and across instances a refresh claim stops N instances refreshing the same stale key N times — but a cold…"
category: "Data Velocity"
---

# Singleflight / stampede protection (nobody waits on a lock)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Data Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** low — degrades to duplicate work, never to a stall

Concurrent callers for one key share one execution, and across instances a refresh claim stops N instances refreshing the same stale key N times — but a cold caller never blocks on a lock, so a failed leader can never become an outage.

**When to use:** Use for expensive cache rebuilds, external provider calls, AI calls, aggregate queries and read-model refreshes — anything where a synchronised expiry produces simultaneous identical work.

## Docs

- [docs/blueprint/velocity/data.md#singleflight--stampede-protection](/docs/blueprint/velocity/data) — Why a cold caller never waits ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/data.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/data.md))

## Code

- `src/lib/server/cache/singleflight.ts` — coalesce (in-process) + claimRefresh (cross-instance) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/cache/singleflight.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/cache/singleflight.ts))

## Tests

- `src/lib/server/cache/singleflight.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/cache/singleflight.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/cache/singleflight.test.ts))

## Proof

- [`/showcases/velocity/data`](/showcases/velocity/data)

## Invariants

- Only equivalent work is coalesced — same key, same intent — and followers receive the leader's result including its rejection, so nobody silently gets a different answer.
- Stampede protection introduces no unbounded waiting: a caller with nothing to serve computes rather than queues.
- Every distributed lock carries an expiry, so a leader that dies blocks the next refresh for a bounded time rather than forever.
- A Redis failure lets the refresh proceed — the alternative is a value ageing with nobody allowed to renew it.
- Coalescing deduplicates, it does not memoize: entries drop on settle.

## Emulation notes

- The thousand-to-one collapse happens in-process, because a burst lands on an instance rather than on a cluster. The cross-instance claim is the smaller, second-order win.
- Reserve the distributed claim for the refresh path. A lock a cold caller waits on turns a slow dependency into a queue.
- TTL jitter belongs with this pattern even though it lives in the cache module: desynchronising expiry prevents the stampede that coalescing then has to absorb.

## Depends on

- [Hierarchical cache (local → shared → origin, with key scope enforced)](/docs/pattern-library/hierarchical-cache)

---

_Machine-readable record: `singleflight` in `pattern-library/registry.json`._
