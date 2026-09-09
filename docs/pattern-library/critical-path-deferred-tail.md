---
title: "Critical path / deferred tail"
description: "Only work the caller's intent depends on runs before the response; analytics, indexing, outbox routing and telemetry run after it through one wrapper that…"
category: "Runtime Velocity"
---

# Critical path / deferred tail

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Runtime Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** medium — work moved off the response must be genuinely optional to it

Only work the caller's intent depends on runs before the response; analytics, indexing, outbox routing and telemetry run after it through one wrapper that owns the platform's survival rule and the catch-before-handoff rule.

**When to use:** Use whenever an operation performs secondary effects before returning. Not for a durable write that must be acknowledged before the response.

## Docs

- [docs/blueprint/velocity/runtime.md#critical-path--deferred-tail](/docs/blueprint/velocity/runtime) — The two platform facts behind the wrapper ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/runtime.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/runtime.md))

## Code

- `src/lib/server/http/after-response.ts` — deferAfterResponse — the one place the rules live ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/http/after-response.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/http/after-response.ts))
- `src/lib/server/analytics/collector.hook.ts` — The largest consumer: pageviews, bot hits, user events ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/analytics/collector.hook.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/analytics/collector.hook.ts))

## Tests

- `src/lib/server/http/after-response.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/http/after-response.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/http/after-response.test.ts))

## Proof

- [`/showcases/velocity/data`](/showcases/velocity/data)

## Invariants

- Deferred work is never necessary for the correctness of the returned result.
- The `.catch` is attached BEFORE the promise is handed to the platform — attached after, an unhandled rejection can take the serverless process down (SvelteKit #9785).
- Deferred failures are logged, never rethrown: the response is gone and there is nobody to tell.
- Deferred work is idempotent — delivery is at-least-once and the platform may retry the request that spawned it.
- A durable write that must be acknowledged before the response is critical, not deferred.

## Emulation notes

- On Vercel the execution environment FREEZES when the response returns: a bare un-awaited promise is not merely unordered, it is not guaranteed to run at all. Off-platform the same wrapper degrades to plain fire-and-forget, which is correct there.
- Keep this separate from streaming deferral (`safeDeferPromise`), which keeps a promise alive INSIDE a response body. Two lifetimes, two files — one file holding both is how buckets start.
- Name the deferred work for the effect (`analytics:pageview`), not the mechanism: the label is what someone reads in a failure log at 3am.

## Depends on

- [Multi-client core (hexagonal domain modules)](/docs/pattern-library/multi-client-core)

---

_Machine-readable record: `critical-path-deferred-tail` in `pattern-library/registry.json`._
