# Name check

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

**Kind:** pattern — build it in the target project

**Category:** External Integrations · **Tier:** deep · **Maturity:** proven (verified 2026-09-18 @ dff6f415) · **Risk:** medium — upstream contracts change without notice; EUIPO subscription approval takes days and its Sandbox runs on separate hosts

Checks a proposed name against trademark registries, company registers and domains through a protected public endpoint: the IP limiter runs before any upstream call, then multi-source aggregation, dependency-free name similarity and a descriptive conflict signal that never claims legal availability.

**When to use:** Use when users check a proposed product or company name against several registries at once and need an honest, partial-coverage answer, served from a public endpoint that must not let one caller spend the deployment's source quotas.

**Needs:** required external-api (via multi-source-aggregation), key-value-store · conditional relational-db (when paid sources need stored, encrypted API credentials; via multi-source-aggregation)

## Avoid when

- The caller needs an authoritative verdict such as legal clearance — the report only describes what was found and where it could not look

## Alternatives

- **Multi-source aggregation without the public name endpoint (an internal or authenticated caller)** — prefer when the caller is trusted or already rate-limited elsewhere, so the per-IP protection contract does not apply

## Docs

- `docs/blueprint/name-check.md` — The pattern: vocabulary, pipeline, sources, resilience, privacy, what the UI never says ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/name-check.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/name-check.md))

## Code

- `src/lib/server/name-check/similarity.ts` — Dependency-free similarity ladder; the best rung names itself as the basis ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/similarity.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/similarity.ts))
- `src/lib/server/name-check/signal.ts` — Conflict level from explicit predicates, reasons as codes ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/signal.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/signal.ts))
- `src/lib/server/name-check/sources/rdap.ts` — IANA bootstrap + registry override + DNS evidence + honest lookup_unavailable ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/sources/rdap.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/sources/rdap.ts))
- `src/lib/name-check/report.ts` — Wire contract with no field that could render as legal availability ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/name-check/report.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/name-check/report.ts))
- `src/routes/api/name-check/+server.ts` — The protected public endpoint: IP limiter before any upstream call, bounded body, deadline child for the fan-out ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/name-check/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/name-check/+server.ts))

## Tests

- `src/lib/server/name-check/similarity.test.ts` — The spec ladder in order, Kölner Phonetik on the textbook examples ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/similarity.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/similarity.test.ts))
- `src/lib/server/name-check/signal.test.ts` — Each level's predicate and the manual-review rule ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/name-check/signal.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/name-check/signal.test.ts))

## Proof

- [`/showcases/name-check`](https://www.v10r.dev/showcases/name-check) — The form, the report, the coverage table with a manual link on every row

## Invariants

- The report never states legal availability, a safety verdict or a risk percentage; a similarity score is always shown with its basis.
- The submitted name never reaches a log line or a store; only its sha256 keys the cache, and only successes are cached.
- The public endpoint runs the IP rate limiter before any upstream call; the limiter fails closed, so without its key-value store the endpoint refuses rather than spending source quotas unprotected.

## Emulation notes

- Keep the similarity engine pure and fixture-tested, thresholds in config.ts; derive the level from predicates over evidence, never from a count.
- Put the rate limiter in the route before the fan-out, and keep it fail-closed: a check spends every live source's quota, so an unprotected endpoint is a quota-exhaustion lever.

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Multi-source aggregation](multi-source-aggregation.md) — The check is one adoption of the aggregation mechanism over trademark, register and domain sources.
- [Rate limiting](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/rate-limiting.md) — The public endpoint runs the IP limiter before any upstream call, and the limiter fails closed.

**Assumes (platform conventions in scope)**

- [Multi-client core](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/multi-client-core.md) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.


---

_Machine-readable record: `name-check` in `pattern-library/registry.json`._
