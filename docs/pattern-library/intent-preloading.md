---
title: "Intent-based preloading (six levels over SvelteKit triggers)"
description: "A policy layer over the app-wide `data-sveltekit-preload-data=\"hover\"` default, for the two cases the blanket setting gets wrong: routes too expensive to…"
category: "Interaction Velocity"
---

# Intent-based preloading (six levels over SvelteKit triggers)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Interaction Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** low — speculative only, never on a correctness path

A policy layer over the app-wide `data-sveltekit-preload-data="hover"` default, for the two cases the blanket setting gets wrong: routes too expensive to speculate on, and next screens predictable enough that waiting for a hover wastes the idle time.

**When to use:** Use when a link's cost or its probability differs from the average — an expensive report gets `code`, a strongly predicted next step gets `code-data` or a programmatic preload.

## Docs

- [docs/blueprint/velocity/interaction.md#intent-based-preloading](/docs/blueprint/velocity/interaction) — The six levels and what each is for ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/interaction.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/interaction.md))

## Code

- `src/lib/nav/preload.ts` — PreloadIntent → SvelteKit attributes, preloadNow, preloadOnIdle ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/nav/preload.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/nav/preload.ts))
- `src/app.html` — The app-wide hover default this layers over ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/app.html) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/app.html))

## Tests

- `src/lib/nav/preload.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/nav/preload.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/nav/preload.test.ts))

## Proof

- [`/showcases/velocity/interaction`](/showcases/velocity/interaction)

## Invariants

- Preloading is never required for correctness — every call swallows its failures, so a warm cache cannot become load-bearing and let the cold path rot unnoticed.
- Speculation is cancellable or harmless; nothing in the preload path mutates.
- Data never fetches from mere visibility: `viewport` appears only in the code column, because on a page of forty links it would run forty route loads for someone who scrolled past.
- Idle work yields to real user work and is cancellable on unmount.

## Emulation notes

- The expensive level is `data` — it runs the route's real `load`. `code` is a CDN chunk and costs the server nothing, which is why an uncertain-but-heavy route gets code only.
- `requestIdleCallback` is still missing in Safari; the timeout fallback is late rather than never, which is the right failure for work nobody is waiting on.

---

_Machine-readable record: `intent-preloading` in `pattern-library/registry.json`._
