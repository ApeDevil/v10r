---
title: "Web push channel (declarative JSON, no PII)"
description: "Web push uses one Declarative Web Push JSON payload carrying no PII (brand title, generic body, same-origin navigate path) so real content only loads after…"
category: "PWA"
---

# Web push channel (declarative JSON, no PII)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** PWA · **Tier:** light · **Maturity:** implemented · **Risk:** low — no PII in payload, subscriptions capped and pruned per user

Web push uses one Declarative Web Push JSON payload carrying no PII (brand title, generic body, same-origin navigate path) so real content only loads after tap-through session auth, delivered synchronously and bypassing the outbox.

**When to use:** Use when adding browser push notifications that must render on iOS Safari without SW code while staying privacy-safe on lock screens.

## Docs

- [docs/blueprint/pwa.md](/docs/blueprint/pwa) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/pwa.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/pwa.md))

## Code

- `src/lib/server/notifications/channels/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/notifications/channels) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/notifications/channels))

---

_Machine-readable record: `pwa-web-push` in `pattern-library/registry.json`._
