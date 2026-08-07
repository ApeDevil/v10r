---
title: "GDPR data transparency (view · export · delete)"
description: "A privacy aggregator that collects everything the app knows about a user into one report, backing the view, export, and delete surfaces required by GDPR."
category: "Admin & Privacy"
---

# GDPR data transparency (view · export · delete)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Admin & Privacy · **Tier:** light · **Risk:** medium — legal-compliance surface; incomplete data collection breaches GDPR obligations

A privacy aggregator that collects everything the app knows about a user into one report, backing the view, export, and delete surfaces required by GDPR.

**When to use:** Use it whenever a new domain stores personal data and must be reflected in access, portability, or erasure requests.

## Docs

- [docs/blueprint/app-shell/user-account.md](/docs/blueprint/app-shell/user-account) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/user-account.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/user-account.md))
- [docs/stack/capabilities/gdpr.md](/docs/stack/gdpr) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/capabilities/gdpr.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/capabilities/gdpr.md))

## Code

- `src/lib/server/privacy/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/privacy) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/privacy))
- `src/routes/api/me/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/routes/api/me) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/routes/api/me))

## Proof

- [`/showcases/privacy/data`](/showcases/privacy/data)
- [`/showcases/privacy/rights`](/showcases/privacy/rights)

---

_Machine-readable record: `admin-privacy-gdpr` in `mcp/patterns.registry.json`._
