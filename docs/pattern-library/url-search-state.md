---
title: "URL state (one typed spec for search params, navigate vs shallow writes)"
description: "Search params are read and written through one typed spec shared by loads and components — invalid input falls back instead of throwing, defaults never reach…"
category: "Architecture & Request Pipeline"
---

# URL state (one typed spec for search params, navigate vs shallow writes)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Architecture & Request Pipeline · **Tier:** deep · **Maturity:** proven (verified 2026-10-23 @ 1a5496b-dirty) · **Risk:** low — a wrong mode shows up as a load that never re-runs (shallow for data) or charts that restart on every pick (navigate for view state)

Search params are read and written through one typed spec shared by loads and components — invalid input falls back instead of throwing, defaults never reach the URL, foreign params survive — and every write picks navigate (goto, the load re-runs) or shallow (replaceState from $app/navigation, no load, no navigation hooks), never raw history.

**When to use:** Use when sort, paging, a search term or a view selection must survive reload, sharing and back/forward.

## Avoid when

- The state is private or sensitive — tokens, emails, anything that must not land in logs, referrers or shared links
- The state is large or structured enough to hit URL length limits; keep it server-side and put an id in the URL

## Alternatives

- **runed useSearchParams or sveltekit-search-params** — prefer when a dependency is acceptable and the app does not need the same spec in its server loads
- **Snapshots (export const snapshot)** — prefer when the state should survive back/forward but must not be shareable

## Docs

- [docs/blueprint/state.md#url-state](/docs/blueprint/state) — The spec, the write-mode table, and why raw history writes are banned ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/state.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/state.md))

## Code

- `src/lib/state/url-state.ts` — urlParam codecs, readUrlState, writeUrlState, urlStateHref ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/url-state.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/url-state.ts))
- `src/lib/state/url-state.svelte.ts` — createUrlState: navigate vs shallow, debounce ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/url-state.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/url-state.svelte.ts))
- `src/routes/[[locale=locale]]/admin/users/list-params.ts` — A route-local spec the load and the page share ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/[[locale=locale]]/admin/users/list-params.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/[[locale=locale]]/admin/users/list-params.ts))

## Tests

- `src/lib/state/url-state.test.ts` — Fallbacks on hostile input, clamping, canonical URLs, foreign params, round trip ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/url-state.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/url-state.test.ts))
- `src/lib/state/url-state.svelte.test.ts` — navigate writes via goto, shallow via replaceState with page.state, debounce ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/url-state.svelte.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/url-state.svelte.test.ts))

## Proof

- [`/showcases/ui/typography`](/showcases/ui/typography) — Shallow: the font picks mirror into the URL
- [`/showcases/analytics/overview`](/showcases/analytics/overview) — Navigate: the range preset re-runs the load

## Invariants

- Every search param a page uses is parsed and written through one spec shared by its load and its component.
- Reading never throws; an invalid value is the param's fallback.
- A param equal to its fallback is never written, and params outside the spec are preserved.
- No code writes history directly; view state uses shallow replaceState, load-driving state uses goto.

## Emulation notes

- Decide the write mode by asking whether any load reads the param — not by whether the URL should change.
- Under shallow writes page.url stays at the loaded URL; read the values from the state object.
- Give the component the same fallback the load parses with, or a param dropped from the URL means two different things.

## Depends on

- [State management (Svelte 5 runes)](/docs/pattern-library/architecture-state-management)

---

_Machine-readable record: `url-search-state` in `pattern-library/registry.json`._
