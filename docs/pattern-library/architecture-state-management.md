---
title: "State management (Svelte 5 runes)"
description: "Establishes v10r's rune-based state strategy — $state/$derived for component state, .svelte.ts modules or the Context API for shared state, with an SSR-safety…"
category: "Architecture & Request Pipeline"
---

# State management (Svelte 5 runes)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Architecture & Request Pipeline · **Tier:** light · **Risk:** low — structural pattern, no external services

Establishes v10r's rune-based state strategy — $state/$derived for component state, .svelte.ts modules or the Context API for shared state, with an SSR-safety rule against module-level state leaking across requests.

**When to use:** Reach for it when deciding whether shared reactive state should be a .svelte.ts module or Context-API-provided, especially anything touched during SSR.

## Docs

- [docs/blueprint/state.md](/docs/blueprint/state) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/state.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/state.md))

## Code

- `src/lib/state/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/state) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/state))

---

_Machine-readable record: `architecture-state-management` in `mcp/patterns.registry.json`._
