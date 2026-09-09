---
title: "Asset delivery pipeline"
description: "Keeping images and fonts from dominating page load: generated icon sets, an R2-backed image proxy with stale-while-revalidate headers, and a document-weight…"
category: "Runtime Velocity"
---

# Asset delivery pipeline

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Runtime Velocity · **Tier:** light · **Maturity:** implemented · **Risk:** low — delivery concerns only

Keeping images and fonts from dominating page load: generated icon sets, an R2-backed image proxy with stale-while-revalidate headers, and a document-weight ceiling that catches inline-SVG bloat.

**When to use:** Use wherever media is served — the JavaScript budget usually gets the attention while the bytes are elsewhere.

## Docs

- [docs/blueprint/velocity/runtime.md#asset-delivery](/docs/blueprint/velocity/runtime) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/runtime.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/runtime.md))

## Code

- `scripts/pwa/generate-icons.ts` — sharp-generated icon set ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/pwa/generate-icons.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/pwa/generate-icons.ts))
- `src/routes/api/blog/assets/[id]/image/+server.ts` — Published-only image proxy with SWR cache headers ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/blog/assets/[id]/image/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/blog/assets/[id]/image/+server.ts))

---

_Machine-readable record: `velocity-asset-delivery` in `pattern-library/registry.json`._
