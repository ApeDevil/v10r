---
title: "Deadline propagation (one budget, divided)"
description: "A latency budget stamped once at the edge, from which every downstream operation takes what is LEFT rather than a fresh window of its own — so the request has…"
category: "Runtime Velocity"
---

# Deadline propagation (one budget, divided)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Runtime Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** medium — a wrong deadline turns a slow success into a failure

A latency budget stamped once at the edge, from which every downstream operation takes what is LEFT rather than a fresh window of its own — so the request has a stated bound instead of the sum of independently-chosen timeouts.

**When to use:** Use when a request or job calls external APIs, AI providers, distributed services, several databases in sequence, or anything that retries.

## Docs

- [docs/blueprint/velocity/runtime.md#deadline-propagation](/docs/blueprint/velocity/runtime) — Why the clamp in child() is the whole pattern ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/runtime.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/runtime.md))

## Code

- `src/lib/server/http/deadline.ts` — startDeadline, child() clamping, run() with the pre-race catch ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/http/deadline.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/http/deadline.ts))
- `src/lib/server/jobs/bot-ranges-refresh.ts` — Real adoption: ten feeds under one 50s budget instead of ten independent timeouts ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/bot-ranges-refresh.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/bot-ranges-refresh.ts))

## Tests

- `src/lib/server/http/deadline.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/http/deadline.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/http/deadline.test.ts))

## Proof

- [`/showcases/velocity/runtime`](/showcases/velocity/runtime)

## Invariants

- Every timeout value is bounded — there is no operation whose wait is unstated.
- A child operation may not exceed its parent's deadline, whatever it asks for. The clamp is in one place so no call site can opt out of it.
- A retry consumes the same budget as the attempt it replaces. This is the rule that makes retry-plus-timeout composable instead of multiplicative.
- Fallback behaviour is defined per leaf, not inherited. What to return when the budget runs out is domain knowledge.
- A deadline bounds the WAIT, not the work: an operation that ignores its AbortSignal still runs to completion, so its promise must carry a catch before anything races it.

## Emulation notes

- Stamp the deadline at the outermost edge — first or second in the middleware chain. A budget that starts partway through bounds a subset of the request, and every slice taken from it is then wrong in the one direction that matters.
- `child(maxMs)` grants the SMALLER of what was asked and what is left. That single clamp, and not the timeouts themselves, is what makes the total bound hold.
- `reserveMs` is what stops a leaf from finishing its dependency call with no budget left to use the result. Reserve for the work that happens AFTER the child, not for safety margin.
- Every leaf needs a minimum useful budget. Without one, 'the budget ran out' is a boundary condition — the last call starts with a fraction of a millisecond and is abandoned before it can return.
- Attach the catch to the abandoned work BEFORE racing it. Once the race rejects nothing is listening, and on Vercel an unhandled rejection can take the process down (SvelteKit #9785).
- Adoption is per leaf and incremental. Stamping the budget is cheap; nothing is actually bounded until a leaf takes a child and honours it, so record which leaves have rather than implying coverage.

## Depends on

- [Resilience policy (breaker, bulkhead, shedding, bounded retry)](/docs/pattern-library/resilience-policy)

---

_Machine-readable record: `deadline-propagation` in `pattern-library/registry.json`._
