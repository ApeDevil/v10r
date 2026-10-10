---
title: "Temporal data modeling (how much time to store)"
description: "A four-rung ladder — last write, transaction time (revision rows), valid time (periods, non-overlap by exclusion constraint), bitemporal — climbed only as far…"
category: "Databases & Storage"
---

# Temporal data modeling (how much time to store)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Databases & Storage · **Tier:** light · **Maturity:** proven (verified 2026-10-10 @ 91f61a76-dirty) · **Risk:** low — documentation over existing tables

A four-rung ladder — last write, transaction time (revision rows), valid time (periods, non-overlap by exclusion constraint), bitemporal — climbed only as far as a question someone actually asks; bitemporal only for auditable retroactive corrections.

**When to use:** Use when deciding whether a table needs history, an effective period, or both.

## Avoid when

- Nobody asks what was true at a past date — updated_at plus a revision table answers every edit-history question

## Docs

- [docs/blueprint/db/relational.md#how-much-time-to-model](/docs/blueprint/db/relational) — The ladder, the PG18 status, the bound convention ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/db/relational.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/db/relational.md))

## Code

- `src/lib/server/db/schema/showcase/temporal-record.ts` — Valid time + recorded_at ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/schema/showcase/temporal-record.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/schema/showcase/temporal-record.ts))
- `src/lib/server/db/showcase/mutations.ts` — queryTemporalAt — the as-of query ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/showcase/mutations.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/showcase/mutations.ts))
- `src/lib/server/db/schema/blog/revision.ts` — Transaction time: immutable revisions ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/db/schema/blog/revision.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/db/schema/blog/revision.ts))

## Proof

- [`/showcases/db/relational/mutability`](/showcases/db/relational/mutability) — #temporal — query what was valid on a date

---

_Machine-readable record: `temporal-data-modeling` in `pattern-library/registry.json`._
