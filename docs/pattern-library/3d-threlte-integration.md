---
title: "Threlte integration (SSR-off, code-split model registry)"
description: "Threlte 8 is wired into SvelteKit with SSR and prerendering disabled for the 3D route subtree, plus a static model config registry driving camera, lights, and…"
category: "3D"
---

# Threlte integration (SSR-off, code-split model registry)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** 3D · **Tier:** light · **Risk:** low — frontend only

Threlte 8 is wired into SvelteKit with SSR and prerendering disabled for the 3D route subtree, plus a static model config registry driving camera, lights, and controls.

**When to use:** Use when adding any Three.js/WebGL 3D scene to a SvelteKit route in this app.

## Docs

- [docs/blueprint/3d/3d-integration.md](/docs/blueprint/3d/3d-integration) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/3d/3d-integration.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/3d/3d-integration.md))
- [docs/stack/capabilities/3d-web.md](/docs/stack/3d-web) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/capabilities/3d-web.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/capabilities/3d-web.md))

## Code

- `src/lib/components/3d/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/3d) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/3d))
- `src/lib/config/models.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/config/models.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/config/models.ts))

## Proof

- [`/showcases/3d`](/showcases/3d)

---

_Machine-readable record: `3d-threlte-integration` in `mcp/patterns.registry.json`._
