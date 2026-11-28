# Intent-based preloading

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

**Kind:** pattern — build it in the target project

**Category:** Interaction Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** low — speculative only, never on a correctness path

A policy layer over the app-wide `data-sveltekit-preload-data="hover"` default, for the two cases the blanket setting gets wrong: routes too expensive to speculate on, and next screens predictable enough that waiting for a hover wastes the idle time.

**When to use:** Use when a link's cost or its probability differs from the average — an expensive report gets `code`, a strongly predicted next step gets `code-data` or a programmatic preload.

## Avoid when

- The route's data is expensive, highly volatile or unlikely to be used — a preload creates real backend work on a guess
- Bandwidth may be constrained, or a speculative load would pollute a cache
- No link's cost or follow-through probability differs from the average — the app-wide hover default already covers it

## Alternatives

- **SvelteKit's app-wide `data-sveltekit-preload-data="hover"` default alone** — prefer when every link has roughly average cost and probability, so no per-link policy is needed

## Docs

- `docs/blueprint/velocity/interaction.md#intent-based-preloading` — The six levels and what each is for ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/interaction.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/interaction.md))

## Code

- `src/lib/nav/preload.ts` — PreloadIntent → SvelteKit attributes, preloadNow, preloadOnIdle ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/nav/preload.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/nav/preload.ts))
- `src/app.html` — The app-wide hover default this layers over ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/app.html) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/app.html))

## Tests

- `src/lib/nav/preload.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/nav/preload.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/nav/preload.test.ts))

## Proof

- [`/showcases/velocity/interaction`](https://www.v10r.dev/showcases/velocity/interaction)

## Invariants

- Preloading is never required for correctness — every call swallows its failures, so a warm cache cannot become load-bearing and let the cold path rot unnoticed.
- Speculation is cancellable or harmless; nothing in the preload path mutates.
- Data never fetches from mere visibility: `viewport` appears only in the code column, because on a page of forty links it would run forty route loads for someone who scrolled past.
- Idle work yields to real user work and is cancellable on unmount.

## Emulation notes

- The expensive level is `data` — it runs the route's real `load`. `code` is a CDN chunk and costs the server nothing, which is why an uncertain-but-heavy route gets code only.
- `requestIdleCallback` is still missing in Safari; the timeout fallback is late rather than never, which is the right failure for work nobody is waiting on.

## Relationships

**Referenced by**

- [Idle and speculative work](https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/idle-work.md)


---

_Machine-readable record: `intent-preloading` in `pattern-library/registry.json`._
