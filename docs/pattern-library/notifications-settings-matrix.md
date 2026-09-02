---
title: "Settings matrix (channel × type)"
description: "The settings UI renders a channel-by-notification-type matrix backed by a form schema, letting a user toggle which channels receive which notification types."
category: "Notifications"
---

# Settings matrix (channel × type)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Notifications · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — user-scoped preference writes only

The settings UI renders a channel-by-notification-type matrix backed by a form schema, letting a user toggle which channels receive which notification types.

**When to use:** Use when users need granular per-channel, per-type control over which notifications they receive.

## Docs

- [docs/blueprint/notifications/settings.md](/docs/blueprint/notifications/settings) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/notifications/settings.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/notifications/settings.md))

## Code

- `src/lib/server/preferences/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/preferences) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/preferences))

## Proof

- [`/account/notifications`](/account/notifications) (app route, no showcase)

---

_Machine-readable record: `notifications-settings-matrix` in `pattern-library/registry.json`._
