# Rendering & Display Strategy

How to get static AND dynamic 3D objects onto the screen efficiently — render-loop
choice, the multi-canvas ceiling, display-quality lighting, camera framing, and
SPA memory discipline.

This file covers display **architecture and strategy**. For the mechanics it
references — instancing, LOD, BatchedMesh, shadow sizing — see
**performance.md**. For asset compression and suspense, see **loading.md**.

## Contents

- [Render Modes — pick deliberately](#render-modes--pick-deliberately)
- [The `autoInvalidate` Trap](#the-autoinvalidate-trap)
- [On-Demand Gotchas](#on-demand-gotchas)
- [The Many-Canvases Wall](#the-many-canvases-wall)
- [Color Pipeline & Tone Mapping](#color-pipeline--tone-mapping)
- [Lighting for Display Quality (IBL)](#lighting-for-display-quality-ibl)
- [Camera Auto-Framing](#camera-auto-framing)
- [Mobile & Adaptive Quality](#mobile--adaptive-quality)
- [SSR & Client-Only Canvas](#ssr--client-only-canvas)
- [Disposal in SPAs](#disposal-in-spas)
- [Display Decision Table](#display-decision-table)

## Render Modes — pick deliberately

Threlte's `<Canvas renderMode="...">` controls *when* frames render. The wrong
choice either burns battery (rendering a static model 60×/s) or silently freezes
animation. (The prop is `renderMode`. `frameloop` is the React-Three-Fiber name —
Threlte ignores it.)

| Mode | Renders when | Use for |
|------|--------------|---------|
| `on-demand` (default) | A prop changes, or `invalidate()` is called | Static models, product viewers, anything idle most of the time |
| `always` | Every frame, unconditionally | Looping GLTF animations, continuous `useTask` motion, physics |
| `manual` | Only when you call `advance()` | Step-through previews, controlled/offscreen capture |

```svelte
<Canvas renderMode="on-demand">  <!-- default; omit for the same effect -->
```

**Rule:** a scene that is visually still 99% of the time should be `on-demand`.
A scene with a looping animation should be `always` (or driven by an
auto-invalidating task — see below). Render mode is **per-Canvas**, not per-mesh.

## The `autoInvalidate` Trap

`useTask(fn)` defaults to `autoInvalidate: true`, which calls `invalidate()` on
**every tick**. So *any* `useTask` anywhere in the tree turns `on-demand` into
`always` in practice.

```svelte
<!-- This task forces continuous rendering even in on-demand mode -->
<script lang="ts">
  import { useTask } from '@threlte/core';
  useTask((delta) => { rotation += delta; });  // autoInvalidate: true by default
</script>
```

To keep genuine on-demand behavior alongside a task that only *sometimes* changes
the scene, opt out and invalidate yourself:

```svelte
<script lang="ts">
  import { useThrelte, useTask } from '@threlte/core';
  const { invalidate } = useThrelte();

  useTask((delta) => {
    if (!somethingChanged) return;
    advanceState(delta);
    invalidate();           // request exactly one frame
  }, { autoInvalidate: false });
</script>
```

**Encode:** "on-demand mode + a default `useTask` = always-rendering." If you
want on-demand to mean on-demand, set `autoInvalidate: false` on tasks that
shouldn't drive the loop.

## On-Demand Gotchas

Three real ways `on-demand` "breaks" — all are the loop correctly going idle:

1. **Animations freeze silently.** A GLTF `AnimationMixer` only advances if a
   task calls `mixer.update(delta)` *and* a frame renders. In `on-demand` with no
   invalidating task, the canvas goes still mid-animation. Fix: use `always` for
   any scene with a looping clip, or drive the mixer in a default (auto-invalidating)
   `useTask`.
2. **OrbitControls damping stalls.** After the pointer releases, the camera should
   coast. In pure on-demand the loop stops before the inertia decays, leaving the
   camera frozen mid-glide. Threlte's own `<OrbitControls enableDamping>` keeps the
   loop alive through the decay; a hand-rolled controls class will exhibit the stall.
3. **Post-processing doesn't refresh.** A custom `EffectComposer` won't repaint
   unless its render is tied into invalidation. Use the `@threlte/extras`
   post-processing wrapper, or `invalidate()` after the composer renders.

## The Many-Canvases Wall

**The single most important display-architecture fact: each `<Canvas>` is one
live WebGL context, and browsers cap them at ~8–16 per tab (fewer on mobile,
~4 for OffscreenCanvas).** Past the cap the browser *silently evicts the oldest
context* — the first card in a grid goes blank as you scroll to the last. A grid
of N model thumbnails, each its own `<Canvas>`, hits this ceiling.

**Threlte has no scissor/`<View>` component** (R3F/drei does). The two production
answers:

**A. One global `<Canvas>` + portal.** Put a single `<Canvas>` in the root layout;
pages mount their scene into it via Threlte's documented canvas-portal pattern.
One context for the whole app — the ceiling disappears, and the renderer surviving
route changes also avoids the worst leak (recreating the renderer per route). This
is Threlte's official answer for app-wide 3D.

**B. Pre-rendered thumbnails.** Render each model to a static PNG/WebP (build-time
or on upload); the grid is `<img>` tags; a live `<Canvas>` spins up only on the
detail/hero view. Scales to any catalog size. Trade-off: grid thumbnails are
static (no live auto-rotate). This is what large product catalogs ship.

**C. IntersectionObserver gating** (small grids only). Mount/pause a card's canvas
by viewport visibility. Delays but does not remove the ceiling; fast scrolling
still accumulates contexts, and remount causes a GPU-realloc hitch.

```svelte
<!-- Pause an off-screen card's render loop (composes documented APIs) -->
<!-- Parent observes visibility; the flag flows INTO the Canvas child, -->
<!-- because useThrelte() is only available inside <Canvas>. -->
<script lang="ts">
  // child scene component
  import { useThrelte } from '@threlte/core';
  let { visible = true }: { visible?: boolean } = $props();
  const { autoRender } = useThrelte();
  $effect(() => { autoRender.set(visible); });
</script>
```

**Encode:** never create N canvases for N thumbnails. Use one global canvas +
portal, or pre-rendered images. Live WebGL in a grid >~8 items will exhaust
contexts on desktop and overheat mobile.

## Color Pipeline & Tone Mapping

Modern Three.js (r152+) defaults `ColorManagement.enabled = true` and
`outputColorSpace = SRGBColorSpace` — the linear workflow. **Do not disable it.**
(`outputEncoding` was renamed to `outputColorSpace`; the old property is gone.)

Threlte's `<Canvas>` additionally defaults `toneMapping` to **`AgXToneMapping`**
(not `NoToneMapping`, not ACES). So:

- **Don't redundantly set `ACESFilmicToneMapping`** thinking it's the baseline — it
  will look different (more contrast, more highlight hue-shift) than the platform
  default.
- For neutral product display, `NeutralToneMapping` (Three r174+) applies the
  least tone curve. `AgX` (default) is a good general filmic choice. `ACESFilmic`
  is the cinematic, higher-contrast option.

```svelte
<Canvas toneMapping={THREE.NeutralToneMapping}>  <!-- product-accurate colors -->
```

## Lighting for Display Quality (IBL)

The highest-quality-per-effort lever for PBR models (metal/rough surfaces) is
**image-based lighting** via an HDRI environment — it provides realistic
reflections from every direction that analytic lights cannot.

```svelte
<script lang="ts">
  import { Environment } from '@threlte/extras';
</script>

<!-- IBL for reflections + one directional for the key shadow/highlight -->
<Environment url="/hdri/studio_small_03_1k.hdr" />
<T.DirectionalLight position={[5, 8, 5]} intensity={1} castShadow />
```

**API note (corrects older docs):** current `<Environment>` takes **`url`** —
the `files` and `preset` props were removed. There are no built-in presets; supply
your own `.hdr`/`.exr`. `isBackground` (skybox), `isEnvironment` (IBL, default
true), and `ground` (grounded projection) tune behavior.

With IBL active, `AmbientLight` is usually redundant — add it only if the model
reads too dark. Keep total lights to 2–3 (see performance.md). For thumbnails,
IBL + one directional and **no shadows** is a good trade.

## Camera Auto-Framing

For models of unknown scale, fit the camera to the bounding box after load rather
than guessing a position. Also scale `near`/`far` to the model — a fixed
`near: 0.1 / far: 2000` is a 20,000:1 ratio that risks depth-buffer z-fighting.

```typescript
import { Box3, Vector3, type PerspectiveCamera, type Object3D } from 'three';

function fitCameraToObject(obj: Object3D, camera: PerspectiveCamera, pad = 1.2) {
  const box = new Box3().setFromObject(obj);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const dist = maxDim / (2 * Math.tan(Math.min(vFov, hFov) / 2));

  camera.position.set(center.x, center.y + size.y * 0.15, center.z + dist * pad);
  camera.near = dist / 100;          // scaled to the model, not fixed
  camera.far = dist * 10;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}
```

Run it once inside an `$effect` after `$gltf` resolves. `Box3.setFromObject`
traverses the whole subtree, so it includes every child mesh. For an animated
model, fit to the rest pose (or a representative frame). Enable
`<OrbitControls enableDamping dampingFactor={0.08}>` for a product-viewer feel.

## Mobile & Adaptive Quality

**API correction:** Threlte 8 removed the `rendererParameters` prop. Custom
renderer options (antialias, powerPreference) go through `createRenderer`:

```svelte
<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { WebGLRenderer } from 'three';
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
</script>

<Canvas
  dpr={[1, isMobile ? 1.5 : 2]}   {/* tuple clamps devicePixelRatio */}
  shadows={!isMobile}
  createRenderer={isMobile
    ? (canvas) => new WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' })
    : undefined}
>
```

- **Clamp DPR.** A 3× phone rendering at native DPR is ~6.5× the pixels of DPR 1.
  Cap at 1.5 on mobile — biggest single mobile win after draw calls.
- **Drop shadows on mobile.** Shadow maps are a top FPS killer; substitute a
  contact-shadow plane or baked lighting.
- **Prefer `matchMedia` over UA sniffing.** More reliable than parsing
  `navigator.userAgent`.
- **Sizing:** Threlte's Canvas auto-resizes to its container via ResizeObserver —
  no manual resize listener. Use CSS `height: 100dvh` (not `100vh`) so mobile
  browser chrome doesn't clip it.

Mobile budgets and what tanks FPS (draw calls > shadows > transparent overdraw >
uncompressed textures > excess DPR) live in **performance.md**.

## SSR & Client-Only Canvas

WebGL has no server-side equivalent; Three.js touches `window`/`HTMLCanvasElement`
at import. Two layers protect SSR:

1. **Vite config:** `vitePlugin: { ssr: { noExternal: ['three'] } }` — without it,
   SSR throws `window is not defined`.
2. **Disable SSR on 3D routes.** Set it once at the layout that owns the 3D subtree:

```typescript
// +layout.ts for the 3D section
export const ssr = false;
export const prerender = false;
```

With `ssr = false`, the component tree never renders on the server, so top-level
imports of `three`/`@threlte/*` are safe — no `{#if browser}` guard, no hydration
mismatch (the canvas doesn't exist until JS runs). Routes that break out of the
layout with `+page@.svelte` must repeat these flags in their own `+page.ts`.

## Disposal in SPAs

**Three.js does not garbage-collect GPU resources.** Nulling a JS reference leaves
the geometry/texture allocated on the GPU until you call `.dispose()`. SPA route
changes do not clean up for you. (See SKILL.md "Memory Management" for the full
GLTF traverse-and-dispose routine.)

What Threlte 8 auto-disposes vs not:

| Auto-disposed on unmount | NOT auto-disposed |
|--------------------------|-------------------|
| Geometries/materials/targets attached via `<T>` | **Textures from `useTexture()`** — call `.dispose()` yourself |
| `is`-prop disposables on change/unmount | Draco/KTX2 loader instances (cached for app lifetime — usually fine) |
| | `useGltf` URL cache entries (persist app-wide by design) |

Two SPA landmines:

- **`useTexture` leaks.** Dispose textures in `onDestroy`/`$effect` cleanup; Threlte
  only tracks `<T>`-mounted objects.
- **Same-URL `useGltf` + `SkinnedMesh`.** `useGltf` caches by URL, so two
  components requesting the same skinned model share one object graph — and a
  bone has a single parent, so only the last-mounted instance renders. Deep-clone
  (e.g. `SkeletonUtils.clone`) for multiple skinned instances of one URL.

**Leak canary:** log `renderer.info.memory.geometries` and `.textures` on route
change in DEV. If counts climb without returning to baseline, you have a leak.

## Display Decision Table

| Situation | Do this |
|-----------|---------|
| Many small thumbnails | Pre-rendered images, OR one global canvas + portal — never N canvases |
| Static hero model | `renderMode="on-demand"`, IBL + 1 directional, auto-fit camera |
| Looping animation | `renderMode="always"` (or auto-invalidating task) |
| PBR reflections matter | `<Environment url>` IBL; pick tone mapping (AgX default / Neutral for product) |
| Unknown model scale | Bounding-box camera fit; scale near/far to the model |
| Mobile | Clamp DPR ≤1.5, shadows off, `createRenderer` low-power, `100dvh` |
| Route changes with 3D | `ssr=false` at layout; dispose `useTexture`; watch `renderer.info.memory` |
