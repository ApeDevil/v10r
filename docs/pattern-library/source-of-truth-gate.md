---
title: "Source-of-truth gate (one owner, bound copies)"
description: "Every fact has exactly one owner; every other copy is typed, imported, generated with a --check, or bound by a drift test with a non-empty control — and…"
category: "Truth & Evidence"
---

# Source-of-truth gate (one owner, bound copies)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Truth & Evidence · **Tier:** deep · **Maturity:** proven (verified 2026-10-10 @ 91f61a76-dirty) · **Risk:** low — the gates are tests; the cost is discipline about where facts live

Every fact has exactly one owner; every other copy is typed, imported, generated with a --check, or bound by a drift test with a non-empty control — and reading the owner fails closed instead of falling back to a second source.

**When to use:** Use whenever a fact must exist in more than one place — a client mirror of a server enum, a public page that states what a job enforces, a script that runs outside the bundler, two runtimes serving one registry.

## Avoid when

- The value is read in exactly one place — the owner and the reader are the same line, and a gate around it is ceremony
- Two sources genuinely need runtime arbitration — that is one owner too many; pick the owner instead of building an authority service

## Alternatives

- **Derive the copy instead of binding it (import or generate)** — prefer when the reader can reach the owner — a drift test is only for copies that cannot be derived
- **A runtime precedence chain (DB, then env, then default)** — prefer when never for authoritative configuration; acceptable only for presentation defaults where a wrong value is harmless

## Docs

- [docs/blueprint/integrity/truth.md#source-of-truth-gate](/docs/blueprint/integrity/truth) — The binding ladder (typed → imported → generated → drift test) and the fail-closed rule ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/integrity/truth.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/integrity/truth.md))
- [docs/foundation/self-expressive-project.md](/docs/foundation/self-expressive-project) — The principle: one source of truth, gates over prose ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/foundation/self-expressive-project.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/foundation/self-expressive-project.md))

## Code

- `src/lib/server/docs/doc-filter.ts` — Imported owner: which docs are public, read by the routes and the ingester ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/docs/doc-filter.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/docs/doc-filter.ts))
- `src/lib/server/retention/schedule.ts` — Owner of every retention window; jobs and the privacy page read it ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/retention/schedule.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/retention/schedule.ts))
- `src/lib/types/db-enums.ts` — Client mirror of the pgEnums, bound by a drift test ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/types/db-enums.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/types/db-enums.ts))
- `src/lib/server/ai/index.ts` — loadProviderRegistry: the DB is the only source; unreadable is an error, undecryptable is degraded, never an env fallback ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/index.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/index.ts))
- `scripts/patterns/build-derived.ts` — Generated copies with a byte-diff --check ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/patterns/build-derived.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/patterns/build-derived.ts))

## Tests

- `src/lib/types/db-enums.drift.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/types/db-enums.drift.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/types/db-enums.drift.test.ts))
- `src/lib/server/db/schema-filter.gate.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/schema-filter.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/schema-filter.gate.test.ts))
- `src/lib/server/retention/schedule.gate.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/retention/schedule.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/retention/schedule.gate.test.ts))
- `src/lib/credits/registry.gate.test.ts` — Includes the non-empty scan control ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/credits/registry.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/credits/registry.gate.test.ts))
- `src/lib/server/mcp/patterns/parity.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/mcp/patterns/parity.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/mcp/patterns/parity.test.ts))
- `src/lib/server/ai/connections.test.ts` — Undecryptable key marks the registry degraded ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/connections.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/connections.test.ts))

## Invariants

- One fact, one owner. A second writable copy is a defect, not a configuration option.
- Every non-owner copy is typed, imported, generated with a check, or drift-tested — there is no fifth kind.
- A drift test asserts its own scan was non-empty; an empty list must not pass vacuously.
- Exemption lists fail when an entry no longer applies, so allowances only shrink.
- Reading the owner succeeds or fails loudly; it never silently substitutes another source.

## Emulation notes

- Climb the binding ladder from the cheap end: a `Record<Id, …>` type costs nothing at runtime and fails at compile time, so reach for a drift test only when the copy cannot be typed, imported or generated.
- Write the non-empty control first. The common failure of a drift test is not a false positive but a refactor that renames the thing it scans, after which it passes forever.
- Treat a fallback to a second configuration source as a bug report waiting to happen: it turns "the owner is unreadable" into "the system is quietly using last year's key".
- Generated copies are committed and diffed by the gate (`--check`), so a reviewer sees the derived change in the same diff as the source change.

---

_Machine-readable record: `source-of-truth-gate` in `pattern-library/registry.json`._
