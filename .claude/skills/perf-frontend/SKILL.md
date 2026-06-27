---
name: perf-frontend
description: Velociraptor frontend performance — Svelte 5 reactivity cost, hydration, bundle size, Core Web Vitals (LCP/INP/CLS), images via R2, fonts, UnoCSS extraction. Use when touching components, client state, rendering, preload directives, images, or fonts and performance matters. Project-truth guardrail, not a generic CWV tutorial. (project)
---

# Frontend Performance (v10r)

Svelte 5 + SvelteKit 2 + UnoCSS + Vercel + R2. This is a **guardrail and gap-map**, not a tutorial — v10r already does most of it right. Encode the invariants, know the gotchas, link out for generic CWV theory.

**Prime directive: measure before you optimize.** No change without a number from `web-vitals` (field) or Lighthouse/TBT (lab). Always test a **production build** — dev mode disables minification/splitting and is incomparable.

## Contents

- [Invariants (don't break)](#invariants-dont-break)
- [Levers (stack-specific)](#levers-stack-specific)
- [Gotchas that bite](#gotchas-that-bite)
- [Already in v10r](#already-in-v10r)
- [Out of scope](#out-of-scope)
- [Measure](#measure)
- [References](#references)

## Invariants (don't break)

| Rule | Why |
|------|-----|
| `$derived` for computed values, **never** `$effect` to sync state | `$effect`-to-derive causes an extra render pass and can loop (`effect_update_depth_exceeded`). `$effect` is for true side effects only — analytics, DOM APIs, 3rd-party bridges. |
| Keep `$effect` **synchronous** | State read **after `await`** inside `$effect` is silently untracked (svelte#9309). Pull async through `load()`. |
| Keyed `{#each list as item (item.id)}` | Unkeyed is only safe for immutable static lists. Keys let Svelte move/delete nodes instead of rebuilding. |
| `$state.raw` for collections replaced **wholesale** | API results / table rows / search hits. Deep-proxy churn freezes large lists. Plain `$state()` only when you need property-level reactivity. |
| LCP image: `fetchpriority="high"`, explicit `width`/`height`, **never** `loading="lazy"`, URL in initial HTML | The single most underused LCP lever; lazy on LCP and JS-injected URLs defeat the preload scanner. |
| UnoCSS: **static class strings only** | Template-literal class construction is invisible to the build-time extractor. CSS-variable colors need `color-mix()`, not `/opacity` modifiers (broken with custom props — see [[unocss]] memory). |

## Levers (stack-specific)

- **Preload** — `data-sveltekit-preload-data="hover"` is the default (already on `<body>`). Downgrade to `"tap"` for high-churn data; pair with an offline guard (hover hard-navigates on degraded network, kit#9508).
- **Images** — `<enhanced:img>` for **build-time static** assets (emits AVIF/WebP + srcset + dimensions). For **R2 user images** use Vercel image optimization (`remotePatterns`) or `@unpic/svelte`; R2 needs a **custom domain** (not `r2.dev`) for CDN caching.
- **Fonts** — variable WOFF2, `preconnect` to the host, `font-display: optional` (no CLS) vs `swap` (fast paint, accepts a swap flash). Paraglide messages tree-shake to per-key ESM functions — zero runtime lookup cost.
- **Code-split heavy libs** — dynamic `import()` per use (the Chart.js pattern in `viz/_shared/register.ts`).
- **Heavy libs belong in `+page.server.ts`, not `+page.ts`** — anything imported in universal load ships to the browser (one date lib = ~30% bundle bloat). See [[perf-backend]] for the load-function split.

## Gotchas that bite

- **`$effect` read+write same state** → `effect_update_depth_exceeded`, and the error carries **no file/line** (svelte#16224, #13950). `untrack()` is a last resort, not the fix.
- **Body-level event delegation** — `stopPropagation()` inside a **Bits UI portal** (dialog/popover) silently drops inner click handlers (svelte#13213, #15975). Use `onclickcapture` or `on()`.
- **Runes ↔ non-runes interop** — passing a large `$state` array to a Svelte-4-style component triggers `deep_read` on every update and freezes ~10k items (svelte#10637). Wrap in a `readable` store.
- **UnoCSS `.ts` extraction** — needs `src/**/*.ts` in `content.pipeline.include` (already applied); complex dynamic classes still need the safelist.

## Already in v10r

Preload-on-hover (`app.html`); Chart.js dynamic-import split (`viz/_shared/register.ts`); font preconnect; 200+ icon safelist + `.ts` pipeline fix; `color-mix()` opacity workaround across menu/table/button components.

**Gaps (cross-ref):** no `web-vitals` RUM instrumentation; no ISR on static showcase pages (see [[perf-backend]]); `$state.raw` not yet applied to API-backed lists.

## Out of scope

CWV threshold numbers, LoAF API mechanics, `transform`-vs-layout animation, WOFF2 rationale → **web.dev** (don't re-encode). Load/SSR/streaming → [[perf-backend]]. Streaming endpoints → [[perf-api]].

## Measure

`web-vitals/attribution` build → field RUM (INP **cannot** be measured in lab; use TBT as the lab proxy). Lighthouse for lab CWV. `import('web-vitals')` is ~2KB. Test prod builds only.

## References

- Skills: [[svelte5-runes]], [[sveltekit]], [[design-system]]
- `docs/stack/core/svelte.md`, `docs/stack/core/sveltekit.md`
