---
title: "Asset delivery pipeline"
description: "Keeping images and fonts from dominating page load: metric-matched fallback faces generated from the font files, fonts deliberately not preloaded, and an R2…"
category: "Runtime Velocity"
---

# Asset delivery pipeline

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Runtime Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-10-10 @ 149f43a7-dirty) · **Risk:** low — delivery concerns only; a wrong fallback is a cosmetic shift

Keeping images and fonts from dominating page load: metric-matched fallback faces generated from the font files, fonts deliberately not preloaded, and an R2 image redirect the CDN can actually cache (s-maxage, URL stable per presign window).

**When to use:** Use wherever fonts or media are served — the JavaScript budget usually gets the attention while the bytes and the layout shift are elsewhere.

## Avoid when

- The face renders unlike its default metrics (bold display headings, optical-size axes), where a computed fallback makes the swap shift worse
- Content with system fonts only, where there is no swap to cover

## Alternatives

- **font preload of the active faces** — prefer when a measurement shows LCP improving without first paint getting later — in v10r it delayed FCP 60–120 ms and added ~110 ms TBT
- **a fallback-metrics library (fontaine, next/font)** — prefer when the framework already ships one; v10r's generator parses woff2 with Node's zlib to avoid a dependency and lands within 0.5% of next/font's values

## Docs

- [docs/blueprint/velocity/runtime.md#asset-delivery](/docs/blueprint/velocity/runtime) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/runtime.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/runtime.md))

## Code

- `scripts/fonts/build-fallback-faces.ts` — woff2 parser and metric generator; documents the serif exclusion ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/fonts/build-fallback-faces.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/fonts/build-fallback-faces.ts))
- `src/lib/styles/font-fallbacks.css` — Generated — rebuild, never hand-edit ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/styles/font-fallbacks.css) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/styles/font-fallbacks.css))
- `src/routes/api/blog/assets/[id]/image/+server.ts` — Published-only image redirect with a CDN-cacheable Cache-Control ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/blog/assets/[id]/image/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/blog/assets/[id]/image/+server.ts))
- `scripts/pwa/generate-icons.ts` — sharp-generated icon set ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/pwa/generate-icons.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/pwa/generate-icons.ts))

## Tests

- `src/lib/styles/font-fallbacks.gate.test.ts` — generated values match the font files; fallbacks exist exactly where measured to help ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/styles/font-fallbacks.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/styles/font-fallbacks.gate.test.ts))
- `src/lib/server/store/blog/public-image-url.test.ts` — presigned URL stable within its window ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/store/blog/public-image-url.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/store/blog/public-image-url.test.ts))

## Invariants

- A web font gets a fallback face only where measurement shows it reduces the shift at swap.
- Fallback metrics are generated from the installed font files, never hand-tuned.
- Fonts are not preloaded by default; a preload is justified by a measurement.
- A media response meant for the CDN carries s-maxage and sets no cookie.

## Emulation notes

- size-adjust = (web font average width / UPM) / (fallback average width / UPM); ascent, descent and line-gap overrides = web metric / UPM / size-adjust. The average width is the English-letter-frequency-weighted advance of a–z plus space.
- Lab CLS stayed ≈ 0 with and without fallbacks because the reflow lands below the first viewport — measure text-block geometry with the woff2 files blocked vs loaded instead. Shipped fallbacks cut that shift 34–62% across v10r's five typography sets.
- The serif display faces (Playfair, Fraunces) got no fallback: as bold headings, and Fraunces at a large optical size, their computed fallbacks made the shift worse. Isolate heading and body slots before shipping a fallback per family.
- Known gaps in v10r itself: blog body images carry no dimensions or lazy loading, and unhashed static files (/logo, /favicon.svg at 121 KB gz, /models/*.glb) revalidate on every visit.

---

_Machine-readable record: `velocity-asset-delivery` in `pattern-library/registry.json`._
