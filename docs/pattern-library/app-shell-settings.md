---
title: "Settings (theme cookie, language, a11y)"
description: "A settings hub page covering appearance (theme cookie), language, privacy toggles, and accessibility preferences, backed by a load/save form action."
category: "App Shell & Navigation"
---

# Settings (theme cookie, language, a11y)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** App Shell & Navigation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

A settings hub page covering appearance (theme cookie), language, privacy toggles, and accessibility preferences, backed by a load/save form action.

**When to use:** Reach for it when adding a new user-configurable preference or feature toggle to the account settings hub.

## Docs

- [docs/blueprint/app-shell/settings.md](/docs/blueprint/app-shell/settings) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/settings.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/settings.md))

## Code

- `src/lib/state/theme.svelte.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/theme.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/theme.svelte.ts))

## Proof

- [`/account/settings`](/account/settings) (app route, no showcase)

---

_Machine-readable record: `app-shell-settings` in `mcp/patterns.registry.json`._
