---
name: 3d
description: Three.js and Threlte patterns for SvelteKit projects. Use when building 3D scenes, loading GLTF models, adding physics, creating WebGL/WebGPU content. Includes SSR setup, Rapier physics, asset compression, memory management. Essential for any 3D visualization or interactive content.
---

# Three.js + Threlte

Threlte is the declarative Three.js framework for Svelte 5. Current versions: Three.js r182, Threlte 8.3.1.

## Contents

- [Critical Setup](#critical-setup) - SSR config (REQUIRED)
- [Scene Basics](#scene-basics) - Canvas, camera, lighting
- [Loading Models](#loading-models) - GLTF, useGltf, compression
- [Interactivity](#interactivity) - Click, hover, pointer events → references/interaction.md
- [Animation](#animation) - useTask, AnimationMixer
- [Render Modes & Display](#render-modes--display) - on-demand/always, canvas ceiling → references/rendering-display.md
- [Physics](#physics) - Rapier integration
- [Performance](#performance) - Draw calls, instancing
- [Memory Management](#memory-management) - Disposal patterns
- [Mobile](#mobile) - Responsive 3D, pixel ratio
- [WebGPU](#webgpu) - Status, when to use
- [Gotchas](#gotchas) - Common failures
- [Anti-Patterns](#anti-patterns) - What not to do
- [References](#references) - Detailed guides

| Package | Purpose |
|---------|---------|
| `@threlte/core` | Canvas, T component, useTask |
| `@threlte/extras` | useGltf, interactivity, Environment |
| `@threlte/rapier` | Physics with Rapier engine |
| `three` | Three.js (peer dependency) |

## Critical Setup

**This config is REQUIRED. Without it, SSR fails.**

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-auto'; // or your preferred adapter
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter()
  },
  vitePlugin: {
    // REQUIRED for three.js SSR - prevents "window is not defined" errors
    ssr: {
      noExternal: ['three']
    }
  }
};
```

**Lock three.js version** to match Threlte's peer dependencies to avoid mysterious crashes.

## Scene Basics

```svelte
<script lang="ts">
  import { Canvas } from '@threlte/core';
  import Scene from './Scene.svelte';
</script>

<div class="h-screen w-full">
  <Canvas>
    <Scene />
  </Canvas>
</div>
```

**Scene.svelte** (separate file for better context access):
```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
</script>

<!-- Camera -->
<T.PerspectiveCamera makeDefault position={[5, 5, 5]} fov={50}>
  <OrbitControls enableDamping />
</T.PerspectiveCamera>

<!-- Lighting -->
<T.AmbientLight intensity={0.5} />
<T.DirectionalLight position={[10, 10, 5]} intensity={1} castShadow />

<!-- Grid helper (dev) -->
<T.GridHelper args={[10, 10]} />

<!-- Mesh -->
<T.Mesh position.y={0.5} castShadow>
  <T.BoxGeometry args={[1, 1, 1]} />
  <T.MeshStandardMaterial color="#ff6600" />
</T.Mesh>

<!-- Ground -->
<T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
  <T.PlaneGeometry args={[10, 10]} />
  <T.MeshStandardMaterial color="#333" />
</T.Mesh>
```

**Pierced props for performance:**
```svelte
<!-- GOOD: Pierced props enable equality comparison -->
<T.Mesh position.y={1} rotation.x={0.5}>

<!-- LESS OPTIMAL: Full object comparison every change -->
<T.Mesh position={{ x: 0, y: 1, z: 0 }}>
```

## Loading Models

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import { useGltf, useDraco } from '@threlte/extras';

  // Enable Draco compression decoder
  useDraco();

  const gltf = useGltf('/models/robot.glb');
</script>

{#if $gltf}
  <T is={$gltf.scene} scale={0.5} />
{/if}
```

**With specific nodes:**
```svelte
{#if $gltf}
  <T is={$gltf.nodes.Head} position.y={1.5} />
  <T is={$gltf.nodes.Body} />
{/if}
```

**Preload multiple assets:**
```svelte
<script lang="ts">
  import { useGltf, useTexture } from '@threlte/extras';

  const [model, texture] = await Promise.all([
    useGltf('/model.glb'),
    useTexture('/texture.jpg')
  ]);
</script>
```

**Rule:** Loaders must be instantiated at the top level of a component. Assets are only available to children of `<Canvas>`.

## Interactivity

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import { interactivity } from '@threlte/extras';

  // Enable globally (call once)
  interactivity();

  let hovered = $state(false);
  let clicked = $state(false);
</script>

<T.Mesh
  onclick={() => clicked = !clicked}
  onpointerenter={() => hovered = true}
  onpointerleave={() => hovered = false}
  scale={clicked ? 1.5 : 1}
>
  <T.BoxGeometry />
  <T.MeshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
</T.Mesh>
```

**Picking is event-driven, not per-frame.** Raycasts fire on DOM pointer events
(`pointermove`/`click`), *not* once per animation frame. Cost scales with the
number of interactive objects raycast per event, so keep the interactive set small
(or accelerate with `three-mesh-bvh`). All primary interactions should be `onclick`
— touch has no hover.

See **references/interaction.md** for the full picture: picking decision guide,
highlight outlines, the logical-part registry, info panels, camera fly-to,
deep-linking, accessibility, and the runtime customization/configurator model.

## Animation

**useTask (per-frame updates):**
```svelte
<script lang="ts">
  import { T, useTask } from '@threlte/core';

  let rotation = $state(0);

  useTask((delta) => {
    rotation += delta; // delta is time since last frame
  });
</script>

<T.Mesh rotation.y={rotation}>
  <T.BoxGeometry />
  <T.MeshStandardMaterial />
</T.Mesh>
```

**GLTF Animations:**
```svelte
<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { useGltf } from '@threlte/extras';
  import { AnimationMixer } from 'three';

  const gltf = useGltf('/animated.glb');
  let mixer: AnimationMixer | undefined;

  $effect(() => {
    if ($gltf) {
      mixer = new AnimationMixer($gltf.scene);
      const action = mixer.clipAction($gltf.animations[0]);
      action.play();
    }
  });

  useTask((delta) => {
    mixer?.update(delta);
  });
</script>

{#if $gltf}
  <T is={$gltf.scene} />
{/if}
```

**Rule:** One `AnimationMixer` per animated object. Update every frame with delta time.

## Render Modes & Display

`<Canvas renderMode="...">` controls *when* frames render — choose deliberately:
`on-demand` (default; renders on prop change / `invalidate()`), `always` (every
frame — needed for looping animation), `manual` (`advance()` only). The prop is
`renderMode`; `frameloop` is the R3F name and is ignored.

Three display facts that bite (full detail in **references/rendering-display.md**):

- **`useTask` defaults to `autoInvalidate: true`** — any task turns `on-demand`
  into always-rendering. Pass `autoInvalidate: false` + manual `invalidate()` for
  true on-demand alongside a task.
- **Each `<Canvas>` is one WebGL context; browsers cap ~8–16 per tab.** A grid of
  N live model canvases hits the wall (oldest context is silently evicted). Use one
  global canvas + portal, or pre-rendered image thumbnails — Threlte has no
  scissor/`<View>` component.
- **Color/tone defaults:** Three r152+ defaults to managed sRGB (don't disable);
  Threlte's `<Canvas>` defaults `toneMapping` to `AgXToneMapping` — don't
  redundantly set ACES. Use `NeutralToneMapping` for product-accurate color.

## Physics

See **references/physics.md** for Rapier integration. Pattern: `<World>` → `<RigidBody type="fixed|dynamic">` → `<AutoColliders shape="cuboid|ball">`.

```svelte
<World>
  <RigidBody type="fixed">
    <AutoColliders shape="cuboid">
      <T.Mesh><!-- ground --></T.Mesh>
    </AutoColliders>
  </RigidBody>
  <RigidBody type="dynamic">
    <AutoColliders shape="ball">
      <T.Mesh position.y={5}><!-- falling ball --></T.Mesh>
    </AutoColliders>
  </RigidBody>
</World>
```

## Performance

**Golden rule:** Target under 100 draw calls per frame.

**Check draw calls:**
```svelte
<script lang="ts">
  import { useThrelte } from '@threlte/core';

  const { renderer } = useThrelte();

  $effect(() => {
    console.log('Draw calls:', renderer.info.render.calls);
    console.log('Triangles:', renderer.info.render.triangles);
  });
</script>
```

**InstancedMesh for repeated objects:**
```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import { InstancedMesh } from '@threlte/extras';
  import { Matrix4, Vector3, Quaternion } from 'three';

  const count = 1000;
  const matrices: Matrix4[] = [];
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3(1, 1, 1);

  for (let i = 0; i < count; i++) {
    position.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
    matrices.push(new Matrix4().compose(position, quaternion, scale));
  }
</script>

<InstancedMesh {count}>
  <T.BoxGeometry />
  <T.MeshStandardMaterial />

  {#each matrices as matrix, i}
    <T.Instance {matrix} />
  {/each}
</InstancedMesh>
```

**Material sharing:**
```svelte
<script lang="ts">
  import { MeshStandardMaterial } from 'three';

  // Share one material across meshes
  const sharedMaterial = new MeshStandardMaterial({ color: 'blue' });
</script>

<T.Mesh>
  <T.BoxGeometry />
  <T is={sharedMaterial} />
</T.Mesh>

<T.Mesh position.x={2}>
  <T.SphereGeometry />
  <T is={sharedMaterial} />
</T.Mesh>
```

## Memory Management

**Three.js does NOT garbage collect GPU resources. Manual disposal is mandatory.**

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Mesh, MeshStandardMaterial, BoxGeometry } from 'three';

  const geometry = new BoxGeometry();
  const material = new MeshStandardMaterial();

  onDestroy(() => {
    geometry.dispose();
    material.dispose();
  });
</script>
```

**GLTF texture disposal (critical):**
```typescript
function disposeGltf(gltf: GLTF) {
  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(mat => {
          disposeTextures(mat);
          mat.dispose();
        });
      } else {
        disposeTextures(child.material);
        child.material.dispose();
      }
    }
  });
}

function disposeTextures(material: Material) {
  for (const key of Object.keys(material)) {
    const value = material[key];
    if (value?.isTexture) {
      // ImageBitmap needs explicit close()
      if (value.source?.data?.close) {
        value.source.data.close();
      }
      value.dispose();
    }
  }
}
```

**Monitor memory:**
```typescript
const { renderer } = useThrelte();
console.log(renderer.info.memory);
// { geometries: 45, textures: 23 }
```

## Mobile

**Reduce pixel ratio:**
```svelte
<script lang="ts">
  import { Canvas } from '@threlte/core';
</script>

<!-- Threlte 8 removed `rendererParameters`. Custom renderer options go through
     `createRenderer`. `dpr` accepts a [min, max] tuple to clamp devicePixelRatio. -->
<Canvas
  dpr={[1, 2]}
  createRenderer={(canvas) =>
    new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })}
>
```

**Adaptive quality:**
```svelte
<script lang="ts">
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
</script>

<Canvas dpr={isMobile ? 1 : 2}>
  {#if !isMobile}
    <T.DirectionalLight castShadow />
  {:else}
    <T.DirectionalLight />
  {/if}
</Canvas>
```

**Mobile optimizations:**
- Disable shadows or use baked shadows
- Reduce particle counts
- Use LOD (Level of Detail) for models
- Simplify post-processing

## WebGPU

See **references/webgpu.md** for details.

**Status (Jan 2026):** Production-ready in Three.js r171+, but **Threlte has known issues** (HMR crashes, auto-resize flickering). **Use WebGL for now.**

## Gotchas

**Model not visible:**
1. Check lighting (add `<T.AmbientLight />`)
2. Check scale (models may be tiny or huge)
3. Check camera position and far plane

**SSR errors:**
Always add `noExternal: ['three']` to svelte.config.js.

**Version mismatch crashes:**
Lock three.js version to match Threlte's peer dependencies.

**Interactivity slow:**
Raycasting fires on pointer events (not per frame), but every interactive object is
a raycast target per event. Keep the interactive set small, or accelerate with
`three-mesh-bvh` + `raycaster.firstHitOnly`.

**Memory leaks:**
GLTF textures are `ImageBitmap`. Need both `dispose()` AND `source.data.close()`.

**Transitions broken:**
Known issue in Threlte as of Jan 2026 (Issue #1672).

## Anti-Patterns

**Don't create materials per mesh:**
```svelte
<!-- WRONG: Creates new material for each -->
{#each items as item}
  <T.Mesh>
    <T.BoxGeometry />
    <T.MeshStandardMaterial color={item.color} />
  </T.Mesh>
{/each}

<!-- RIGHT: Share material, use vertex colors -->
```

**Don't forget disposal:**
```typescript
// WRONG: Leaks GPU memory
const geometry = new BoxGeometry();
// ... later, geometry is replaced but never disposed

// RIGHT: Clean up before replacing
geometry.dispose();
```

**Don't use WebGPU in Threlte yet:**
```svelte
<!-- WRONG: Known HMR and resize issues -->
<Canvas createRenderer={WebGPURenderer}>

<!-- RIGHT: Use default WebGL -->
<Canvas>
```

**Don't make everything interactive:**
```svelte
<!-- WRONG: every interactive mesh is a raycast target on each pointer event -->
<T.Mesh onclick={...} /> <!-- on every mesh, including high-poly ones -->

<!-- RIGHT: handlers only on meshes that need them; group sub-meshes under one
     handler; accelerate high-poly targets with three-mesh-bvh -->
<T.Group onclick={...}> <!-- one logical part = one clickable unit --></T.Group>
```

## References

- **references/rendering-display.md** - Render modes + `autoInvalidate` trap, the many-canvases wall, IBL/tone-mapping, camera auto-fit, mobile, SPA disposal
- **references/interaction.md** - Picking + decision guide, click-not-hover, highlight outlines, logical-part registry, info panels, fly-to, deep-link, a11y, configurator model
- **references/loading.md** - GLTF, Draco, KTX2, texture compression
- **references/performance.md** - Draw calls, instancing, BatchedMesh, LOD
- **references/physics.md** - Rapier setup, colliders, forces, events
- **references/webgpu.md** - TSL shaders, compute, migration path
