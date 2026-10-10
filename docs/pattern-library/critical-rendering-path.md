---
title: "Critical rendering path (the LCP element paints from the document)"
description: "What the first viewport needs paints from the server HTML and its render-blocking CSS: no hydration gate on visible content, and a late-discovered LCP graphic…"
category: "Runtime Velocity"
---

# Critical rendering path (the LCP element paints from the document)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Runtime Velocity · **Tier:** deep · **Maturity:** implemented · **Risk:** low — rendering only; the cost is document weight on one page

What the first viewport needs paints from the server HTML and its render-blocking CSS: no hydration gate on visible content, and a late-discovered LCP graphic inlined server-side once, with a hashed CSS-mask fallback for client navigation.

**When to use:** Use when lab or field data shows LCP landing with hydration or the load event — the LCP element is hidden until JavaScript runs, or is an image found only after CSS and layout.

## Avoid when

- The LCP asset is large (over roughly 50 KB gz), so inlining it re-sends those bytes in every uncached document
- Most traffic is repeat visits on fast links, where a cached file beats bytes re-sent in HTML
- The LCP element is a photo — an <img> with fetchpriority="high" and declared dimensions is the right tool

## Alternatives

- **<link rel="preload"> for the late asset** — prefer when a measurement shows the earlier fetch finishing earlier — on a link saturated by module preloads it did not (v10r's logo: 450 ms earlier start, same finish)
- **an <img> with fetchpriority="high"** — prefer when the LCP element is a raster image that can be a real element rather than a CSS background or mask

## Docs

- [docs/blueprint/velocity/runtime.md#critical-rendering-path](/docs/blueprint/velocity/runtime) — The measurements, the {@html} hydration rule and the price ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/runtime.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/runtime.md))

## Code

- `src/lib/components/primitives/logo/LogoHero.svelte` — Server-only inline value, non-empty client placeholder, hashed mask fallback ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/primitives/logo/LogoHero.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/primitives/logo/LogoHero.svelte))
- `src/routes/[[locale=locale]]/(public)/_components/fadeIn.ts` — Hides only nodes still below the fold, so painted content never blinks out ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/[[locale=locale]]/(public)/_components/fadeIn.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/[[locale=locale]]/(public)/_components/fadeIn.ts))

## Invariants

- Content in the first viewport is visible without JavaScript — an entrance animation runs as CSS from first paint, never behind a hydration $effect.
- A preload is a measurement, not a default; it ships only when the lab shows the resource finishing earlier and first paint not getting later.
- An inlined asset ships once: a server-only value, never also in the client bundle.

## Emulation notes

- Chrome does not count an opacity:0 element as LCP. Revealing the hero in a hydration $effect made v10r's mobile LCP wait for ~245 KB gz of JavaScript, and with failed JavaScript the hero never appeared.
- {@html} hydration decides the trick: for a non-empty client value that differs from the server's, Svelte keeps the server nodes (warning hydration_html_changed, suppressed in place); an EMPTY client value discards them. Give the client a one-element placeholder, never ''.
- Inlining on both sides ships the string twice (+42 KB gz of JavaScript in v10r's case). Branch on import.meta.env.SSR so the client build tree-shakes the markup out.
- Measured in the lab only (Slow 4G, 4x CPU, n=5): mobile home LCP 4,276 -> 1,624 ms, reproduced 4,344 -> 1,632; desktop at parity. The document grew 8 -> 50 KB, and doc_html_kb cannot see it because it measures prerendered pages only. Confirm in field data before calling it a win.

---

_Machine-readable record: `critical-rendering-path` in `pattern-library/registry.json`._
