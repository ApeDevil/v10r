---
title: "Registered jobs (retention, cleanup, sync, delivery)"
description: "The concrete job implementations — retention sweeps, cleanup, external sync, and delivery — are idempotent slug-keyed functions run by the shared runner and…"
category: "Jobs & Scheduling"
---

# Registered jobs (retention, cleanup, sync, delivery)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Jobs & Scheduling · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — idempotent, age-filtered deletes/syncs, admin-gated manual trigger

The concrete job implementations — retention sweeps, cleanup, external sync, and delivery — are idempotent slug-keyed functions run by the shared runner and manageable from an admin UI.

**When to use:** Use this catalog as the template when adding a new retention, cleanup, sync, or delivery job to the registry.

## Docs

- [docs/blueprint/architecture/jobs.md](/docs/blueprint/architecture/jobs) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/jobs.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/jobs.md))

## Code

- `src/lib/server/jobs/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/jobs) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/jobs))

## Proof

- [`/admin/jobs`](/admin/jobs) (app route, no showcase)

---

_Machine-readable record: `jobs-registered-catalog` in `pattern-library/registry.json`._
