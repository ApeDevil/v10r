---
title: "Stale-while-revalidate (and stale-if-error)"
description: "A value past its TTL but inside its stale window is returned immediately and refreshed behind the response; a failing refresh leaves the stale value in place…"
category: "Data Velocity"
---

# Stale-while-revalidate (and stale-if-error)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Data Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** medium — the staleness window is a correctness decision, not a tuning knob

A value past its TTL but inside its stale window is returned immediately and refreshed behind the response; a failing refresh leaves the stale value in place rather than turning a slow dependency into a 500.

**When to use:** Use when slightly stale is better than waiting: dashboards, feeds, metadata, public content, aggregate counts. Never for authorization, security state or balances requiring strong consistency.

## Docs

- [docs/blueprint/velocity/data.md#stale-while-revalidate](/docs/blueprint/velocity/data) — The four outcomes and what must never be stale ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/data.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/data.md))

## Code

- `src/lib/server/cache/swr.ts` — readThrough: fresh / stale / miss / stale-if-error ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/cache/swr.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/cache/swr.ts))

## Tests

- `src/lib/server/cache/swr.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/cache/swr.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/cache/swr.test.ts))

## Proof

- [`/showcases/velocity/data`](/showcases/velocity/data)

## Invariants

- The staleness window is explicit per policy — a value with no declared window is never served stale.
- Revalidation never blocks the stale response.
- A stale value is never mistaken for authoritative security state.
- A cold miss with a failing origin throws: there is no stale value to fall back to, so the error is the only honest answer.

## Emulation notes

- Send the background refresh through the platform's after-response mechanism, not a dangling promise: on a serverless host the instance can be frozen the moment the response returns, and a refresh killed halfway leaves the value stale forever with clean logs.
- Only one instance should refresh a shared stale key — combine this with a refresh claim, and note that losing the claim means 'keep serving stale', never 'wait'.

## Depends on

- [Hierarchical cache (local → shared → origin, with key scope enforced)](/docs/pattern-library/hierarchical-cache)
- [Critical path / deferred tail](/docs/pattern-library/critical-path-deferred-tail)

---

_Machine-readable record: `stale-while-revalidate` in `pattern-library/registry.json`._
