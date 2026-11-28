---
title: "GDPR data rights"
description: "A privacy aggregator that collects everything the app knows about a user into one report, backing the view, export and erasure surfaces GDPR requires, and a…"
category: "Admin & Privacy"
---

# GDPR data rights

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Admin & Privacy · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — legal-compliance surface; incomplete data collection breaches GDPR obligations

A privacy aggregator that collects everything the app knows about a user into one report, backing the view, export and erasure surfaces GDPR requires, and a visitor "your data" page that streams cookie state, live request metadata and the same report.

**When to use:** Use whenever a new domain stores personal data and must be reflected in access, portability or erasure requests, and when visitors should see what analytics has captured about them.

**Needs:** required relational-db · conditional graph-db (when user content is also projected into a graph store that erasure must reach), object-storage (when users own stored files (avatars, uploads) that export and erasure must reach) · v10r's implementation uses key-value-store

## Docs

- [docs/blueprint/app-shell/user-account.md](/docs/blueprint/app-shell/user-account) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/user-account.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/user-account.md))
- [docs/stack/capabilities/gdpr.md](/docs/stack/gdpr) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/capabilities/gdpr.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/capabilities/gdpr.md))

## Code

- `src/lib/server/privacy/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/privacy) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/privacy))
- `src/routes/api/account/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/routes/api/account) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/routes/api/account))
- `src/lib/server/db/user/` — User management — User account routes and server-side data access covering profile, settings, notifications, security, and GDPR data export. Use when building or modifying the account area where users manage their own identity, security factors, and personal data. ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/db/user) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/db/user))
- `src/lib/server/analytics/` — Visitor "my data" transparency — An authenticated "Your data" page streams cookie state, live request metadata, and a full collectUserData report so a visitor can see what analytics has captured about them. Use when a product needs a self-service transparency/export view satisfying a GDPR Art. 15 access request. ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/analytics) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/analytics))

## Proof

- [`/showcases/privacy/data`](/showcases/privacy/data)
- [`/showcases/privacy/rights`](/showcases/privacy/rights)
- [`/showcases/auth/users`](/showcases/auth/users) — User management
- [`/showcases/analytics/my-data`](/showcases/analytics/my-data) — Visitor "my data" transparency

## Relationships

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.


---

_Machine-readable record: `gdpr-data-rights` in `pattern-library/registry.json`._
