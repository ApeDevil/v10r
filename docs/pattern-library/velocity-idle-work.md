---
title: "Idle and speculative work"
description: "Useful non-critical preparation performed after the page is interactive: preloading probable code, hydrating embeds on intersection, and the PWA's idle update…"
category: "Interaction Velocity"
---

# Idle and speculative work

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Interaction Velocity · **Tier:** light · **Maturity:** implemented · **Risk:** low — never on a correctness path

Useful non-critical preparation performed after the page is interactive: preloading probable code, hydrating embeds on intersection, and the PWA's idle update toast, which never calls skipWaiting on its own.

**When to use:** Use to spend the idle time between the critical render and the next interaction — warming caches, loading probable feature code, preparing indexes.

## Docs

- [docs/blueprint/velocity/interaction.md#idle-and-speculative-work](/docs/blueprint/velocity/interaction) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/interaction.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/interaction.md))

## Code

- `src/lib/nav/preload.ts` — preloadOnIdle, with the Safari timeout fallback ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/nav/preload.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/nav/preload.ts))
- `src/lib/actions/hydrate-embeds.ts` — Hydrates on intersection rather than on load ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/actions/hydrate-embeds.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/actions/hydrate-embeds.ts))

## Depends on

- [Intent-based preloading (six levels over SvelteKit triggers)](/docs/pattern-library/intent-preloading)

---

_Machine-readable record: `velocity-idle-work` in `pattern-library/registry.json`._
