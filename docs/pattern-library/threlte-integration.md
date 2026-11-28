---
title: "Threlte integration"
description: "Threlte 8 is wired into SvelteKit with SSR and prerendering disabled for the 3D route subtree, plus a static model config registry driving camera, lights, and…"
category: "3D"
---

# Threlte integration

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** 3D · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — frontend only

Threlte 8 is wired into SvelteKit with SSR and prerendering disabled for the 3D route subtree, plus a static model config registry driving camera, lights, and controls.

**When to use:** Use when adding any Three.js/WebGL 3D scene to a SvelteKit route in this app.

## Docs

- [docs/blueprint/3d/3d-integration.md](/docs/blueprint/3d/3d-integration) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/3d/3d-integration.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/3d/3d-integration.md))
- [docs/stack/capabilities/3d-web.md](/docs/stack/3d-web) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/capabilities/3d-web.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/capabilities/3d-web.md))
- [docs/blueprint/3d/3d-quick-reference.md](/docs/blueprint/3d/3d-quick-reference) — Static & animated scenes — A shared scene component that renders either a static GLTF model with orbit controls or one with animation clips playing via an AnimationMixer. Use as the starting template for a new 3D showcase scene, static or animated. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/3d/3d-quick-reference.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/3d/3d-quick-reference.md))

## Code

- `src/lib/components/3d/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/3d) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/3d))
- `src/lib/3d/models.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/3d/models.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/3d/models.ts))
- `src/lib/components/3d/SceneContent.svelte` — Static & animated scenes ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/3d/SceneContent.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/3d/SceneContent.svelte))

## Proof

- [`/showcases/3d`](/showcases/3d)
- [`/showcases/3d/static-scene`](/showcases/3d/static-scene) — Static & animated scenes
- [`/showcases/3d/animated-scene`](/showcases/3d/animated-scene) — Static & animated scenes

---

_Machine-readable record: `threlte-integration` in `pattern-library/registry.json`._
