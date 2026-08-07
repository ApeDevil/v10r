---
title: "Update flow (silent + idle toast, no auto skipWaiting)"
description: "A pending service-worker update rides the next client-side navigation silently, or for navigation-less sessions surfaces one persistent reload toast after 30…"
category: "PWA"
---

# Update flow (silent + idle toast, no auto skipWaiting)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** PWA · **Tier:** light · **Risk:** low — UI prompt only, no forced reload

A pending service-worker update rides the next client-side navigation silently, or for navigation-less sessions surfaces one persistent reload toast after 30 minutes, and never auto-activates with skipWaiting().

**When to use:** Use when rolling out a new service-worker version without disrupting an in-progress user session.

## Docs

- [docs/blueprint/pwa.md](/docs/blueprint/pwa) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/pwa.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/pwa.md))

## Code

- `src/lib/components/shell/UpdatePrompt.svelte` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/shell/UpdatePrompt.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/shell/UpdatePrompt.svelte))

---

_Machine-readable record: `pwa-update-flow` in `mcp/patterns.registry.json`._
