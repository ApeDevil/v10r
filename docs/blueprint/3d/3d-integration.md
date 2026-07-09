# 3D Web Integration

How v10r wires Threlte into SvelteKit. For Three.js / Threlte basics (scene graph, GLTF loading, materials, the `<T>` proxy, hooks), read the `3d` skill — this doc only covers the project-specific decisions and gotchas.

## Contents

- [What v10r Uses](#what-v10r-uses) - Threlte-only, no vanilla, no physics dep
- [Route Structure](#route-structure) - Where 3D pages live
- [Rendering Strategy](#rendering-strategy) - SSR/prerender off at the layout
- [Scene Pattern](#scene-pattern) - Canvas + T + useTask in this app
- [Model Config Registry](#model-config-registry) - `$lib/config/models.ts`
- [Components](#components) - `$lib/components/3d/`
- [Part Explorer](#part-explorer) - opt-in click-to-inspect (sofa)
- [Asset Pipeline](#asset-pipeline) - GLB assets in `static/models/`
- [WebGL Fallback](#webgl-fallback) - `<svelte:boundary>`, not manual detection
- [Gotchas](#gotchas) - Things this project actually hit

## What v10r Uses

| Decision | Choice | Why |
|----------|--------|-----|
| Library | **Threlte 8** (`@threlte/core`, `@threlte/extras`) | Declarative scenes, Svelte 5 reactivity |
| Vanilla Three.js | **Not used** in showcases | Threlte covers every case here |
| Physics | **No dep** | No `@threlte/rapier` installed — add only if a showcase needs it |
| Three.js | `three` ^0.183 (direct, for `AnimationMixer`, `AnimationClip`, types) | |

Threlte is the single approach. Do not mix imperative Three.js (`new THREE.Scene()` in `onMount`) with `<Canvas>` in the same scene — pick one, and here it is always Threlte.

## Route Structure

3D showcases live under the public locale group:

```
src/routes/[[locale=locale]]/(public)/showcases/3d/
  +layout.ts                      # ssr=false, prerender=false (whole subtree)
  +page.svelte                    # index / scene gallery
  +page.ts
  static-scene/+page.svelte       # GLTF helmet, OrbitControls
  animated-scene/
    +page.svelte
    Scene.svelte                  # scene snippet (split for code-splitting)
    +page.ts
  [model]/+page@.svelte           # generic model viewer (config-driven)
  customize/[model]/+page@.svelte # GLTF customizer
```

`+page@.svelte` (the `@` breaks out of the layout) is used for full-viewport viewers that don't want the showcase chrome.

## Rendering Strategy

SSR and prerender are disabled **once at `+layout.ts`**, covering the whole `3d/` subtree — not repeated per page:

```typescript
// showcases/3d/+layout.ts
export const ssr = false;
export const prerender = false;
```

WebGL needs `window`/`canvas`, which don't exist on the server, and the Three.js bundle should ship to the browser only. A leaf route that breaks out of the layout (e.g. `[model]/+page.ts`) repeats these flags because the layout no longer wraps it.

## Scene Pattern

The project pattern: `<Canvas>` wrapper in the page, scene contents as `<T>` components, animation driven by **`useTask`** (Threlte 8 — not `useFrame`). GLTFs load via `useGltf` / `<GLTF>`.

```svelte
<!-- static-scene/+page.svelte (trimmed) -->
<script lang="ts">
import { Canvas, T } from '@threlte/core';
import { GLTF, OrbitControls } from '@threlte/extras';
</script>

<Canvas>
  <T.PerspectiveCamera makeDefault position={[3, 3, 3]}>
    <OrbitControls />
  </T.PerspectiveCamera>
  <T.DirectionalLight position={[10, 10, 10]} intensity={1} />
  <T.AmbientLight intensity={0.5} />
  <GLTF url="/models/DamagedHelmet.glb" />
</Canvas>
```

Animation + the `AnimationMixer` lifecycle uses `useTask` and a `$effect` that reacts to the loaded GLTF and the current clip:

```svelte
<!-- Scene.svelte (trimmed) -->
<script lang="ts">
import { T, useTask } from '@threlte/core';
import { useGltf } from '@threlte/extras';
import { AnimationMixer } from 'three';

const gltf = useGltf('/models/Fox.glb');
let mixer: AnimationMixer | undefined;

$effect(() => {
  const data = $gltf;
  if (!data) return;
  if (!mixer) mixer = new AnimationMixer(data.scene);
  // ...select + play clip
});

useTask((delta) => mixer?.update(delta));
</script>

{#if $gltf}
  <T is={$gltf.scene} />
{/if}
```

`useGltf` returns a store — read it with `$gltf`. Guard renders with `{#if $gltf}` or `{#await gltf}`; the scene is `undefined` until the asset loads.

## Model Config Registry

Camera, lights, controls, and render behavior for each model live in **`$lib/config/models.ts`** as a static registry (`Model3D`, `CameraPreset`, `OrbitControlsConfig`, `RenderMode`). Viewer components (`ViewerScene`, `SceneCard`) consume the resolved config; pages pass it in.

**Scene snippets are NOT referenced from the config.** Pages map a model ID to its scene component at the route level. This avoids a circular dependency and preserves per-route code-splitting (a model's Three.js scene only loads on its own route).

Customizer config (materials, parts, morph targets, presets) lives alongside in `$lib/config/customization.ts`. The click-to-inspect part-explorer registry lives in `$lib/config/parts.ts` — see [Part Explorer](#part-explorer).

## Components

Reusable 3D building blocks live in **`$lib/components/3d/`** (barrel: `$lib/components/3d/index.ts`). Read the source for current props.

| Component | Role |
|-----------|------|
| `ViewerScene` | Config-driven scene: camera, lights, GLTF, animation mixer |
| `SceneCard` | Thumbnail card with a mini live scene |
| `SceneContent` | Shared scene body |
| `ViewerDialog` / `ViewerOverlay` | Full-screen viewer modal + controls overlay (overlay also hosts the part-selector toggle group) |
| `PartHighlightLayer` | Selection visuals for the [part explorer](#part-explorer) — theme-accent outline + ghosting; interactive models only |
| `PartInfoPanel` / `PartPhotoGallery` | Non-modal part info panel (label, description, photo thumbnails) + full-size photo lightbox |
| `customizer/` | GLTF customizer (`GltfCustomizer`, `CustomizerLayer`, material/part/accessory pickers, morph-target sliders, preset bar) |

`viz/` and `3d/` are intentionally excluded from the default `$lib/components` barrel so Three.js / Chart.js don't get bundled into surfaces that don't use them. Import 3D components from `$lib/components/3d` directly.

## Part Explorer

Opt-in click-to-inspect for a model's logical parts (the Glam Velvet Sofa is the only one wired today). Click/tap a part → it gets a theme-accent outline while every other part ghosts to low opacity, the camera flies to frame it, and a non-modal `PartInfoPanel` opens with the part's label, description, and three example photos — thumbnails open a full-size lightbox (the sofa body also cross-links to the customizer). The panel is deliberately NOT a modal `Drawer`: a scrim blocks orbiting and swallows part-switch clicks. Keyboard-accessible (an `aria-pressed` toggle-button group in the overlay), deep-linkable (`?part=legs`, standalone page only), and touch-friendly (click-driven — no hover dependency).

**Opt-in and gated.** Interactivity turns on only when a part registry exists for the model. `ViewerScene` enables `interactivity()` + `CameraControls` (with `fitToBox` fly-to) when `parts?.length`; otherwise it renders the byte-identical `OrbitControls` path with no picking and no parts UI. Every model except the sofa is unchanged. Add a model by adding a `PART_EXPLORERS_BY_MODEL` entry in `parts.ts` — no component edits.

**Registry — `$lib/config/parts.ts`.** Pure, WebGL-free single source of truth. A `PartDef` maps a stable logical id (used for selection state and the `?part=` link) to one or more GLTF mesh-name patterns, a label, a description, example `photos` (src/alt/caption/credit — assets under `static/images/parts/`, licenses in `static/images/parts/ATTRIBUTION.md`), and an optional `customizeHint`. Never key logic on raw artist mesh names — they drift across re-exports and split into `_0`/`_1` primitives, so matching is exact-or-`_N`-prefix tolerant. `resolvePartId` (raycast hit → part id) and `collectPartMeshes` are pure and unit-tested in `parts.test.ts`.

**Highlight — `PartHighlightLayer.svelte`.** Visual-only, applied imperatively. Hover = subtle emissive tint. Selection = inverted-hull outline in the theme accent plus every other part ghosted to low opacity (`transparent` toggle needs `needsUpdate` — see the `3d` skill); the selected part itself gets NO emissive, because dark materials wash out under tone mapping. The outline color resolves `--color-primary` via `css-color.ts` (tokens are oklch, which `THREE.Color` can't parse — normalize via 1px canvas `getImageData`) and re-resolves live on `<html>` `class`/`data-palette` mutations, so it tracks light/dark and palette scheme changes. The layer clones each material on first run (so it never mutates the shared cached GLB), captures original state, and restores on destroy. It **never disposes** model materials — `useGltf` caches the GLB and the customizer route shares the same materials. Deliberately not `<Outlines>` (it reparents meshes and drops the GLTF's baked transforms) and not postprocessing (no postprocessing dep is installed). Selection wins over hover; imperative material changes call `invalidate()` for on-demand render mode.

## Asset Pipeline

GLB models ship from **`static/models/`** and are served from `/models/*.glb`:

| File | Used by |
|------|---------|
| `DamagedHelmet.glb` | static-scene |
| `Fox.glb` | animated-scene |
| `RobotExpressive.glb` | customizer / viewer |
| `GlamVelvetSofa.glb` | customizer / viewer |

Attribution lives in `static/models/ATTRIBUTION.md` — keep it current when adding assets.

Use **GLB** (binary glTF), not OBJ/FBX. For compression specifics (Draco, KTX2/Basis textures, decoder paths), see the `3d` skill — no compressed models are wired in yet, so adding one means also serving its decoder.

## WebGL Fallback

This project does **not** hand-roll WebGL feature detection. Scenes are wrapped in `<svelte:boundary>` with a `BoundaryFallback` snippet; if Threlte/WebGL throws, the boundary catches it:

```svelte
<svelte:boundary>
  <Canvas>...</Canvas>

  {#snippet failed(error, reset)}
    <BoundaryFallback
      title="3D scene unavailable"
      description="WebGL is required. Check browser support or graphics drivers."
      minHeight="100vh"
      {reset}
    />
  {/snippet}
</svelte:boundary>
```

`BoundaryFallback` is in `$lib/components/composites`.

## Gotchas

- **`useTask`, not `useFrame`.** Threlte 8 renamed the per-frame hook. `useFrame` is Threlte 7.
- **`useGltf` is a store.** Read `$gltf`, and never render scene contents before it resolves — guard with `{#if $gltf}` / `{#await}`.
- **Morph-target animations fight the customizer.** When a model has morph customization, strip `morphTargetInfluences` tracks from clips before playing, or the mixer overwrites the customizer's values each frame (see `ViewerScene.svelte`).
- **`makeDefault` type error.** `T.PerspectiveCamera makeDefault` needs a `@ts-ignore` until tsgo supports the conditional type (noted inline in `ViewerScene.svelte`).
- **`state_referenced_locally` on `useGltf`.** Calling `useGltf(model.path)` at script top reads a prop during init; the codebase silences it with `// svelte-ignore state_referenced_locally`.
- **Code-split per route.** Keep each scene's Three.js imports inside its own route/scene component. Don't pull 3D libs into a shared parent `+layout.ts` — that defeats the per-route split.

## References

- `3d` skill — Three.js + Threlte fundamentals, physics, WebGPU
- `docs/blueprint/3d/3d-quick-reference.md` — copy-paste starting points
- Threlte: https://threlte.xyz/docs
- Three.js: https://threejs.org/docs
