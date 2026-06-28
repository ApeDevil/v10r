# Interactive Objects

Clicking/tapping parts of a model to surface information and trigger further
interaction — plus the runtime customization model (material variants, part
toggles, morph targets, accessories). Covers picking, highlight feedback, info
display, camera fly-to, deep-linking, accessibility, and the configurator patterns.

## Contents

- [Picking Mechanics](#picking-mechanics)
- [Picking Performance — decision guide](#picking-performance--decision-guide)
- [Click, Not Hover (mobile reality)](#click-not-hover-mobile-reality)
- [Highlight Feedback](#highlight-feedback)
- [The Logical-Part Registry](#the-logical-part-registry)
- [Info Display — DOM panel vs in-canvas](#info-display--dom-panel-vs-in-canvas)
- [Camera Fly-To a Part](#camera-fly-to-a-part)
- [Deep-Linking a Selection](#deep-linking-a-selection)
- [Accessibility — the shadow-DOM rule](#accessibility--the-shadow-dom-rule)
- [Configurator Model](#configurator-model)
- [Anti-Patterns](#anti-patterns)

## Picking Mechanics

Enable pointer events once per scene with `interactivity()` from `@threlte/extras`,
then attach handlers to meshes. **Picking is event-driven** — raycasts fire on DOM
pointer events (`pointermove`/`click` at the browser's pointer rate), *not* once per
animation frame. (A common myth, including in older docs, says it raycasts every
frame — it does not, unless you manually raycast inside a `useTask`.)

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import { interactivity } from '@threlte/extras';

  interactivity();   // call ONCE, inside a <Canvas> descendant, before interactive <T>s

  let hovered = $state(false);
</script>

<T.Mesh
  onclick={(e) => { e.stopPropagation(); select(e.object); }}
  onpointerenter={() => (hovered = true)}
  onpointerleave={() => (hovered = false)}
>
  <T.BoxGeometry />
  <T.MeshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
</T.Mesh>
```

**The event object** extends Three.js `Intersection`:

| Field | Meaning |
|-------|---------|
| `object` | The mesh actually hit |
| `eventObject` | The object whose handler is firing (the registered ancestor) |
| `intersections` | All ray hits, nearest-first (not just the closest) |
| `point`, `face`, `uv`, `distance` | World hit point, face, UV, ray distance |
| `instanceId` | Set only for `InstancedMesh` hits |
| `stopPropagation()` | Stop delivery to farther/ancestor objects |

**Propagation:** events deliver nearest-first, then bubble through `Object3D`
ancestors (DOM-like). So a `<T.Group>` wrapping sub-meshes can own one handler —
ideal for "this whole part is one clickable unit." `event.object` is the child
mesh hit; `event.eventObject` is the group that registered the handler. Call
`stopPropagation()` to prevent objects *behind* the hit from also receiving it.

## Picking Performance — decision guide

For a handful of named parts at normal poly counts, **plain raycasting is fine** —
do not reach for GPU picking. Escalate only by evidence:

| Scenario | Use | Why |
|----------|-----|-----|
| 5–50 named parts, normal poly | `interactivity()` raycast | Simplest; event-driven cost is trivial |
| Parts >~50k triangles each | + `three-mesh-bvh` | Accelerated raycast; ~500 rays/frame on 80k-poly |
| Low-poly props beside interactive parts | `meshBounds` raycast on the props | Bounding-sphere test, skips precise geometry |
| Thousands of selectable objects | GPU/ID-buffer picking | CPU raycast can't scale |
| Need world point / UV / face normal | CPU raycast only | GPU picking returns *only* the object id |
| Animated **skinned** mesh | plain raycast (not BVH) | BVH bounds are static; won't track the pose |

**`three-mesh-bvh`** — patch once, build the tree per geometry after load:

```typescript
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import * as THREE from 'three';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
// r152+ added a native SkinnedMesh.raycast that shadows the patch — patch it too
// if you (despite the caveat above) need BVH on skinned geometry:
THREE.SkinnedMesh.prototype.raycast = acceleratedRaycast;

geometry.computeBoundsTree();              // after the model loads
```

Then set `raycaster.firstHitOnly = true` — a BVH-aware flag that stops at the
nearest hit (the single biggest speed lever for click-picking). Recent
`@threlte/extras` may expose a `bvh()` helper and a `meshBounds` raycast prop;
verify they exist in your installed version, otherwise patch manually as above.

**Gotcha — BVH is static.** The bounds tree does not recompute when geometry,
morph targets, or skinning change. Force a rebuild by wrapping the mesh in
`{#key version}`, or call the library's `refit()` after direct vertex edits.

**If you ever raycast per-frame** (custom hover-follows-surface tooling): don't
raycast inside the `pointermove` handler. Store the pointer NDC on move and raycast
**once per frame** in a `useTask` — decouples raycast count from event frequency
(a documented fix for 2 FPS → 60 FPS on dense scenes).

## Click, Not Hover (mobile reality)

**Touch has no hover.** `onpointerenter`/`onpointermove` don't fire meaningfully on
a touchscreen. So:

- **All primary interactions are `onclick`** (fires on tap too): select a part,
  open the info panel, fly the camera.
- **`onpointerenter`/`leave` are desktop garnish only** — cursor change, hover
  glow. They must degrade to nothing on mobile without losing functionality.
- `touch-action: none` on the canvas enables drag-to-orbit; on a scrollable page,
  use `touch-action: pan-y` so the page still scrolls vertically.
- Inflate hit targets for fingers: an invisible larger collider mesh, or
  `interactivity()`'s click distance/time tolerances. Aim for ≥44px effective
  tap area (WCAG 2.5.5).

## Highlight Feedback

Two tiers, both mobile-safe. **Avoid `OutlinePass`** from three.js examples
entirely — it is broken on `SkinnedMesh`, transparent materials, and
`InstancedMesh`, and degrades ~6× on high-poly meshes (documented, unfixed).

**Hover → emissive tint (near-zero cost).** Bump `emissive`/`emissiveIntensity` on
the hovered mesh. This mutates the material, so the material **must be cloned per
mesh first** (a shared material would light up every mesh using it). Clone once at
load, store the original emissive to restore:

```svelte
<T
  is={mesh}
  onpointerenter={() => (hovered = id)}
  onpointerleave={() => (hovered = null)}
>
  <!-- material was cloned on load; toggle emissive on hover -->
</T>
```

In `on-demand` mode a material property change auto-requests a render (no manual
`invalidate()` needed for reactive prop changes; an *imperative* mutation does need
`invalidate()`).

**Selected → inverted-hull `<Outlines>`.** The production-grade selection outline
is `@threlte/extras`' `<Outlines>` (a port of drei's): renders the mesh a second
time as expanded back-faces. No `EffectComposer`, works on `SkinnedMesh` /
`InstancedMesh` / transparent materials, none of the `OutlinePass` bugs apply.
**It must be a child of the mesh it outlines:**

```svelte
<T is={selectedMesh}>
  <Outlines color="#ffcc00" thickness={0.02} screenspace />
</T>
```

`screenspace` keeps line width constant across zoom. (Inverted hull can show minor
artifacts on very concave geometry — usually invisible in practice.)

`postprocessing`'s `OutlineEffect` (pmndrs) is higher-quality and can outline many
objects in one screen-space pass, but it forces `autoRender = false` and adds a
full composer to every frame — reserve it for desktop scenes that already run
post-processing.

## The Logical-Part Registry

**Never key your logic on raw artist mesh names.** They drift across re-exports,
parts split into multiple primitives (`Name_0`, `Name_1`), and Blender's Object-name
vs Mesh-data-name distinction silently breaks lookups. `getObjectByName` is itself
unreliable — single-primitive GLTF meshes can lose their name to GLTFLoader's group
collapsing, returning `undefined`.

Instead: define **logical part IDs** in a config, each mapping to one or more mesh
**name patterns**, and resolve by **prefix-match traversal** — not `getObjectByName`:

```typescript
interface PartDef {
  meshNamePatterns: string[];  // exact or prefix; tolerant of "_0"/"_1" splits
  label: string;
  description: string;
  // ...price, link, whatever metadata the UI needs — lives HERE, never in the GLTF
}

const PARTS: Record<string, PartDef> = {
  legs:  { meshNamePatterns: ['Sofa_legs'],  label: 'Solid Wood Legs', description: '...' },
  feet:  { meshNamePatterns: ['Sofa_feet'],  label: 'Brass Feet Caps', description: '...' },
  body:  { meshNamePatterns: ['Sofa_body'],  label: 'Velvet Body',      description: '...' },
};

// Prefix-match handles exact names AND multi-primitive "Name_0"/"Name_1" splits.
function findMeshes(root: THREE.Object3D, name: string): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((c) => {
    if ((c as THREE.Mesh).isMesh && (c.name === name || c.name.startsWith(`${name}_`)))
      out.push(c as THREE.Mesh);
  });
  return out;
}
```

Map a raycast hit back to a logical part by walking the hit object's name (or its
ancestors') against the patterns. **Validate at load in DEV**: warn for any pattern
that matched zero meshes — that's how you catch a re-export rename before it ships.

**Authoring tip:** for hotspot *positions*, have the artist place named empties
(e.g. `hotspot_legs`) in Blender with custom properties; export with custom
properties on. Traverse for the `hotspot_` prefix at load and read `userData`.
Positions then survive geometry edits without touching code. Keep textual metadata
(labels, copy) in JS regardless — node-level `extras`→`userData` is fine for
positions/ids, but mesh-level extras have spotty exporter support.

## Info Display — DOM panel vs in-canvas

**Default: a fixed DOM panel, not an in-canvas label.** Drive a normal
sidebar/bottom-sheet from `selectedPart` state. It's faster (no per-frame 3D→2D
projection), fully accessible, easy to style, mobile-correct, and has no occlusion
problem. Use real UI components, not hand-rolled markup.

```svelte
<script lang="ts">
  let selected = $state<string | null>(null);
</script>

<div class="viewer">
  <Canvas>…<Scene onselect={(id) => (selected = id)} />…</Canvas>
</div>

{#if selected}
  {@const part = PARTS[selected]}
  <aside aria-live="polite">       <!-- a real panel/sheet component -->
    <h3>{part.label}</h3>
    <p>{part.description}</p>
  </aside>
{/if}
```

**Use in-canvas labels only for 3D-locked markers** (a numbered dot pinned to a
point on the model). Options, cheapest first:

- **`<HTML>` (`@threlte/extras`)** — DOM projected to a 3D point. Good for ≲10
  markers. Props: `occlude` (hide behind geometry — but it's a *raycast* per label,
  and occlusion is binary unless `occlude="blending"`), `center`, `transform`,
  `distanceFactor`. The canvas element **must be `position: relative|absolute|…`**
  or layout breaks. Don't use it as the *primary* info surface (a React/DOM element
  per label degrades badly past ~hundreds; jitter and z-index pain).
- **Dual-sprite marker** — two sprites per hotspot: one `depthTest: true` (hides
  when occluded), one `depthTest: false` at low opacity (always-visible ghost).
  No raycast cost for occlusion; the community-standard Sketchfab-style marker.
- **`CSS2DRenderer` overlay** — a parallel renderer of HTML labels; zero GPU cost,
  but it's a separate renderer mounted as a sibling div with `pointer-events: none`
  and doesn't integrate with the canvas event system.

## Camera Fly-To a Part

Selecting a part should reframe the camera on it. Use `<CameraControls>`
(`@threlte/extras`, wrapping yomotsu/camera-controls) and `fitToBox`:

```typescript
// compute the box from ALL meshes of the logical part, not one primitive
const box = new THREE.Box3();
for (const m of findMeshes(scene, pattern)) box.expandByObject(m);
controls.fitToBox(box, true);   // true = animated
// or aim without fitting: controls.setLookAt(x,y,z, tx,ty,tz, true)
```

**Gotcha:** `fitToBox` called before the mesh's world matrix is current returns
wrong bounds. Defer one tick after selection (`await tick()`), or
`mesh.updateWorldMatrix(true, true)` first. From a sibling picker component, reach
the controls via `useCameraControls()` (`bind:ref` only works in the component that
renders `<CameraControls>`). `smoothTime` tunes the transition.

## Deep-Linking a Selection

Round-trip the selected part through the URL so a selection is shareable and
survives reload. Use a **search param** (SSR-friendly; preferred over a hash):

```typescript
import { page } from '$app/state';
import { goto } from '$app/navigation';

// read on mount
let selected = $state(page.url.searchParams.get('part'));

// write on select (no history spam, no scroll jump)
function select(id: string) {
  selected = id;
  const url = new URL(page.url);
  url.searchParams.set('part', id);
  goto(url, { replaceState: true, noScroll: true, keepFocus: true });
}
```

## Accessibility — the shadow-DOM rule

Screen readers cannot see canvas pixels, and there is **no ARIA spec for
canvas-native 3D**. The only standardized path is a **parallel shadow DOM**:
semantic HTML mirroring the interactive parts, layered over the (hidden) canvas.

```svelte
<div role="application" aria-label="Sofa part explorer" style="position:relative">
  <canvas aria-hidden="true"></canvas>

  <!-- one real <button> per part; native keyboard + focus for free -->
  {#each Object.entries(PARTS) as [id, part]}
    <button
      class="sr-only-focusable"
      aria-pressed={selected === id}
      onclick={() => select(id)}
    >{part.label}</button>
  {/each}
</div>

{#if selected}
  <aside aria-live="polite"><!-- announces the selected part --></aside>
{/if}
```

- `aria-hidden` on `<canvas>` (don't let AT read it as a pixel blob);
  `role="application"` on the wrapper.
- A native `<button>` per part gives Tab/Enter/Space and focus rings for free;
  reflect selection with `aria-pressed`/`aria-selected`.
- `aria-live="polite"` on the info panel announces the selected part.
- `Esc` closes the panel. Honor `prefers-reduced-motion` for fly-to/explode
  animations.

## Configurator Model

Beyond read-only inspection, runtime customization mutates the loaded scene. Drive
all of it from declarative config + a state object, applied via `$effect`s, calling
`invalidate()` after each imperative change.

**Material variants — `KHR_materials_variants`.** The standard glTF extension for
swappable material sets (e.g. fabric colors). Resolve through the GLTF parser, not
by hand, so skinning/morph/tone-mapping flags are applied:

```typescript
// per mesh carrying the extension:
const ext = mesh.userData?.gltfExtensions?.KHR_materials_variants;
const mapping = ext?.mappings.find((m) => m.variants.includes(variantIndex));
if (mapping) {
  const mat = await parser.getDependency('material', mapping.material);
  mesh.material = mat.clone();          // clone to avoid shared-ref mutation
  parser.assignFinalMaterial(mesh);     // re-apply skinning/morph/tonemap flags
}
```

Capture each mesh's original material on load so "no variant / default" can restore.

**Color override.** For models without variants, clone the target materials on load,
then set `material.color` by material name and `material.needsUpdate = true`. Keep a
map of original colors to reset.

**Part visibility.** Toggle `object.visible` for every mesh of a logical part —
resolve via the prefix-match traversal above (more robust than `getObjectByName`).

**Morph targets.** Drive `mesh.morphTargetInfluences[index]` where
`index = mesh.morphTargetDictionary[targetName]`. A multi-primitive mesh splits into
`Name_0`, `Name_1`… — apply to every matching mesh, guard for missing dictionaries.

**Bone accessories.** Attach procedural/loaded meshes to a skeleton bone
(`bone.add(child)`). Compensate for the bone's world scale so the accessory renders
at intended size, regardless of the skeleton's coordinate system. Dispose on detach.

**Presets & conflicts.** Presets are partial states merged over the base state.
Conflict rules disable mutually-exclusive options (e.g. two hats). Compute a
disabled-set from active selections and reflect it in the UI.

**State shape:**

```typescript
interface CustomizationState {
  materials: Record<string, string>;       // groupId → optionId
  partVisibility: Record<string, boolean>;  // partId → visible
  morphValues: Record<string, number>;      // "meshName.targetName" → value
  accessories: Record<string, boolean>;     // accessoryId → enabled
}
```

Build the default state from config, apply each slice in its own `$effect`, and
gate effects behind an `initialized` flag so they don't run before the scene and
its materials are cloned/captured.

## Anti-Patterns

- **Per-frame raycasting for hover.** Picking is event-driven; don't wrap it in a
  `useTask`. If you must, raycast once per frame from stored NDC, not per pointer
  event.
- **Hover as the only path to information.** Breaks on touch. Click/tap opens the
  panel; hover only previews.
- **`OutlinePass` for selection.** Broken on skinned/transparent/instanced; 6×
  high-poly cost. Use inverted-hull `<Outlines>`.
- **Keying logic on raw mesh names / `getObjectByName`.** Names drift; single-prim
  meshes lose names. Use a logical-part registry + prefix-match traversal + DEV
  validation.
- **In-canvas `<HTML>` as the primary info UI.** Use a DOM panel; reserve `<HTML>`
  for sparse 3D-locked markers.
- **Mutating a shared material on hover/select.** Clone per mesh at load first.
- **`fitToBox` before world matrices update.** Defer a tick or force
  `updateWorldMatrix`.
- **No accessible layer.** A bare interactive canvas is invisible to AT — always
  provide the shadow-DOM button layer + `aria-live` panel.
