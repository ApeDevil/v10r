---
title: "Name check (resilient multi-source fan-out)"
description: "One report from several unreliable upstreams: concurrent per-source deadlines, a breaker, bulkhead and daily quota per source, per-source coverage instead of…"
category: "External Integrations"
---

# Name check (resilient multi-source fan-out)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** External Integrations · **Tier:** deep · **Maturity:** proven (verified 2026-09-18 @ dff6f415) · **Risk:** medium — upstream contracts change without notice; EUIPO subscription approval takes days and its Sandbox runs on separate hosts

One report from several unreliable upstreams: concurrent per-source deadlines, a breaker, bulkhead and daily quota per source, per-source coverage instead of failure, dependency-free name similarity, and a descriptive conflict signal that never claims legal availability.

**When to use:** Use when a feature aggregates third-party APIs of uneven reliability and the user needs an honest partial answer — what was found, and where the search could not look — rather than an all-or-nothing one.

## Docs

- [docs/blueprint/name-check.md](/docs/blueprint/name-check) — The pattern: vocabulary, pipeline, sources, resilience, privacy, what the UI never says ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/name-check.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/name-check.md))

## Code

- `src/lib/server/name-check/check.ts` — The fan-out: cache → breaker → quota → bulkhead → deadline per source; every error class mapped to one coverage status ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/check.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/check.ts))
- `src/lib/server/name-check/similarity.ts` — Dependency-free similarity ladder; the best rung names itself as the basis ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/similarity.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/similarity.ts))
- `src/lib/server/name-check/signal.ts` — Conflict level from explicit predicates, reasons as codes ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/signal.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/signal.ts))
- `src/lib/server/name-check/sources/rdap.ts` — IANA bootstrap + registry override + DNS evidence + honest lookup_unavailable ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/sources/rdap.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/sources/rdap.ts))
- `src/lib/server/name-check/name-source.ts` — The NameSource contract: territories and manualUrl before search ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/name-source.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/name-source.ts))
- `src/lib/server/name-check/connections.ts` — Saved source connections → the credentials closure; configured decided once, secrets never on a field ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/connections.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/connections.ts))
- `src/lib/name-check/report.ts` — Wire contract with no field that could render as legal availability ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/name-check/report.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/name-check/report.ts))

## Tests

- `src/lib/server/name-check/check.test.ts` — Partial failure, timeout, quota, credentials, cache hit, floor, scoping, and the name never reaching a log ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/check.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/check.test.ts))
- `src/lib/server/name-check/similarity.test.ts` — The spec ladder in order, Kölner Phonetik on the textbook examples ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/similarity.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/similarity.test.ts))
- `src/lib/server/name-check/signal.test.ts` — Each level's predicate and the manual-review rule ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/signal.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/signal.test.ts))
- `src/lib/server/name-check/connections.test.ts` — none / ready / undecryptable, configured needs enabled + opened (+ client id), the projection carries no secret ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/connections.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/connections.test.ts))

## Proof

- [`/showcases/name-check`](/showcases/name-check) — The form, the report, the coverage table with a manual link on every row

## Invariants

- A source failure changes its coverage row, never the HTTP status of the check.
- The report never states legal availability, a safety verdict or a risk percentage; a similarity score is always shown with its basis.
- The submitted name never reaches a log line or a store; only its sha256 keys the cache, and only successes are cached.
- Every source shows its authoritative manual link, searched or not.
- Vendor credentials are administrator-managed source connections sealed under ENCRYPTION_KEY, never environment variables; the only shape that reaches a client is the projection without the envelope.
- The IP limiter runs before any upstream call; each live source has a daily quota, a breaker and a deadline child of the request's budget.

## Emulation notes

- Declare each upstream as a NameSource — territories and manualUrl first, search second. A registry you cannot query still earns a coverage row.
- Map every thrown error class to exactly one coverage status in one function; new failure modes choose their status there.
- Keep the similarity engine pure and fixture-tested, thresholds in config.ts; derive the level from predicates over evidence, never from a count.
- Keep vendor credentials as administrator-managed source connections sealed under the deployment key, opened once per operation into a closure that hands the sources a credentials object; nothing is read from .env and the public check never fails because its settings table could not be read.
- Fire an onSourceSettled callback per source so a streaming route can be added without touching the orchestration.

## Depends on

- [Resilience policy (breaker, bulkhead, shedding, bounded retry)](/docs/pattern-library/resilience-policy)
- [Deadline propagation (one budget, divided)](/docs/pattern-library/deadline-propagation)
- [Hierarchical cache (local → shared → origin, with key scope enforced)](/docs/pattern-library/hierarchical-cache)

---

_Machine-readable record: `name-check` in `pattern-library/registry.json`._
