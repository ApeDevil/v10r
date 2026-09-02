---
title: "Full-screen model viewer & customizer (layout reset)"
description: "A full-screen model viewer and GLTF customizer (materials, parts, morph targets, presets) that resets the app layout while open."
category: "3D"
---

# Full-screen model viewer & customizer (layout reset)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** 3D · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — frontend only

A full-screen model viewer and GLTF customizer (materials, parts, morph targets, presets) that resets the app layout while open.

**When to use:** Use when a 3D showcase needs an immersive, full-screen viewer with live material or part customization.

## Docs

- [docs/blueprint/3d/3d-integration.md](/docs/blueprint/3d/3d-integration) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/3d/3d-integration.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/3d/3d-integration.md))

## Code

- `src/lib/components/3d/customizer/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/3d/customizer) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/3d/customizer))
- `src/lib/components/3d/ViewerScene.svelte` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/3d/ViewerScene.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/3d/ViewerScene.svelte))

## Proof

- [`/showcases/3d/[model]`](/showcases/3d/[model]) (app route, no showcase)

---

_Machine-readable record: `3d-model-viewer-customizer` in `pattern-library/registry.json`._
