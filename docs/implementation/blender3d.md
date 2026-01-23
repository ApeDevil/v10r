# Blender to Web Pipeline

Integration guide for using Blender-exported 3D assets in the Velociraptor SvelteKit + Threlte stack.

## Quick Start

### Prerequisites
- Existing Threlte setup (see `/docs/blueprint/3d/3d-integration.md`)
- Blender 4.2 LTS (for Phase 3)

### Phased Validation

Test the pipeline incrementally using official models before introducing Blender variables.

| Phase | Model | Tests | Pass Criteria |
|-------|-------|-------|---------------|
| **1** | DamagedHelmet.glb | Basic loading, PBR materials | Model visible with correct materials |
| **2** | Fox.glb | Animation playback, clip switching | All 3 animations play correctly |
| **3** | Your own .blend | Full Blender → web pipeline | Custom asset works like Phase 1/2 |

---

### Phase 1: Static Model Test

Uses [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) - the official test models.

**1. Download test model:**
```bash
# From project root (inside container)
mkdir -p static/models
curl -o static/models/DamagedHelmet.glb \
  https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb
```

**2. Create test route:**

```typescript
// src/routes/showcase/3d/phase1-static/+page.ts
export const ssr = false;
export const prerender = false;
```

```svelte
<!-- src/routes/showcase/3d/phase1-static/+page.svelte -->
<script lang="ts">
  import { Canvas, T } from '@threlte/core';
  import { OrbitControls, GLTF } from '@threlte/extras';
</script>

<div class="container">
  <Canvas>
    <T.PerspectiveCamera makeDefault position={[3, 3, 3]}>
      <OrbitControls />
    </T.PerspectiveCamera>
    <T.DirectionalLight position={[10, 10, 10]} intensity={1} />
    <T.AmbientLight intensity={0.5} />

    <GLTF url="/models/DamagedHelmet.glb" />
  </Canvas>
</div>

<style>
  .container { width: 100%; height: 100vh; }
</style>
```

**3. Validate:**
- Navigate to `/showcase/3d/phase1-static`
- Model should display with metallic/rough PBR materials
- OrbitControls should allow rotation

**Pass criteria:** Helmet renders with correct materials → Threlte setup works.

---

### Phase 2: Animation Test

Uses the [Fox model](https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/Fox) - industry standard for animation pipeline testing.

**1. Download animated model:**
```bash
curl -o static/models/Fox.glb \
  https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Fox/glTF-Binary/Fox.glb
```

**2. Create test route:**

```typescript
// src/routes/showcase/3d/phase2-animated/+page.ts
export const ssr = false;
export const prerender = false;
```

```svelte
<!-- src/routes/showcase/3d/phase2-animated/+page.svelte -->
<script lang="ts">
  import { Canvas, T } from '@threlte/core';
  import { OrbitControls, useGltf, AnimatedModel } from '@threlte/extras';

  const gltf = useGltf('/models/Fox.glb');

  let currentAnimation = $state('Survey');
  const animations = ['Survey', 'Walk', 'Run'];
</script>

<div class="controls">
  {#each animations as anim}
    <button
      class:active={currentAnimation === anim}
      onclick={() => currentAnimation = anim}
    >
      {anim}
    </button>
  {/each}
</div>

<div class="container">
  <Canvas>
    <T.PerspectiveCamera makeDefault position={[100, 100, 100]}>
      <OrbitControls />
    </T.PerspectiveCamera>
    <T.DirectionalLight position={[100, 100, 100]} intensity={1} />
    <T.AmbientLight intensity={0.5} />

    {#await gltf then { scene, animations }}
      <T.Primitive object={scene} scale={1}>
        {#if animations.length > 0}
          <AnimatedModel
            {animations}
            currentAnimation={currentAnimation}
          />
        {/if}
      </T.Primitive>
    {/await}

    <T.GridHelper args={[200, 20]} />
  </Canvas>
</div>

<style>
  .container { width: 100%; height: 100vh; }
  .controls {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 10;
    display: flex;
    gap: 0.5rem;
  }
  button {
    padding: 0.5rem 1rem;
    background: #333;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  button.active {
    background: hotpink;
  }
</style>
```

**3. Validate:**
- Navigate to `/showcase/3d/phase2-animated`
- Fox should display and animate
- Click buttons to switch between Survey, Walk, Run animations

**Pass criteria:** All 3 animations play correctly → Animation pipeline works.

---

### Phase 3: Custom Blender Export

Now test your own Blender → web pipeline.

**1. Create test asset in Blender:**
```
1. Open Blender 4.2 LTS
2. Default cube is fine (uses Principled BSDF)
3. Optionally add 512x512 PNG texture to Base Color
4. File > Export > glTF 2.0 (.glb)
   - Uncheck "+Y up"
   - Apply Modifiers: ON
   - Format: glTF Binary (.glb)
```

**2. Validate export externally:**
- Drag GLB to [threejs.org/editor](https://threejs.org/editor)
- If it renders → export is valid
- If not → fix in Blender before touching code

**3. Transform for Threlte (optional optimization):**
```bash
# From container
npx @threlte/gltf@latest your-model.glb --transform
```
Generates:
- `YourModel.svelte` - Reusable component
- `your-model-transformed.glb` - Optimized (Draco + texture compression)

**4. Use in SvelteKit:**
```bash
# Move files
mv your-model-transformed.glb static/models/
mv YourModel.svelte src/lib/components/3d/
```

```svelte
<!-- src/routes/showcase/3d/phase3-custom/+page.svelte -->
<script lang="ts">
  import { Canvas, T } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
  import YourModel from '$lib/components/3d/YourModel.svelte';
</script>

<div class="container">
  <Canvas>
    <T.PerspectiveCamera makeDefault position={[5, 5, 5]}>
      <OrbitControls />
    </T.PerspectiveCamera>
    <T.DirectionalLight position={[10, 10, 10]} intensity={1} />
    <T.AmbientLight intensity={0.5} />

    <YourModel />
  </Canvas>
</div>

<style>
  .container { width: 100%; height: 100vh; }
</style>
```

```typescript
// src/routes/showcase/3d/phase3-custom/+page.ts
export const ssr = false;
export const prerender = false;
```

**Pass criteria:** Your custom model renders like the official models → Full pipeline validated.

---

## Official Test Models

| Model | Source | Size | Best For |
|-------|--------|------|----------|
| [Box.glb](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Box) | Khronos | ~1KB | Simplest possible test |
| [DamagedHelmet.glb](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/DamagedHelmet) | Khronos | ~3MB | PBR material validation |
| [Fox.glb](https://github.com/KhronosGroup/glTF-Sample-Models/tree/main/2.0/Fox) | Khronos | ~177KB | Animation testing (3 clips) |

### With Blender Source Files

| Source | What's Included |
|--------|-----------------|
| [arturitu/threejs-animation-workflow](https://github.com/arturitu/threejs-animation-workflow) | Full .blend files for each workflow stage |
| [Poly Pizza](https://poly.pizza/) | CC0 game assets with .blend files |
| [Unboring.net workflow](https://unboring.net/workflows/animation) | Downloadable .blend for texturing, rigging, animation |

## What Works

### Materials
- **Principled BSDF** - Maps directly to glTF PBR standard
- Supported texture maps:
  - Base Color
  - Metallic
  - Roughness
  - Normal
  - Ambient Occlusion
  - Emissive

### Textures
- PNG and JPEG only (glTF spec)
- Other formats auto-convert (slower export)
- Max 2 UV maps supported

### Animations
- Object transforms (position, rotation, scale)
- Armature/bone animations
- Shape keys / morph targets

### Geometry
- Meshes up to ~500k polygons (total scene)
- Single armature per file recommended

## What Doesn't Work

### Never Exports
| Feature | Workaround |
|---------|------------|
| Blender lights | Create in Threlte |
| Blender cameras | Create in Threlte |
| World/HDRI environment | Use Three.js environment maps |
| Procedural textures | Bake to image textures |
| Complex shader nodes | Stick to Principled BSDF |
| Particles | Bake to mesh or recreate in code |

### Requires Special Handling
| Feature | Solution |
|---------|----------|
| Shape keys + modifiers | Apply modifiers BEFORE creating shape keys |
| Multiple materials on one mesh | Exports as multiple meshes (by design) |
| Animation blending | Strip redundant static data |
| Unweighted vertices | Weight paint all geometry |

## Export Settings

### Recommended Settings
```
Format: glTF Binary (.glb)
Include: Selected Objects (or all)

Transform:
  +Y Up: UNCHECKED (prevents rotation issues)

Geometry:
  Apply Modifiers: ON
  UVs: ON
  Normals: ON
  Tangents: ON (if using normal maps)
  Vertex Colors: ON (if used)

Material:
  Materials: Export
  Images: Automatic

Animation:
  Animation: ON (if needed)
  Sampling Rate: 1

Compression:
  Compress: OFF (let @threlte/gltf handle it)
```

### Why No Compression in Blender?
`@threlte/gltf --transform` applies:
- Draco compression (better than Blender's)
- Texture resize to 1024x1024
- WebP conversion
- Mesh deduplication

Single command beats multi-tool pipeline.

## Troubleshooting

### Model Invisible
1. **Check scale** - Try `scale={0.01}` or `scale={100}`
2. **Check camera position** - Move to `[50, 50, 50]`
3. **Add GridHelper** - `<T.GridHelper size={100} />` to see coordinate system

### Model Appears Black
- **Missing lights** - Blender lights don't export
- Add: `<T.AmbientLight intensity={0.5} />` + `<T.DirectionalLight />`

### Materials Look Wrong
- **Not using Principled BSDF** - Only supported shader
- **Procedural textures** - Must bake to images
- **Wrong color space** - Normal maps need "Non-Color"

### Textures Missing
- **External references** - Ensure textures are embedded
- **Wrong format** - Use PNG or JPEG only

### Animation Doesn't Play
- **Not in NLA Editor** - Push action to NLA track
- **Track not visible** - Ensure NLA strip is visible during export

### 404 Error Loading Model
- **Wrong path** - Models go in `static/models/`
- **URL should be** - `/models/your-model.glb` (no `static` prefix)

### Coordinates Seem Wrong
- **Y/Z axis swapped** - Uncheck "+Y up" in Blender export
- Models rotated 90° is classic symptom

### OrbitControls Error
- **"Parent missing: OrbitControls need to be a child of a Camera"**
- OrbitControls must be nested inside the camera component:
```svelte
<T.PerspectiveCamera makeDefault position={[5, 5, 5]}>
  <OrbitControls />
</T.PerspectiveCamera>
```

## File Organization

```
static/
  models/
    robot.glb              # Original (or transformed)
    car.glb

src/lib/components/3d/
  Robot.svelte             # Generated by @threlte/gltf
  Car.svelte

src/routes/showcase/3d/
  blender-test/
    +page.svelte           # Test route
    +page.ts               # ssr = false
```

## Optimization Pipeline

### For Simple Models (<1MB)
1. Export GLB from Blender (no compression)
2. Run `npx @threlte/gltf model.glb --transform`
3. Use generated component

### For Complex Models (>1MB)
1. In Blender: reduce poly count with Decimation modifier
2. Export GLB
3. Run `npx @threlte/gltf model.glb --transform`
4. If still large: use gltf-pipeline for aggressive compression

### Compression Results (Real-World)
| Tool | Reduction |
|------|-----------|
| Blender Draco | ~80% |
| @threlte/gltf --transform | ~85% |
| gltf-pipeline | ~97% |

## Alternative: Raw GLTF Loading

If you don't want generated components:

```svelte
<script lang="ts">
  import { GLTF } from '@threlte/extras';
</script>

<GLTF url="/models/robot.glb" scale={1} />
```

Or with loading state:

```svelte
<script lang="ts">
  import { useGltf } from '@threlte/extras';
  import { T } from '@threlte/core';

  const gltf = useGltf('/models/robot.glb');
</script>

{#await gltf}
  <!-- Loading -->
{:then data}
  <T.Primitive object={data.scene} />
{:catch error}
  <!-- Error: {error.message} -->
{/await}
```

## Testing Checklist

### Phase 1: Static Model
- [x] DamagedHelmet.glb downloaded to `static/models/`
- [x] Test route created with `ssr = false`
- [x] Model visible with correct PBR materials
- [x] OrbitControls working

### Phase 2: Animation
- [ ] Fox.glb downloaded to `static/models/`
- [ ] All 3 animations play (Survey, Walk, Run)
- [ ] Animation switching works

### Phase 3: Custom Blender Export
- [ ] Blender scene uses only Principled BSDF materials
- [ ] Textures are PNG or JPEG (embedded, not external)
- [ ] Export validates in threejs.org/editor
- [ ] `@threlte/gltf --transform` runs without errors
- [ ] Model visible in Threlte (check scale, lights, camera)
- [ ] Materials render correctly
- [ ] Animations play (if applicable)
- [ ] File size acceptable for web (<5MB recommended)

## References

### Official Sources
- [Khronos glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) - Official test models
- [Blender glTF 2.0 Manual](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
- [@threlte/gltf Documentation](https://threlte.xyz/docs/reference/gltf/getting-started)
- [Three.js Loading 3D Models](https://threejs.org/manual/en/loading-3d-models.html)

### Validation Tools
- [threejs.org/editor](https://threejs.org/editor) - Quick drag-and-drop validation
- [glTF Viewer (Don McCurdy)](https://gltf-viewer.donmccurdy.com/) - Detailed model inspection
- [Khronos glTF Sample Viewer](https://github.khronos.org/glTF-Sample-Viewer-Release/) - Official reference renderer

### Blender Source Files
- [arturitu/threejs-animation-workflow](https://github.com/arturitu/threejs-animation-workflow) - .blend files for each stage
- [Poly Pizza](https://poly.pizza/) - CC0 models with Blender sources
- [Unboring.net workflows](https://unboring.net/workflows/animation) - Downloadable .blend files

### Velociraptor
- [3D Integration Guide](/docs/blueprint/3d/3d-integration.md)
