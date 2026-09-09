---
title: "Resilience policy (breaker, bulkhead, shedding, bounded retry)"
description: "Four separate decisions about an unhealthy dependency — should we call it, how much of the pool may it hold, is this work worth doing under pressure, and is…"
category: "Runtime Velocity"
---

# Resilience policy (breaker, bulkhead, shedding, bounded retry)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Runtime Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** medium — fail-open and fail-closed are both wrong somewhere

Four separate decisions about an unhealthy dependency — should we call it, how much of the pool may it hold, is this work worth doing under pressure, and is this failure worth repeating — kept apart because none of them substitutes for another.

**When to use:** Use around any dependency that can fail, throttle or slow down: AI providers, Redis, the database, external APIs, object storage.

## Docs

- [docs/blueprint/velocity/runtime.md#resilience-policy](/docs/blueprint/velocity/runtime) — Which mechanism answers which question, and why they are separate ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/runtime.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/runtime.md))

## Code

- `src/lib/server/resilience/breaker.ts` — Shared open-state in Redis with an in-process mirror; no half-open, and why ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/resilience/breaker.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/resilience/breaker.ts))
- `src/lib/server/resilience/bulkhead.ts` — In-process concurrency compartment that refuses rather than queues without bound ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/resilience/bulkhead.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/resilience/bulkhead.ts))
- `src/lib/server/resilience//` — shedding.ts (priority admission) and retry.ts (backoff drawn from the request's budget) ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/resilience/) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/resilience/))
- `src/lib/server/ai/providers.ts` — The AI domain's use of the breaker — policy and vocabulary here, mechanism in resilience/ ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/providers.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/providers.ts))

## Tests

- `src/lib/server/resilience/breaker.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/resilience/breaker.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/resilience/breaker.test.ts))
- `src/lib/server/resilience/retry.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/resilience/retry.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/resilience/retry.test.ts))

## Proof

- [`/showcases/velocity/runtime`](/showcases/velocity/runtime)

## Invariants

- Retry storms are impossible: retries draw down the same deadline as the attempt they replace, and every backoff carries full jitter so clients that failed together do not return together.
- Failure of one optional capability does not block unrelated capabilities — that is the bulkhead's only job, and it is why one shared pool is not one.
- Resilience mechanisms are observable: every refusal names its kind, every shed decision returns its reason, and a breaker logs the count and window that opened it.
- Fallback behaviour preserves domain safety. A fallback that widens a permission is not a fallback; degradation may only ever drop privileges.
- A refusal is distinct from a failure. `ResilienceError` means the work never ran, so the caller knows a retry is pointless and a fallback is the only useful response.
- Only idempotent work is retried. The library cannot check this; the call site can, which is why the judgement lives there.

## Emulation notes

- Keep the four mechanisms as four modules. Every attempt to merge them produces a 'resilient call' wrapper whose defaults are wrong for most call sites and whose behaviour nobody can predict at the one that matters.
- Breaker state belongs in shared storage on serverless — an in-process breaker lets every cold instance independently rediscover the outage, which is the hammering it exists to prevent. Mirror it in memory and write the mirror FIRST, so a failed shared write cannot silently leave the breaker closed.
- Skip the half-open state. The first caller after the window is the probe; a true half-open needs a second lock to admit exactly one request, and a handful of duplicate probes is cheaper than that coordination.
- A bulkhead bounds one instance and no amount of local bookkeeping changes that. Say so where it is defined — the fleet-wide bound is the platform's concurrency setting and the dependency's connection limit.
- Size the queue as a burst absorber, not a backlog. An unbounded queue is latency the caller cannot see and a slower way to exhaust memory.
- Shed by priority against pressure that rises BEFORE capacity is reached. Dropping optional work at half load is how the pool avoids being full for the work that is not optional; critical work is never shed for load alone.
- Fail-open and fail-closed are both wrong somewhere, so make each call site declare which — `http/rate-limit.ts` splits 'slow' from 'down' for exactly this reason.

---

_Machine-readable record: `resilience-policy` in `pattern-library/registry.json`._
