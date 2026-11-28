# Multi-source aggregation

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

**Kind:** pattern — build it in the target project

**Category:** External Integrations · **Tier:** deep · **Maturity:** proven (verified 2026-09-18 @ dff6f415) · **Risk:** medium — upstream contracts change without notice; a source without a usable API still needs its manual row

One honest report from several unreliable upstreams: concurrent per-source deadlines, a breaker, bulkhead and daily quota per source, and a coverage row per source instead of an all-or-nothing failure.

**When to use:** Use when a feature aggregates third-party APIs of uneven reliability and the user needs an honest partial answer — what was found, and where the search could not look — rather than an all-or-nothing one.

**Needs:** required external-api · conditional key-value-store (when daily per-source quotas and cached reports are shared across instances), relational-db (when paid sources need stored, encrypted API credentials)

## Avoid when

- One reliable upstream answers the question — per-source breakers, quotas, bulkheads and coverage rows have nothing to aggregate

## Alternatives

- **Manual links to each authoritative search (the manual-only NameSource)** — prefer when no upstream has a usable API, or its contract or terms forbid scripted access
- **Call the single upstream directly with plain error handling** — prefer when one reliable source covers the whole question and a failure can simply be an error response

## Docs

- `docs/blueprint/name-check.md#pattern-boundaries` — The reusable aggregation mechanism and what the name-check feature adds on top ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/name-check.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/name-check.md))
- `docs/blueprint/name-check.md` — The pattern: vocabulary, pipeline, sources, resilience, privacy, what the UI never says ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/name-check.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/name-check.md))

## Code

- `src/lib/server/name-check/check.ts` — The fan-out: cache → breaker → quota → bulkhead → deadline per source; every error class mapped to one coverage status ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/check.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/check.ts))
- `src/lib/server/name-check/name-source.ts` — The NameSource contract: territories and manualUrl before search ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/name-source.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/name-source.ts))
- `src/lib/server/name-check/connections.ts` — Saved source connections → the credentials closure; configured decided once, secrets never on a field ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/connections.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/connections.ts))

## Tests

- `src/lib/server/name-check/check.test.ts` — Partial failure, timeout, quota, credentials, cache hit, floor, scoping, and the name never reaching a log ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/check.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/check.test.ts))
- `src/lib/server/name-check/connections.test.ts` — none / ready / undecryptable, configured needs enabled + opened (+ client id), the projection carries no secret ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/connections.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/connections.test.ts))

## Proof

- [`/showcases/name-check`](https://www.v10r.dev/showcases/name-check) — The form, the report, the coverage table with a manual link on every row

## Invariants

- A source failure changes its coverage row, never the HTTP status of the check.
- Every source shows its authoritative manual link, searched or not.
- Vendor credentials are administrator-managed source connections sealed under ENCRYPTION_KEY, never environment variables; the only shape that reaches a client is the projection without the envelope.
- Each live source has a daily quota, a breaker and a deadline child of the request's budget.

## Emulation notes

- Declare each upstream as a NameSource — territories and manualUrl first, search second. A registry you cannot query still earns a coverage row.
- Map every thrown error class to exactly one coverage status in one function; new failure modes choose their status there.
- Keep vendor credentials as administrator-managed source connections sealed under the deployment key, opened once per operation into a closure that hands the sources a credentials object; nothing is read from .env and the public check never fails because its settings table could not be read.
- Fire an onSourceSettled callback per source so a streaming route can be added without touching the orchestration.

## Depends on

- [Resilience policy](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/resilience-policy.md)
- [Deadline propagation](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/deadline-propagation.md)
- [Hierarchical cache](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/hierarchical-cache.md)

---

_Machine-readable record: `multi-source-aggregation` in `pattern-library/registry.json`._
