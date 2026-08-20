---
title: "Localized manifest & installability"
description: "The web manifest is served dynamically so name/description follow the Paraglide locale cookie, with maskable icons and an explicit cache header that pre-empts…"
category: "PWA"
---

# Localized manifest & installability

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** PWA · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — static/localized metadata endpoint, no mutation

The web manifest is served dynamically so name/description follow the Paraglide locale cookie, with maskable icons and an explicit cache header that pre-empts the hooks' no-store stamp.

**When to use:** Use when the app must be installable across locales with a manifest that stays consistent with the visitor's language.

## Docs

- [docs/blueprint/pwa.md](/docs/blueprint/pwa) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/pwa.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/pwa.md))
- [docs/stack/capabilities/pwa.md](/docs/stack/pwa) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/capabilities/pwa.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/capabilities/pwa.md))

## Code

- `src/routes/manifest.webmanifest/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/routes/manifest.webmanifest) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/routes/manifest.webmanifest))

## Proof

- [`/showcases/pwa`](/showcases/pwa)

---

_Machine-readable record: `pwa-manifest` in `mcp/patterns.registry.json`._
