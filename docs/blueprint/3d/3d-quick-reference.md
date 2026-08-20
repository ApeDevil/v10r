# 3D Quick Reference

Copy-paste starting points for Threlte 8 in v10r. Threlte only — no vanilla Three.js. For the architecture and project decisions, read `docs/blueprint/3d/3d-integration.md`; for Three.js / Threlte fundamentals, use the `3d` skill.

## Dependencies

```jsonc
// package.json — then rebuild/restart the container
"@threlte/core": "^8.3.1",
"@threlte/extras": "^9.0.0",
"three": "^0.183.2"
```

## Page Setup

Disable SSR and prerender once at the `3d/` layout — WebGL needs `window`, and the Three.js bundle is browser-only:

```typescript
// showcases/3d/+layout.ts
export const ssr = false;
export const prerender = false;
```

A leaf that breaks out of the layout (`[model]/+page@.svelte`) repeats these flags in its own `+page.ts`.

## Canvas + Scene

Page hosts `<Canvas>` and wraps it in `<svelte:boundary>` for the WebGL fallback. Scene contents live in a child component for code-splitting.

```svelte
<!-- +page.svelte -->
<script lang="ts">
import { Canvas } from '@threlte/core';
import { BoundaryFallback } from '$lib/components/composites';
import Scene from './Scene.svelte';
</script>

<svelte:boundary>
  <div class="container">
    <Canvas>
      <Scene />
    </Canvas>
  </div>

  {#snippet failed(error, reset)}
    <BoundaryFallback
      title="3D scene unavailable"
      description="WebGL is required. Check browser support or graphics drivers."
      minHeight="100vh"
      {reset}
    />
  {/snippet}
</svelte:boundary>

<style>
  .container { width: 100%; height: 100vh; }
</style>
```

## Scene Contents

Scene is `<T>` proxy components — camera, lights, meshes. No `new THREE.Scene()`, no renderer, no render loop; Threlte owns the renderer lifecycle.

```svelte
<!-- Scene.svelte -->
<script lang="ts">
import { T } from '@threlte/core';
import { OrbitControls } from '@threlte/extras';
</script>

<T.PerspectiveCamera makeDefault position={[3, 3, 3]}>
  <OrbitControls />
</T.PerspectiveCamera>
<T.DirectionalLight position={[10, 10, 10]} intensity={1} />
<T.AmbientLight intensity={0.5} />

<T.Mesh>
  <T.BoxGeometry />
  <T.MeshStandardMaterial color="hotpink" />
</T.Mesh>
```

## Animation: useTask

Per-frame work uses **`useTask`** from `@threlte/core` (Threlte 8 — not `useFrame`, that's Threlte 7). Drive reactive props with `$state`:

```svelte
<script lang="ts">
import { T, useTask } from '@threlte/core';

let rotation = $state(0);
useTask((delta) => {
  rotation += delta;
});
</script>

<T.Mesh rotation.y={rotation}>
  <T.BoxGeometry />
  <T.MeshStandardMaterial color="hotpink" />
</T.Mesh>
```

## Reactive Props

Props from `$props()` flow straight into `<T>` attributes — no manual `needsUpdate`. Use `$effect` only for imperative objects Threlte doesn't proxy (e.g. an `AnimationMixer`):

```svelte
<script lang="ts">
let { color = '#ff0000', wireframe = false } = $props();
</script>

<T.Mesh>
  <T.BoxGeometry />
  <T.MeshStandardMaterial {color} {wireframe} />
</T.Mesh>
```

## GLTF Loading

Load with `useGltf` (returns a store — read `$gltf`) or the `<GLTF>` component. Guard the render until it resolves:

```svelte
<script lang="ts">
import { T, useTask } from '@threlte/core';
import { useGltf } from '@threlte/extras';
import { AnimationMixer } from 'three';

let { defaultAnimation }: { defaultAnimation?: string } = $props();

// svelte-ignore state_referenced_locally
const gltf = useGltf('/models/Fox.glb');
let mixer: AnimationMixer | undefined;

$effect(() => {
  const data = $gltf;
  if (!data || !defaultAnimation) return;
  mixer = new AnimationMixer(data.scene);
  const clip = data.animations.find((c) => c.name === defaultAnimation);
  if (clip) mixer.clipAction(clip).play();
});

useTask((delta) => mixer?.update(delta));
</script>

{#if $gltf}
  <T is={$gltf.scene} />
{/if}
```

GLB models ship from `static/models/` and serve at `/models/*.glb`. The `<GLTF url="..." />` component is the no-animation shortcut.

## Route Structure

3D showcases live under the public locale group (routes are `/showcases/3d/...`, plural):

```
src/routes/[[locale=locale]]/(public)/showcases/3d/
├── +layout.ts              # ssr=false, prerender=false (whole subtree)
├── +page.svelte            # scene gallery
├── static-scene/           # GLTF helmet, OrbitControls
├── animated-scene/
│   ├── +page.svelte        # Canvas + boundary
│   └── Scene.svelte        # split for code-splitting
├── customize/[model]/      # GLTF customizer
└── [model]/                # config-driven viewer
```

## Gotchas

- **`useTask`, not `useFrame`** — Threlte 8 renamed the per-frame hook.
- **`useGltf` is a store** — read `$gltf`, never render scene contents before it resolves.
- **`makeDefault` type error** — Threlte's conditional prop type collapses to `undefined` under TypeScript; pass `makeDefault={THRELTE_MAKE_DEFAULT}` (the shared cast in `$lib/utils/threlte-workarounds.ts`) — markup `@ts-ignore` comments are not honored by svelte-check.
- **`state_referenced_locally`** — calling `useGltf(prop)` at script top reads a prop during init; silence with `// svelte-ignore state_referenced_locally`.
- **Keep 3D imports per route** — don't pull Three.js into a shared `+layout`; that defeats code-splitting.

## References

- `docs/blueprint/3d/3d-integration.md` — architecture, components, config registry
- `3d` skill — Three.js + Threlte fundamentals, physics, WebGPU
- `/showcases/3d` — live scenes (also the test spec)
- Threlte: https://threlte.xyz/docs
